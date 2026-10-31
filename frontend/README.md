# Frontend

This folder contains the static web interface for the certificate registry workflow.

## Run locally

From the project root:

```bash
python -m http.server 8080 --directory frontend
```

Then open:

```text
http://localhost:8080/login.html
```

## Included pages

- `login.html` - entry page for user selection
- `school-register.html` - school registration form
- `school-login.html` - school login
- `school-dashboard.html` - school management interface
- `admin-login.html` - admin login page
- `admin.html` - admin dashboard

## API configuration

If your backend is hosted elsewhere, update the base URLs in the JavaScript files to match your deployment environment.
