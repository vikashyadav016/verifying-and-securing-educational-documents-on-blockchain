# Blockchain Upload Service

Uploads certificate hashes to an Ethereum-compatible blockchain network.

## Run

```bash
pip install -r requirements.txt
python app.py
```

## Endpoints

- `POST /upload` - upload a certificate file and admin password
- `POST /bulk-upload` - upload multiple certificate files in one request
- `GET /health` - service health check

## Environment

- `PORT` (default: 5003)
- `RPC_URL` - blockchain RPC endpoint
- `CONTRACT_ADDRESS` - deployed contract address
- `PRIVATE_KEY` - signing wallet key for blockchain transactions
- `ADMIN_PASSWORD` - password required for upload endpoints

## Security

Do not commit real keys or wallets to Git. Store them in a private local environment and keep them out of source control.
