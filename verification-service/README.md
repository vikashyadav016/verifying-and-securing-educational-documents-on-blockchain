# Verification Service

Verifies a certificate PDF against the blockchain registry.

## Run

```bash
pip install -r requirements.txt
python app.py
```

## Endpoints

- `POST /verify` (multipart form with `certificate`) -> JSON response
- `GET /health`

## Environment

- `PORT` (default: 5002)
- `RPC_URL`
- `CONTRACT_ADDRESS`
