# Registry Service

Tracks school approvals, certificate submissions, and used student IDs.

## Run

```bash
pip install -r requirements.txt
python app.py
```

## Endpoints

- `POST /school/register`
- `GET /school/status`
- `POST /school/login`
- `POST /certificates/claim`
- `POST /school/submit-certificate`
- `GET /admin/requests`
- `POST /admin/requests/<id>/approve`
- `POST /admin/requests/<id>/reject`
- `GET /admin/submissions`
- `GET /admin/submissions/<id>/file`
- `POST /admin/submissions/<id>/mark-uploaded`
- `GET /health`

## Environment

- `PORT` (default: 5004)
- `ADMIN_USER` (default: admin)
- `ADMIN_PASSWORD` (default: admin123)

## Notes

Pending requests and used IDs are still in memory. Approved schools are saved to `approved_schools.json` and reloaded on startup.
Submitted hashes are stored in memory and cleared when the registry service restarts.
