import os
import sqlite3

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.getenv("REGISTRY_DB_PATH", os.path.join(BASE_DIR, "registry.db"))


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS schools (
                school_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                board TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                chairman_name TEXT,
                class_teacher_name TEXT,
                principal_name TEXT,
                contact_name TEXT,
                email TEXT,
                phone TEXT,
                address TEXT,
                status TEXT NOT NULL,
                submitted_at TEXT,
                approved_at TEXT,
                rejected_at TEXT
            );

            CREATE TABLE IF NOT EXISTS certificates (
                student_id TEXT NOT NULL,
                board TEXT NOT NULL,
                session TEXT NOT NULL,
                school_id TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                gender TEXT,
                pdf_hash TEXT,
                filename TEXT,
                submission_id TEXT,
                status TEXT NOT NULL,
                reserved_at TEXT,
                submitted_at TEXT,
                uploaded_at TEXT,
                PRIMARY KEY (student_id, board, session),
                FOREIGN KEY (school_id) REFERENCES schools (school_id)
            );

            CREATE INDEX IF NOT EXISTS idx_cert_submission_id
                ON certificates (submission_id);
            """
        )
        existing_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(schools)").fetchall()
        }
        missing_columns = {
            "chairman_name": "TEXT",
            "class_teacher_name": "TEXT",
            "principal_name": "TEXT",
        }
        for column, column_type in missing_columns.items():
            if column not in existing_columns:
                conn.execute(f"ALTER TABLE schools ADD COLUMN {column} {column_type}")
        conn.commit()
