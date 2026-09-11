"""
parser.py
---------
Police Log Entity Extractor — Detectra
Regex fallback used when the Claude API is unavailable (see app.py)

Provides a single public function:
    parse_police_log(text_input) -> dict

Given a raw, unstructured police narrative (FIR text, officer notes, etc.),
it extracts:
    - Vehicle registration numbers  (Indian format)
    - Mobile phone numbers          (10-digit)
    - Weapon / threat keywords      (configurable watchlist)
    - Monetary amounts              (Rupee-denominated)

No third-party libraries required — only the Python standard library.

Usage:
    python parser.py                  # runs the built-in sample log test
    import parser; parser.parse_police_log("your text here")
"""

import re
import json


# =========================================================
# KEYWORD WATCHLIST
# Add or remove words here to adjust what the scanner flags.
# All comparisons are case-insensitive.
# =========================================================
MONITORED_KEYWORDS = [
    # Weapons
    "pistol", "revolver", "rifle", "shotgun",
    "knife", "dagger", "sword", "machete", "blade", "sharp weapon",
    "country-made gun", "countrymade gun", "crude bomb", "improvised",
    # Crime-type signals
    "stolen", "theft", "snatched", "robbery", "abducted", "kidnapped",
    "extortion", "ransom", "assault", "murder", "dacoity",
    # Organisation signals
    "gang", "syndicate", "cartel", "network", "hideout",
    # Narcotics
    "drugs", "narcotics", "ganja", "heroin", "cocaine", "methamphetamine",
]


# =========================================================
# REGEX PATTERNS
# Each pattern is compiled once at module load for efficiency.
# =========================================================

# --- Indian vehicle registration numbers ---
# Covers both hyphenated (KA-01-ME-1234) and un-hyphenated (KA05NB5678).
# Breakdown:
#   [A-Z]{2}    -> 2-letter state code          (e.g. KA, MH, TN)
#   [-]?        -> optional hyphen separator
#   \d{2}       -> 2-digit RTO district code     (e.g. 01, 05)
#   [-]?        -> optional hyphen
#   [A-Z]{1,3}  -> 1-3 letter series code        (e.g. ME, NB, AB)
#   [-]?        -> optional hyphen
#   \d{4}       -> 4-digit unique number
#
# IMPORTANT: separators are hyphens ONLY (not \s / whitespace).
# Allowing \s here caused the regex to cross line-breaks and produce
# false positives like "of\n15-Nov-2024" -> "OF15NOV2024".
_VEHICLE_RE = re.compile(
    r"\b([A-Z]{2}[-]?\d{2}[-]?[A-Z]{1,3}[-]?\d{4})\b",
    re.IGNORECASE,
)

# --- 10-digit Indian mobile numbers ---
# Strategy: find any run of digits-and-separators that *could* be a phone
# number (a loose candidate pattern), strip all non-digit characters from
# the match, then validate: exactly 10 digits AND first digit is 6-9.
# This two-step approach correctly handles unusual spacing like "98765 43210"
# (space after 5th digit) that a rigid 3+3+4 split would miss.
#
# The candidate pattern optionally strips a leading +91 / 91 country code.
_PHONE_CANDIDATE_RE = re.compile(
    r"(?:\+91[-\s]?|91[-\s]?)?[6-9][\d\s\-]{8,12}"
)

# --- Monetary amounts ---
# Handles:
#   Prefix forms  : "Rs. 50,000"  "Rs 50000"  "INR 1,20,000"  "₹75,000"
#   Suffix form   : "75000 rupees"  "50,000 rupees"
#
# (?<!\d) lookbehind on the suffix form is critical: without it, the
# regex matches the TAIL of an unformatted integer ("75000 rupees" ->
# "000 rupees") because \d{1,3} greedily matches the last 1-3 digits.
# The lookbehind ensures we start matching only at a true word boundary
# in the numeric value.
_MONEY_RE = re.compile(
    r"(?:"
        r"(?:Rs\.?\s*|INR\s*|\u20b9\s*)"        # prefix symbol / abbreviation
        r"(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)" # captured amount (comma-formatted OK)
    r"|"
        r"(?<!\d)"                                # NOT preceded by another digit
        r"(\d{1,3}(?:,\d{2,3})+|\d+)"           # comma-formatted OR plain integer
        r"(?:\.\d{1,2})?"                         # optional paise/decimal
        r"\s*rupees"                              # suffix keyword
    r")",
    re.IGNORECASE,
)


# =========================================================
# MAIN EXTRACTION FUNCTION
# =========================================================

def parse_police_log(text_input: str) -> dict:
    """
    Parse a raw police narrative and extract key forensic entities.

    Parameters
    ----------
    text_input : str
        Unstructured text from an FIR, officer notes, or any police log.

    Returns
    -------
    dict with four keys:
        "vehicle_numbers"  : list[str]  – deduplicated, normalised plates
        "phone_numbers"    : list[str]  – deduplicated 10-digit numbers
        "flagged_keywords" : list[str]  – matched watchlist words (lower)
        "monetary_amounts" : list[str]  – raw matched amount strings
    """
    text = text_input.strip()

    # ------------------------------------------------------------------
    # 1. VEHICLE NUMBERS
    # Normalise: strip hyphens so "KA-01-ME-1234" and "KA01ME1234" both
    # store as "KA01ME1234", then deduplicate.
    # ------------------------------------------------------------------
    def _normalise_plate(plate: str) -> str:
        return re.sub(r"[-]", "", plate).upper()

    raw_vehicles = _VEHICLE_RE.findall(text)
    vehicle_numbers = sorted(set(_normalise_plate(v) for v in raw_vehicles))

    # ------------------------------------------------------------------
    # 2. PHONE NUMBERS
    # Two-pass approach:
    #   Pass 1 — candidate regex finds loose digit-and-separator runs.
    #   Pass 2 — strip non-digits, keep only valid 10-digit numbers
    #            starting with 6, 7, 8, or 9.
    # This handles unusual spacing ("98765 43210") that a rigid
    # 3+3+4 split regex would silently miss.
    # ------------------------------------------------------------------
    phone_numbers_set = set()
    for candidate in _PHONE_CANDIDATE_RE.finditer(text):
        digits_only = re.sub(r"\D", "", candidate.group())
        # Strip leading country code if present
        if len(digits_only) == 12 and digits_only.startswith("91"):
            digits_only = digits_only[2:]
        if len(digits_only) == 10 and digits_only[0] in "6789":
            phone_numbers_set.add(digits_only)

    phone_numbers = sorted(phone_numbers_set)

    # ------------------------------------------------------------------
    # 3. MONITORED KEYWORDS / WEAPONS
    # Word-boundary matching so "knife" doesn't match inside "jackknife".
    # Multi-word phrases use a space-or-start lookbehind instead.
    # ------------------------------------------------------------------
    text_lower = text.lower()
    flagged_keywords = []
    for keyword in MONITORED_KEYWORDS:
        if " " in keyword:
            pattern = r"(?<![a-z])" + re.escape(keyword) + r"(?![a-z])"
        else:
            pattern = r"\b" + re.escape(keyword) + r"\b"
        if re.search(pattern, text_lower):
            flagged_keywords.append(keyword)

    # ------------------------------------------------------------------
    # 4. MONETARY AMOUNTS
    # Each regex match is a 2-tuple (prefix_group, suffix_group);
    # exactly one will be non-empty — pick whichever is populated.
    # ------------------------------------------------------------------
    monetary_amounts = []
    seen_amounts = set()
    for prefix_grp, suffix_grp in _MONEY_RE.findall(text):
        amount_str = prefix_grp if prefix_grp else suffix_grp
        if amount_str and amount_str not in seen_amounts:
            seen_amounts.add(amount_str)
            monetary_amounts.append(amount_str)

    return {
        "vehicle_numbers":  vehicle_numbers,
        "phone_numbers":    phone_numbers,
        "flagged_keywords": flagged_keywords,
        "monetary_amounts": monetary_amounts,
    }


# =========================================================
# SAMPLE TEST — run directly with: python parser.py
# =========================================================

SAMPLE_LOG = """
FIR No. 0142/2024  |  Delhi — Karol Bagh Division  |  17-Nov-2024

Complainant Ramesh Nayak (ph: 98765 43210) reported that on the night of
15-Nov-2024 at approx. 23:40 hrs, four unknown persons arrived on a white
Maruti Suzuki Swift bearing registration DL-05-NB-5678 and forcibly
snatched his laptop bag near Connaught Place. One suspect was armed
with a knife and another was seen carrying what appeared to be a pistol.
The gang fled towards Karol Bagh.

A second witness (mob. 7760912345) stated she saw the same vehicle,
also noted as DL05NB5678 in her complaint, parked outside an ATM at
23:15 hrs. The suspects withdrew Rs. 50,000 using a stolen debit card
before the snatching.

A third tip-off received on 9845600001 mentions a hideout on the city
outskirts where stolen goods worth INR 1,20,000 and one countrymade gun
were reportedly stored. A separate vehicle, MH-12-AB-3456, was spotted
leaving the hideout. Cash of 75000 rupees was also recovered from the
premises. Suspect Imran Khan (alias "Tiger") is believed to be the
gang leader. Further investigation underway.
"""


if __name__ == "__main__":
    print("=" * 60)
    print("  Detectra — Log Parser  |  Entity Extraction Test")
    print("=" * 60)
    print("\n[ RAW INPUT LOG ]\n")
    print(SAMPLE_LOG)
    print("\n[ EXTRACTED ENTITIES ]\n")

    result = parse_police_log(SAMPLE_LOG)
    print(json.dumps(result, indent=4, ensure_ascii=False))

    print("\n[ FIELD SUMMARY ]\n")
    print(f"  Vehicle numbers found  : {len(result['vehicle_numbers'])}")
    print(f"  Phone numbers found    : {len(result['phone_numbers'])}")
    print(f"  Flagged keywords       : {len(result['flagged_keywords'])}")
    print(f"  Monetary amounts found : {len(result['monetary_amounts'])}")
    print()