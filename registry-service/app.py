import hashlib
import os
import sys
import uuid
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_COMMON_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "common"))
if BASE_COMMON_DIR not in sys.path:
    sys.path.insert(0, BASE_COMMON_DIR)

from pdf_hash import get_pdf_hash
from db import get_connection, init_db

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


def init_test_data():
    init_db()
    print("[registry-service] Database initialized")


def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def is_admin(request_obj):
    user = request_obj.headers.get("X-Admin-User")
    password = request_obj.headers.get("X-Admin-Password")
    return user == ADMIN_USER and password == ADMIN_PASSWORD


def hash_password(school_id, password):
    value = f"{school_id}:{password}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def fetch_school(school_id):
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM schools WHERE school_id = ?",
            (school_id,),
        ).fetchone()


def get_school(school_id, password, require_approved=True):
    school = fetch_school(school_id)
    if not school:
        return None
    if school["password_hash"] != hash_password(school_id, password):
        return None
    if require_approved and school["status"] != "approved":
        return None
    return school


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/admin/login", methods=["POST"])
def admin_login():
    payload = request.get_json(silent=True) or {}
    user = payload.get("username")
    password = payload.get("password")
    if user != ADMIN_USER or password != ADMIN_PASSWORD:
        return jsonify({"error": "Invalid admin credentials."}), 401
    return jsonify({"status": "ok"})


@app.route("/school/register", methods=["POST"])
def register_school():
    payload = request.get_json(silent=True) or {}
    school_id = str(payload.get("school_id", "")).strip()
    name = str(payload.get("name", "")).strip()
    board = str(payload.get("board", "")).strip()
    password = str(payload.get("password", "")).strip()
    chairman_name = str(payload.get("chairman_name", "")).strip()
    class_teacher_name = str(payload.get("class_teacher_name", "")).strip()
    principal_name = str(payload.get("principal_name", "")).strip()

    if not school_id or not name or not board or not password:
        return jsonify({"error": "school_id, name, board, and password are required."}), 400
    if not chairman_name or not class_teacher_name or not principal_name:
        return jsonify(
            {
                "error": "chairman_name, class_teacher_name, and principal_name are required.",
            }
        ), 400

    password_hash = hash_password(school_id, password)

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT school_id, password_hash, status FROM schools WHERE school_id = ?",
            (school_id,),
        ).fetchone()

        if existing:
            if existing["password_hash"] != password_hash:
                return jsonify({"error": "School ID already registered with a different password."}), 403
            if existing["status"] == "approved":
                return jsonify({"status": "approved", "message": "School already approved."})
            if existing["status"] == "pending":
                conn.execute(
                    """
                    UPDATE schools
                    SET name = ?, board = ?, chairman_name = ?, class_teacher_name = ?, principal_name = ?,
                        contact_name = ?, email = ?, phone = ?, address = ?, submitted_at = ?
                    WHERE school_id = ?
                    """,
                    (
                        name,
                        board,
                        chairman_name,
                        class_teacher_name,
                        principal_name,
                        str(payload.get("contact_name", "")).strip(),
                        str(payload.get("email", "")).strip(),
                        str(payload.get("phone", "")).strip(),
                        str(payload.get("address", "")).strip(),
                        now_iso(),
                        school_id,
                    ),
                )
                conn.commit()
                return jsonify({"status": "pending", "message": "School request already pending.", "request_id": school_id})
            if existing["status"] == "rejected":
                conn.execute(
                    """
                    UPDATE schools
                    SET name = ?, board = ?, chairman_name = ?, class_teacher_name = ?, principal_name = ?,
                        contact_name = ?, email = ?, phone = ?, address = ?,
                        status = ?, submitted_at = ?, rejected_at = NULL
                    WHERE school_id = ?
                    """,
                    (
                        name,
                        board,
                        chairman_name,
                        class_teacher_name,
                        principal_name,
                        str(payload.get("contact_name", "")).strip(),
                        str(payload.get("email", "")).strip(),
                        str(payload.get("phone", "")).strip(),
                        str(payload.get("address", "")).strip(),
                        "pending",
                        now_iso(),
                        school_id,
                    ),
                )
                conn.commit()
                return jsonify({"status": "pending", "request_id": school_id})

        conn.execute(
            """
            INSERT INTO schools (
                school_id, name, board, password_hash, chairman_name, class_teacher_name, principal_name,
                contact_name, email, phone, address, status, submitted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                school_id,
                name,
                board,
                password_hash,
                chairman_name,
                class_teacher_name,
                principal_name,
                str(payload.get("contact_name", "")).strip(),
                str(payload.get("email", "")).strip(),
                str(payload.get("phone", "")).strip(),
                str(payload.get("address", "")).strip(),
                "pending",
                now_iso(),
            ),
        )
        conn.commit()

    return jsonify({"status": "pending", "request_id": school_id})


@app.route("/school/status", methods=["POST"])
def school_status():
    payload = request.get_json(silent=True) or {}
    school_id = str(payload.get("school_id", "")).strip()
    password = str(payload.get("password", "")).strip()
    if not school_id or not password:
        return jsonify({"error": "school_id and password are required."}), 400

    school = fetch_school(school_id)
    if not school:
        return jsonify({"status": "not_found"})
    if school["password_hash"] != hash_password(school_id, password):
        return jsonify({"error": "Invalid school credentials."}), 401
    return jsonify({"status": school["status"]})


@app.route("/school/login", methods=["POST"])
def school_login():
    payload = request.get_json(silent=True) or {}
    school_id = str(payload.get("school_id", "")).strip()
    password = str(payload.get("password", "")).strip()

    if not school_id or not password:
        return jsonify({"error": "school_id and password are required."}), 400

    school = get_school(school_id, password)
    if not school:
        return jsonify({"error": "Invalid school credentials."}), 401

    return jsonify({"status": "ok"})


@app.route("/school/profile", methods=["POST"])
def school_profile():
    payload = request.get_json(silent=True) or {}
    school_id = str(payload.get("school_id", "")).strip()
    password = str(payload.get("password", "")).strip()

    if not school_id or not password:
        return jsonify({"error": "school_id and password are required."}), 400

    school = get_school(school_id, password)
    if not school:
        return jsonify({"error": "Invalid school credentials."}), 401

    return jsonify(
        {
            "school_id": school["school_id"],
            "name": school["name"],
            "board": school["board"],
            "chairman_name": school["chairman_name"],
            "class_teacher_name": school["class_teacher_name"],
            "principal_name": school["principal_name"],
        }
    )


@app.route("/certificates/claim", methods=["POST"])
def claim_certificate():
    payload = request.get_json(silent=True) or {}
    school_id = str(payload.get("school_id", "")).strip()
    password = str(payload.get("password", "")).strip()
    student_id = str(payload.get("student_id", "")).strip()
    session = str(payload.get("session", "")).strip()

    if not school_id or not password or not student_id or not session:
        return jsonify({"error": "school_id, password, student_id, and session are required."}), 400

    school = get_school(school_id, password)
    if not school:
        return jsonify({"error": "School is not approved."}), 403

    board = school["board"]

    with get_connection() as conn:
        existing = conn.execute(
            """
            SELECT status FROM certificates
            WHERE student_id = ? AND board = ? AND session = ?
            """,
            (student_id, board, session),
        ).fetchone()
        if existing:
            return jsonify({"error": "Certificate already exists for this student, board, and session."}), 409

        conn.execute(
            """
            INSERT INTO certificates (
                student_id, board, session, school_id, status, reserved_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (student_id, board, session, school_id, "reserved", now_iso()),
        )
        conn.commit()

    return jsonify(
        {
            "status": "reserved",
            "school_name": school["name"],
            "board": school["board"],
            "chairman_name": school["chairman_name"],
            "class_teacher_name": school["class_teacher_name"],
            "principal_name": school["principal_name"],
        }
    )


@app.route("/school/submit-certificate", methods=["POST"])
def submit_certificate():
    school_id = str(request.form.get("school_id", "")).strip()
    password = str(request.form.get("password", "")).strip()
    student_id = str(request.form.get("student_id", "")).strip()
    session = str(request.form.get("session", "")).strip()
    first_name = str(request.form.get("first_name", "")).strip()
    last_name = str(request.form.get("last_name", "")).strip()
    gender = str(request.form.get("gender", "")).strip()

    if not school_id or not password or not student_id or not session:
        return jsonify({"error": "school_id, password, student_id, and session are required."}), 400

    school = get_school(school_id, password)
    if not school:
        return jsonify({"error": "School is not approved."}), 403
    board = school["board"]

    if "certificate" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["certificate"]
    submission_id = uuid.uuid4().hex
    filename = f"{school_id}_{student_id}_{submission_id}.pdf"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, filename)
    file.save(file_path)

    with open(file_path, "rb") as saved_file:
        pdf_hash = get_pdf_hash(saved_file)

    with get_connection() as conn:
        existing = conn.execute(
            """
            SELECT school_id, status FROM certificates
            WHERE student_id = ? AND board = ? AND session = ?
            """,
            (student_id, board, session),
        ).fetchone()
        if existing and existing["status"] == "uploaded":
            return jsonify({"error": "Certificate already uploaded for this student, board, and session."}), 409
        if existing and existing["school_id"] != school_id:
            return jsonify({"error": "Certificate already claimed by another school."}), 409

        conn.execute(
            """
            INSERT INTO certificates (
                student_id, board, session, school_id, first_name, last_name, gender,
                pdf_hash, filename, submission_id, status, submitted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, board, session)
            DO UPDATE SET
                school_id = excluded.school_id,
                first_name = COALESCE(excluded.first_name, certificates.first_name),
                last_name = COALESCE(excluded.last_name, certificates.last_name),
                gender = COALESCE(excluded.gender, certificates.gender),
                pdf_hash = excluded.pdf_hash,
                filename = excluded.filename,
                submission_id = excluded.submission_id,
                status = excluded.status,
                submitted_at = excluded.submitted_at
            """,
            (
                student_id,
                board,
                session,
                school_id,
                first_name or None,
                last_name or None,
                gender or None,
                pdf_hash,
                filename,
                submission_id,
                "pending",
                now_iso(),
            ),
        )
        conn.commit()

    return jsonify({"status": "submitted", "submission_id": submission_id, "pdf_hash": pdf_hash})


@app.route("/admin/requests", methods=["GET"])
def list_requests():
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT school_id, name, board, contact_name, email, submitted_at
            FROM schools
            WHERE status = ?
            ORDER BY submitted_at DESC
            """,
            ("pending",),
        ).fetchall()
    requests = [
        {
            "request_id": row["school_id"],
            "school_id": row["school_id"],
            "name": row["name"],
            "board": row["board"],
            "contact_name": row["contact_name"],
            "email": row["email"],
            "submitted_at": row["submitted_at"],
        }
        for row in rows
    ]
    return jsonify({"requests": requests})


@app.route("/admin/schools", methods=["GET"])
def list_approved_schools():
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT school_id, name, board, contact_name, email, approved_at
            FROM schools
            WHERE status = ?
            ORDER BY approved_at DESC
            """,
            ("approved",),
        ).fetchall()
    schools = [
        {
            "school_id": row["school_id"],
            "name": row["name"],
            "board": row["board"],
            "contact_name": row["contact_name"],
            "email": row["email"],
            "approved_at": row["approved_at"],
        }
        for row in rows
    ]
    return jsonify({"schools": schools})


@app.route("/admin/submissions", methods=["GET"])
def list_submissions():
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT submission_id, school_id, student_id, pdf_hash, status, submitted_at, uploaded_at
            FROM certificates
            WHERE submission_id IS NOT NULL
            ORDER BY submitted_at DESC
            """
        ).fetchall()
    submissions = [
        {
            "submission_id": row["submission_id"],
            "school_id": row["school_id"],
            "student_id": row["student_id"],
            "pdf_hash": row["pdf_hash"],
            "status": row["status"],
            "submitted_at": row["submitted_at"],
            "uploaded_at": row["uploaded_at"],
        }
        for row in rows
    ]
    return jsonify({"submissions": submissions})


@app.route("/admin/submissions/<submission_id>/file", methods=["GET"])
def download_submission(submission_id):
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401

    with get_connection() as conn:
        record = conn.execute(
            "SELECT filename FROM certificates WHERE submission_id = ?",
            (submission_id,),
        ).fetchone()
    if not record:
        return jsonify({"error": "Submission not found"}), 404

    return send_from_directory(UPLOAD_DIR, record["filename"], as_attachment=True)


@app.route("/admin/submissions/<submission_id>/mark-uploaded", methods=["POST"])
def mark_uploaded(submission_id):
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401

    with get_connection() as conn:
        record = conn.execute(
            "SELECT submission_id FROM certificates WHERE submission_id = ?",
            (submission_id,),
        ).fetchone()
        if not record:
            return jsonify({"error": "Submission not found"}), 404

        conn.execute(
            """
            UPDATE certificates
            SET status = ?, uploaded_at = ?
            WHERE submission_id = ?
            """,
            ("uploaded", now_iso(), submission_id),
        )
        conn.commit()
    return jsonify({"status": "updated"})


@app.route("/admin/requests/<request_id>/approve", methods=["POST"])
def approve_request(request_id):
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401

    with get_connection() as conn:
        record = conn.execute(
            "SELECT school_id FROM schools WHERE school_id = ? AND status = ?",
            (request_id, "pending"),
        ).fetchone()
        if not record:
            return jsonify({"error": "Request not found"}), 404

        conn.execute(
            """
            UPDATE schools
            SET status = ?, approved_at = ?
            WHERE school_id = ?
            """,
            ("approved", now_iso(), request_id),
        )
        conn.commit()

    return jsonify({"status": "approved", "school_id": request_id})


@app.route("/admin/requests/<request_id>/reject", methods=["POST"])
def reject_request(request_id):
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401

    with get_connection() as conn:
        record = conn.execute(
            "SELECT school_id FROM schools WHERE school_id = ? AND status = ?",
            (request_id, "pending"),
        ).fetchone()
        if not record:
            return jsonify({"error": "Request not found"}), 404

        conn.execute(
            """
            UPDATE schools
            SET status = ?, rejected_at = ?
            WHERE school_id = ?
            """,
            ("rejected", now_iso(), request_id),
        )
        conn.commit()

    return jsonify({"status": "rejected"})


@app.route("/admin/schools/<school_id>/reset-password", methods=["POST"])
def reset_school_password(school_id):
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401

    with get_connection() as conn:
        record = conn.execute(
            "SELECT school_id FROM schools WHERE school_id = ? AND status = ?",
            (school_id, "approved"),
        ).fetchone()
        if not record:
            return jsonify({"error": "School not found"}), 404

        payload = request.get_json(silent=True) or {}
        new_password = payload.get("password") or uuid.uuid4().hex[:10]
        conn.execute(
            "UPDATE schools SET password_hash = ? WHERE school_id = ?",
            (hash_password(school_id, new_password), school_id),
        )
        conn.commit()

    return jsonify({"status": "ok", "school_id": school_id, "new_password": new_password})


if __name__ == "__main__":
    init_test_data()
    port = int(os.getenv("PORT", "5004"))
    debug = os.getenv("DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=debug)
