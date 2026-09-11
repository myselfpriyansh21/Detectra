"""
backend/app.py
------------------------------------
Detectra backend — standalone Flask app (Python 3.9+)
PS-189: AI-Powered Criminal Network Analysis System

Runs independently of any PaaS-specific function runtime — deploy it
anywhere that runs a WSGI app (Railway, Render, a plain VM, etc).

Routes:
    GET  /health              -> liveness check
    POST /cluster              -> DBSCAN hotspot clustering (map tab)
    POST /parse_fir            -> Claude-powered FIR entity extraction,
                                   with a regex fallback if no API key
                                   is configured
    POST /community            -> Louvain community detection on the
                                   criminal network graph (falls back to
                                   greedy modularity if python-louvain
                                   isn't installed)

Run locally:
    pip install -r requirements.txt
    python app.py                 # listens on :9000, matches vite.config.ts proxy
"""

import json
import logging
import os
import re

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.cluster import DBSCAN

import parser as fir_parser  # backend/parser.py — regex entity extractor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # dev convenience; tighten origins before a real deployment

DEFAULT_EPS = 0.5           # degrees — wide default since incidents can
                             # now span multiple metro cities, not one city
DEFAULT_MIN_SAMPLES = 3


# =========================================================
# DBSCAN HOTSPOT CLUSTERING
# =========================================================

def find_dense_hotspots(incidents: list, eps: float, min_samples: int) -> dict:
    """Run DBSCAN on a list of incident dicts and return cluster centers.
    Noise points (label == -1) are excluded from center calculations."""
    if not incidents:
        return {"hotspots": [], "noise_count": 0, "total_incidents": 0}

    coords = np.array([[p["latitude"], p["longitude"]] for p in incidents])
    severities = np.array([p.get("severity_score", 1) for p in incidents])

    labels = DBSCAN(eps=eps, min_samples=min_samples).fit_predict(coords)

    noise_count = int(np.sum(labels == -1))
    unique_clusters = sorted(set(labels[labels != -1]))

    hotspots = []
    for cluster_id in unique_clusters:
        mask = labels == cluster_id
        cluster_coords = coords[mask]
        cluster_severities = severities[mask]
        hotspots.append({
            "cluster_id": int(cluster_id),
            "center_lat": round(float(cluster_coords[:, 0].mean()), 6),
            "center_lon": round(float(cluster_coords[:, 1].mean()), 6),
            "incident_count": int(mask.sum()),
            "avg_severity": round(float(cluster_severities.mean()), 2),
        })

    hotspots.sort(key=lambda h: h["incident_count"], reverse=True)
    return {"hotspots": hotspots, "noise_count": noise_count, "total_incidents": len(incidents)}


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "detectra-backend"})


@app.route("/cluster", methods=["POST"])
def cluster():
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"status": "error", "message": "Request body must be valid JSON."}), 400

    incidents = body.get("incidents", [])
    if not isinstance(incidents, list):
        return jsonify({"status": "error", "message": "'incidents' must be a JSON array."}), 400

    for i, inc in enumerate(incidents):
        if "latitude" not in inc or "longitude" not in inc:
            return jsonify({"status": "error", "message": f"Incident at index {i} is missing 'latitude' or 'longitude'."}), 400

    eps = float(body.get("eps", DEFAULT_EPS))
    min_samples = int(body.get("min_samples", DEFAULT_MIN_SAMPLES))

    logger.info("Clustering %d incidents | eps=%.4f | min_samples=%d", len(incidents), eps, min_samples)
    try:
        result = find_dense_hotspots(incidents, eps=eps, min_samples=min_samples)
    except Exception:
        logger.exception("DBSCAN failed")
        return jsonify({"status": "error", "message": "Clustering failed. Check server logs."}), 500

    return jsonify({"status": "success", **result})


# =========================================================
# FIR ENTITY EXTRACTION — Claude Sonnet, regex fallback
# =========================================================

@app.route("/parse_fir", methods=["POST"])
def parse_fir():
    body = request.get_json(silent=True)
    if not body or "text" not in body:
        return jsonify({"status": "error", "message": "Missing 'text' field"}), 400

    fir_text = body["text"]

    try:
        import anthropic

        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""Extract structured information from this police FIR text.
Return ONLY a valid JSON object — no explanation, no markdown, no backticks.

Required JSON format:
{{
  "suspects": ["full name 1", "full name 2"],
  "vehicles": ["DL-05-NB-1234"],
  "weapons": ["pistol", "knife"],
  "phone_numbers": ["9876543210"],
  "locations": ["area or landmark name, any city"],
  "gang_affiliations": ["Gang name"],
  "evidence": ["Gold chain", "Crowbar"],
  "crime_type": "Chain Snatching",
  "crime_hour": 22,
  "severity_score": 7,
  "case_summary": "One sentence summary of the incident for an officer."
}}

Rules:
- crime_type must be one of: Chain Snatching, Burglary, Assault, Vehicle Theft, Financial Fraud, Social Media Fraud, Unknown
- crime_hour is 0-23 integer
- severity_score is 1-10 integer based on violence/impact
- locations are whatever area/landmark names appear in the text — the
  platform is national, so do not assume any single city
- If a field has no data, use an empty array [] or sensible default

FIR Text:
{fir_text}"""
            }]
        )

        result = json.loads(message.content[0].text)
        result["status"] = "success"
        result["method"] = "claude"
        return jsonify(result)

    except Exception as exc:
        logger.warning("Claude API unavailable: %s — falling back to regex", exc)

    # Regex fallback — reuses backend/parser.py
    try:
        extracted = fir_parser.parse_police_log(fir_text)
        t = fir_text.lower()

        crime_map = {
            'snatch': 'Chain Snatching', 'chain': 'Chain Snatching',
            'burgl': 'Burglary', 'theft': 'Vehicle Theft',
            'assault': 'Assault', 'attack': 'Assault',
            'phishing': 'Financial Fraud', 'upi': 'Financial Fraud',
            'otp': 'Financial Fraud', 'bank fraud': 'Financial Fraud',
            'investment scam': 'Financial Fraud', 'fraud': 'Financial Fraud',
            'fake profile': 'Social Media Fraud', 'catfish': 'Social Media Fraud',
            'sextortion': 'Social Media Fraud', 'impersonat': 'Social Media Fraud',
        }
        crime_type = 'Unknown'
        for kw, ct in crime_map.items():
            if kw in t:
                crime_type = ct
                break

        hour_match = re.search(r'(\d{1,2})[:\s]?\d{0,2}\s*(hrs?|am|pm)', t)
        crime_hour = 22
        if hour_match:
            h = int(hour_match.group(1))
            if 'pm' in hour_match.group(2) and h < 12:
                h += 12
            crime_hour = h % 24

        result = {
            "status": "success",
            "method": "regex",
            "suspects": [],
            "vehicles": extracted["vehicle_numbers"],
            "weapons": extracted["flagged_keywords"],
            "phone_numbers": extracted["phone_numbers"],
            "locations": [],
            "gang_affiliations": [],
            "evidence": extracted["flagged_keywords"],
            "crime_type": crime_type,
            "crime_hour": crime_hour,
            "severity_score": 6,
            "case_summary": f"Incident parsed via pattern matching. Type: {crime_type}.",
        }
        return jsonify(result)

    except Exception:
        logger.exception("FIR parsing failed")
        return jsonify({"status": "error", "message": "Parsing failed."}), 500


# =========================================================
# SCAN WRITTEN REPORT — Claude vision transcribes + extracts
# in one pass from a photographed/scanned FIR or report.
# No offline fallback exists for this route (OCR needs a real
# vision model), so it returns a clear error if the API key
# isn't configured rather than silently failing.
# =========================================================

@app.route("/scan_report", methods=["POST"])
def scan_report():
    body = request.get_json(silent=True)
    if not body or "image_base64" not in body:
        return jsonify({"status": "error", "message": "Missing 'image_base64' field"}), 400

    image_base64 = body["image_base64"]
    media_type = body.get("media_type", "image/jpeg")

    try:
        import anthropic

        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1200,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_base64},
                    },
                    {
                        "type": "text",
                        "text": """This image is a photograph or scan of a handwritten or printed police
report (FIR, complaint, or intelligence note). First transcribe the
visible text as accurately as possible, then extract structured
information from it.

Return ONLY a valid JSON object — no explanation, no markdown, no backticks.

Required JSON format:
{
  "transcript": "Best-effort transcription of the report text.",
  "suspects": ["full name 1", "full name 2"],
  "vehicles": ["DL-05-NB-1234"],
  "weapons": ["pistol", "knife"],
  "phone_numbers": ["9876543210"],
  "locations": ["area or landmark name, any city"],
  "gang_affiliations": ["Gang name"],
  "evidence": ["Gold chain", "Crowbar"],
  "crime_type": "Chain Snatching",
  "crime_hour": 22,
  "severity_score": 7,
  "case_summary": "One sentence summary of the incident for an officer."
}

Rules:
- crime_type must be one of: Chain Snatching, Burglary, Assault, Vehicle Theft, Financial Fraud, Social Media Fraud, Unknown
- crime_hour is 0-23 integer
- severity_score is 1-10 integer based on violence/impact
- locations are whatever area/landmark names appear in the text — the
  platform is national, so do not assume any single city
- If the handwriting is partly illegible, transcribe what you can and
  leave uncertain fields empty rather than guessing
- If a field has no data, use an empty array [] or sensible default""",
                    },
                ],
            }],
        )

        result = json.loads(message.content[0].text)
        result["status"] = "success"
        result["method"] = "claude-vision"
        return jsonify(result)

    except Exception:
        logger.exception("Report scan failed")
        return jsonify({
            "status": "error",
            "message": "Could not scan this image. Make sure the server has ANTHROPIC_API_KEY configured, or type the report text manually instead.",
        }), 500


# =========================================================
# LOUVAIN COMMUNITY DETECTION
# Groups the criminal network into densely-connected clusters —
# this is how Detectra surfaces distinct gangs/cells from a single
# fused graph, and directly implements the "detect suspicious
# patterns" + "key influencers" requirements of PS-189.
# =========================================================

@app.route("/community", methods=["POST"])
def community():
    body = request.get_json(silent=True)
    if not body or "nodes" not in body or "edges" not in body:
        return jsonify({"status": "error", "message": "Request must include 'nodes' and 'edges'."}), 400

    node_ids = [n["id"] for n in body["nodes"]]
    edges = [(e["source"], e["target"], float(e.get("weight", 1))) for e in body["edges"]]

    try:
        import networkx as nx

        G = nx.Graph()
        G.add_nodes_from(node_ids)
        for s, t, w in edges:
            G.add_edge(s, t, weight=w)

        method = "louvain"
        try:
            import community as community_louvain  # python-louvain package, imports as `community`
            partition = community_louvain.best_partition(G, weight="weight")
        except ImportError:
            # Fallback: networkx's built-in greedy modularity communities
            # (no external dependency, similar spirit to Louvain)
            method = "greedy_modularity"
            communities = nx.algorithms.community.greedy_modularity_communities(G, weight="weight")
            partition = {}
            for idx, comm in enumerate(communities):
                for node in comm:
                    partition[node] = idx

        # PageRank for "key influencer" identification, computed on the
        # same graph so both signals come from one backend call.
        pagerank = nx.pagerank(G, weight="weight") if G.number_of_edges() > 0 else {n: 0.0 for n in node_ids}

        return jsonify({
            "status": "success",
            "method": method,
            "communities": partition,          # { node_id: community_index }
            "page_rank": pagerank,              # { node_id: score }
            "community_count": len(set(partition.values())) if partition else 0,
        })

    except ImportError:
        return jsonify({"status": "error", "message": "networkx is not installed on the server."}), 500
    except Exception:
        logger.exception("Community detection failed")
        return jsonify({"status": "error", "message": "Community detection failed. Check server logs."}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 9000))
    app.run(host="0.0.0.0", port=port, debug=True)
