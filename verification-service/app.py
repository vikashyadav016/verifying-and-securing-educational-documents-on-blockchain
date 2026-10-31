import os
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS
from web3 import Web3

BASE_DIR = os.path.dirname(__file__)
COMMON_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "common"))
if COMMON_DIR not in sys.path:
    sys.path.insert(0, COMMON_DIR)

from pdf_hash import get_pdf_hash

RPC_URL = os.getenv("RPC_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

VERIFY_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_documentHash", "type": "bytes32"}
        ],
        "name": "verifyCertificate",
        "outputs": [
            {"internalType": "bool", "name": "isValid", "type": "bool"},
            {"internalType": "uint256", "name": "issueDate", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]

app = Flask(__name__)
CORS(app)


def build_contract():
    if not RPC_URL:
        raise RuntimeError("Missing RPC_URL. Set the RPC_URL environment variable before starting the service.")
    if not CONTRACT_ADDRESS:
        raise RuntimeError("Missing CONTRACT_ADDRESS. Set the CONTRACT_ADDRESS environment variable before starting the service.")
    web3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not web3.is_connected():
        raise RuntimeError("RPC connection failed.")
    checksum_address = Web3.to_checksum_address(CONTRACT_ADDRESS)
    return web3, web3.eth.contract(address=checksum_address, abi=VERIFY_ABI)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/verify", methods=["POST"])
def verify_document():
    if "certificate" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["certificate"]

    try:
        _, contract = build_contract()
        doc_hash = get_pdf_hash(file)
        is_valid, issue_date = contract.functions.verifyCertificate(doc_hash).call()

        if is_valid:
            return jsonify(
                {
                    "status": "Verified",
                    "message": f"Certificate is authentic! Hash: {doc_hash}",
                    "issue_date": int(issue_date),
                }
            )
        return jsonify({"status": "Not Found", "message": "This certificate is NOT registered."})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5002"))
    debug = os.getenv("DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=debug)
