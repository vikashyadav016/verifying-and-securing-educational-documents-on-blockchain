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
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

if PRIVATE_KEY:
    print("[blockchain-service] PRIVATE_KEY is configured.")
else:
    print("[blockchain-service] PRIVATE_KEY is not set.")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me")
MAX_BATCH_CERTIFICATES = 200
CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32[]", "name": "_documentHashes", "type": "bytes32[]"}
        ],
        "name": "batchIssueCertificates",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
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
    },
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
    contract = web3.eth.contract(address=checksum_address, abi=CONTRACT_ABI)
    return web3, contract


def get_account(web3):
    global PRIVATE_KEY
    if not PRIVATE_KEY:
        raise RuntimeError("Missing PRIVATE_KEY. Set the PRIVATE_KEY environment variable before starting the service.")
    return web3.eth.account.from_key(PRIVATE_KEY)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


def hash_uploaded_files(files):
    document_hashes = []
    seen_hashes = set()
    skipped_existing = 0

    _, contract = build_contract()

    for file in files:
        doc_hash = get_pdf_hash(file)
        if doc_hash in seen_hashes:
            continue

        is_valid, _ = contract.functions.verifyCertificate(doc_hash).call()
        if is_valid:
            skipped_existing += 1
            continue

        seen_hashes.add(doc_hash)
        document_hashes.append(doc_hash)

    return document_hashes, skipped_existing


@app.route("/upload", methods=["POST"])
def upload_document():
    provided_password = request.form.get("password")
    if provided_password != ADMIN_PASSWORD:
        return jsonify({"error": "Unauthorized. Invalid Admin Password."}), 401

    if "certificate" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["certificate"]

    try:
        web3, contract = build_contract()
        account = get_account(web3)

        doc_hash = get_pdf_hash(file)

        is_valid, _ = contract.functions.verifyCertificate(doc_hash).call()
        if is_valid:
            return jsonify({"status": "Exists", "message": "Certificate is already on the blockchain!"})

        nonce = web3.eth.get_transaction_count(account.address)
        tx = contract.functions.batchIssueCertificates([doc_hash]).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
            }
        )

        signed_tx = web3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
        web3.eth.wait_for_transaction_receipt(tx_hash)

        tx_hex = web3.to_hex(tx_hash)
        return jsonify(
            {
                "status": "Success",
                "message": f"Uploaded successfully! TX Hash: {tx_hex}",
                "tx_hash": tx_hex,
                "tx_url": f"https://sepolia.etherscan.io/tx/{tx_hex}",
            }
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/bulk-upload", methods=["POST"])
def bulk_upload_document():
    provided_password = request.form.get("password")
    if provided_password != ADMIN_PASSWORD:
        return jsonify({"error": "Unauthorized. Invalid Admin Password."}), 401

    files = request.files.getlist("certificates")
    if not files and "certificate" in request.files:
        files = [request.files["certificate"]]

    if not files:
        return jsonify({"error": "No files uploaded"}), 400
    if len(files) > MAX_BATCH_CERTIFICATES:
        return jsonify({"error": f"You can upload at most {MAX_BATCH_CERTIFICATES} certificates at once."}), 400

    try:
        web3, contract = build_contract()
        account = get_account(web3)

        document_hashes, skipped_existing = hash_uploaded_files(files)
        if not document_hashes:
            return jsonify(
                {
                    "status": "Exists",
                    "message": "All selected certificates are already on the blockchain.",
                    "uploaded": 0,
                    "skipped": skipped_existing,
                }
            )

        nonce = web3.eth.get_transaction_count(account.address)
        tx = contract.functions.batchIssueCertificates(document_hashes).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
            }
        )

        signed_tx = web3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)
        web3.eth.wait_for_transaction_receipt(tx_hash)

        tx_hex = web3.to_hex(tx_hash)
        return jsonify(
            {
                "status": "Success",
                "message": f"Uploaded {len(document_hashes)} certificate(s) successfully! TX Hash: {tx_hex}",
                "uploaded": len(document_hashes),
                "skipped": skipped_existing,
                "tx_hash": tx_hex,
                "tx_url": f"https://sepolia.etherscan.io/tx/{tx_hex}",
            }
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5003"))
    debug = os.getenv("DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=debug)
