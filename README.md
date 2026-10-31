# Certificate Registry and Verification Platform

This project demonstrates a blockchain-backed certificate registry and verification workflow built with a lightweight microservice architecture.

## Overview

- `frontend` - role-based web interface for schools, admins, and public verification
- `certificate-service` - PDF certificate creation and metadata handling
- `verification-service` - blockchain verification of certificate hashes
- `blockchain-service` - upload of certificate hashes to an Ethereum-compatible network
- `registry-service` - school approval workflow and certificate metadata records
- `common` - shared helpers for PDF generation and hashing

## Suggested local ports

- Frontend: 8080
- Certificate service: 5001
- Verification service: 5002
- Blockchain service: 5003
- Registry service: 5004

## Quick start

1. Create and activate a virtual environment.
2. Install dependencies for the required services:

```bash
pip install -r blockchain-service/requirements.txt
pip install -r certificate-service/requirements.txt
pip install -r verification-service/requirements.txt
pip install -r registry-service/requirements.txt
```

3. Set the required environment variables before starting the services:

```bash
export RPC_URL="https://sepolia.infura.io/v3/<project-id>"
export CONTRACT_ADDRESS="<deployed-contract-address>"
export PRIVATE_KEY="<wallet-private-key>"
export ADMIN_PASSWORD="change-this-password"
```

4. Start all services together:

```bash
python run_all.py
```

5. Open the frontend in a browser:

```text
http://localhost:8080
```

## Security note

Never commit real wallet keys, seed phrases, contract addresses, or production credentials to source control. Keep them in local environment variables or a private `.env` file that is excluded from Git.
