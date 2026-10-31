# Certificate Service

Generates a certificate PDF from JSON payloads.

## Run

```bash
pip install -r requirements.txt
python app.py
```

## Endpoints

- `POST /generate` (JSON) -> PDF response
- `GET /health`

## Environment

- `PORT` (default: 5001)
- `REGISTRY_URL` (default: http://localhost:5004)

## Required headers

`/generate` requires approved school credentials:

- `X-School-Id`
- `X-School-Password`
