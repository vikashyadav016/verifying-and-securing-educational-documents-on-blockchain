import os
import sys

import requests

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

BASE_DIR = os.path.dirname(__file__)
COMMON_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "common"))
if COMMON_DIR not in sys.path:
    sys.path.insert(0, COMMON_DIR)

from certificate_pdf import generate_certificate_pdf

REGISTRY_URL = os.getenv("REGISTRY_URL", "http://localhost:5004")

app = Flask(__name__)
CORS(app)


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/generate", methods=["POST"])
def generate_document():
    payload = request.get_json(silent=True) or {}
    school_id = request.headers.get("X-School-Id", "").strip()
    password = request.headers.get("X-School-Password", "").strip()
    student_id = str(payload.get("student_id", "")).strip()
    session = str(payload.get("session", "")).strip()

    if not school_id or not password:
        return jsonify({"error": "Missing school credentials."}), 401
    if not student_id:
        return jsonify({"error": "student_id is required."}), 400
    if not session:
        return jsonify({"error": "session is required."}), 400

    try:
        claim_response = requests.post(
            f"{REGISTRY_URL}/certificates/claim",
            json={"school_id": school_id, "password": password, "student_id": student_id, "session": session},
            timeout=10,
        )
        if claim_response.status_code != 200:
            data = claim_response.json() if claim_response.headers.get("Content-Type", "").startswith("application/json") else {}
            message = data.get("error", "Failed to reserve student ID.")
            return jsonify({"error": message}), claim_response.status_code
        claim_data = {}
        if claim_response.headers.get("Content-Type", "").startswith("application/json"):
            claim_data = claim_response.json()

        merged_payload = dict(payload)
        school_fields = {
            "school": clean_text(claim_data.get("school_name")),
            "board": clean_text(claim_data.get("board")),
            "chairman_name": clean_text(claim_data.get("chairman_name")),
            "class_teacher_name": clean_text(claim_data.get("class_teacher_name")),
            "principal_name": clean_text(claim_data.get("principal_name")),
        }
        for key, value in school_fields.items():
            if value:
                merged_payload[key] = value

        buffer, filename = generate_certificate_pdf(merged_payload)
        return send_file(
            buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to generate certificate: {exc}"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    debug = os.getenv("DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=debug)
