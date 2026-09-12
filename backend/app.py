"""
backend/app.py
------------------------------------
Detectra backend — standalone Flask app (Python 3.9+)
PS-189: AI-Powered Criminal Network Analysis System
Updated to use Google Gemini 2.5 Flash for text & multimodal FIR extraction.
"""

import json
import logging
import os
import re

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.cluster import DBSCAN

# Load .env locally if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import parser as fir_parser  # backend/parser.py

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

DEFAULT_EPS = 0.5
DEFAULT_MIN_SAMPLES = 3

# Initialize Gemini Client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
gemini_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Google Gemini Client successfully initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini Client: {e}")


# =========================================================
# DBSCAN HOTSPOT CLUSTERING
# =========================================================

def find_dense_hotspots(incidents: list, eps: float, min_samples: int) -> dict:
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

    try:
        result = find_dense_hotspots(incidents, eps=eps, min_samples=min_samples)
    except Exception:
        logger.exception("DBSCAN failed")
        return jsonify({"status": "error", "message": "Clustering failed. Check server logs."}), 500

    return jsonify({"status": "success", **result})


# =========================================================
# FIR ENTITY EXTRACTION — Gemini 2.5 Flash + Regex Fallback
# =========================================================

@app.route("/parse_fir", methods=["POST"])
def parse_fir():
    body = request.get_json(silent=True)
    if not body or "text" not in body:
        return jsonify({"status": "error", "message": "Missing 'text' field"}), 400

    fir_text = body["text"]

    # 1. Primary: Use Gemini via backend/parser.py
    try:
        parsed_result = fir_parser.parse_police_log(fir_text)
        return jsonify(parsed_result)
    except Exception as exc:
        logger.warning("Gemini parsing threw error: %s — using backup regex", exc)

    # 2. Local Fallback
    try:
        fallback_result = fir_parser._extract_via_regex(fir_text)
        return jsonify(fallback_result)
    except Exception:
        logger.exception("FIR parsing failed completely")
        return jsonify({"status": "error", "message": "Parsing failed."}), 500


# =========================================================
# SCAN WRITTEN REPORT — Gemini Multimodal Vision
# =========================================================

@app.route("/scan_report", methods=["POST"])
def scan_report():
    body = request.get_json(silent=True)
    if not body or "image_base64" not in body:
        return jsonify({"status": "error", "message": "Missing 'image_base64' field"}), 400

    if not gemini_client:
        return jsonify({"status": "error", "message": "GEMINI_API_KEY not configured on server."}), 500

    image_base64 = body["image_base64"]
    media_type = body.get("media_type", "image/jpeg")

    try:
        import base64
        from google.genai import types

        image_bytes = base64.b64decode(image_base64)

        prompt = """
        This image is a photograph or scan of a handwritten or printed police report (FIR, complaint, or note).
        Transcribe the text as accurately as possible and extract structured details into JSON.

        Required JSON structure:
        {
          "transcript": "Transcription of the report text.",
          "case_id": "FIR-043",
          "suspects": ["Suspect Name"],
          "vehicles": ["DL-05-NB-1234"],
          "weapons": ["pistol", "knife"],
          "phone_numbers": ["+919876543210"],
          "locations": ["Karol Bagh", "Delhi"],
          "gang_affiliations": ["D-Company"],
          "evidence": ["9mm Shells"],
          "crime_type": "Armed Robbery",
          "crime_hour": 21,
          "severity_score": 8,
          "case_summary": "One sentence summary of incident."
        }
        """

        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=media_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        result = json.loads(response.text)
        result["status"] = "success"
        result["method"] = "gemini-vision"
        return jsonify(result)

    except Exception:
        logger.exception("Report scan failed")
        return jsonify({
            "status": "error",
            "message": "Could not scan image with Gemini Vision.",
        }), 500


# =========================================================
# LOUVAIN COMMUNITY DETECTION
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
            import community as community_louvain
            partition = community_louvain.best_partition(G, weight="weight")
        except ImportError:
            method = "greedy_modularity"
            communities = nx.algorithms.community.greedy_modularity_communities(G, weight="weight")
            partition = {}
            for idx, comm in enumerate(communities):
                for node in comm:
                    partition[node] = idx

        pagerank = nx.pagerank(G, weight="weight") if G.number_of_edges() > 0 else {n: 0.0 for n in node_ids}

        return jsonify({
            "status": "success",
            "method": method,
            "communities": partition,
            "page_rank": pagerank,
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