import hashlib
import json
import re

import pdfplumber


def extract_pdf_metadata(pdf_file_stream):
    extracted_data = {
        "student_info": {},
        "marks": {},
        "performance": {},
    }

    pdf_file_stream.seek(0)
    with pdfplumber.open(pdf_file_stream) as pdf:
        if not pdf.pages:
            raise ValueError("PDF has no pages.")

        text = pdf.pages[0].extract_text() or ""
        tables = pdf.pages[0].extract_tables() or []

        id_match = re.search(r"Student ID:?\s*(\d+)", text, re.IGNORECASE)
        if id_match:
            extracted_data["student_info"]["id"] = id_match.group(1)

        name_match = re.search(
            r"Name:?\s*([A-Za-z\s]+?)(?:Gender|School|\n|$)",
            text,
            re.IGNORECASE,
        )
        if name_match:
            extracted_data["student_info"]["name"] = name_match.group(1).strip()

        board_match = re.search(
            r"Board:?\s*([A-Za-z0-9&./\-\s]+?)(?:Session|\n|$)",
            text,
            re.IGNORECASE,
        )
        if board_match:
            extracted_data["student_info"]["board"] = board_match.group(1).strip()

        session_match = re.search(
            r"Session:?\s*([0-9]{4}\s*-\s*[0-9]{4})",
            text,
            re.IGNORECASE,
        )
        if session_match:
            extracted_data["student_info"]["session"] = session_match.group(1).replace(" ", "")

        total_match = re.search(
            r"Total Marks:?\s*([0-9]+\s*/\s*[0-9]+)",
            text,
            re.IGNORECASE,
        )
        if total_match:
            extracted_data["performance"]["total_marks"] = total_match.group(1)

        percentage_match = re.search(r"Percentage:?\s*([\d\.]+%)", text, re.IGNORECASE)
        if percentage_match:
            extracted_data["performance"]["percentage"] = percentage_match.group(1)

        grade_match = re.search(r"Academic Grade:?\s*([A-Z]\+?)", text, re.IGNORECASE)
        if not grade_match:
            grade_match = re.search(r"Grade:?\s*([A-Z]\+?)", text, re.IGNORECASE)
        if grade_match:
            extracted_data["performance"]["grade"] = grade_match.group(1)

        for table in tables:
            for row in table:
                if row and len(row) >= 2 and str(row[1]).strip().isdigit():
                    label = str(row[0]).strip()
                    label_key = re.sub(r"[:\s]+$", "", label).lower()
                    if label_key not in {"student id", "id"}:
                        extracted_data["marks"][label] = int(str(row[1]).strip())

        if not extracted_data["marks"]:
            in_subjects = False
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                if re.match(r"^Subject\s+Marks$", line, re.IGNORECASE):
                    in_subjects = True
                    continue
                if in_subjects and re.match(r"^Total\s+Marks", line, re.IGNORECASE):
                    break
                if in_subjects:
                    row_match = re.match(r"^([A-Za-z][A-Za-z\s&\-.]+?)\s+(\d{1,3})$", line)
                    if row_match:
                        label = row_match.group(1).strip()
                        label_key = re.sub(r"[:\s]+$", "", label).lower()
                        if label_key not in {"student id", "id"}:
                            extracted_data["marks"][label] = int(row_match.group(2))

    return extracted_data


def compute_document_hash(metadata):
    json_string = json.dumps(metadata, sort_keys=True, separators=(",", ":"))
    return f"0x{hashlib.sha256(json_string.encode('utf-8')).hexdigest()}"


def get_pdf_hash(pdf_file_stream):
    metadata = extract_pdf_metadata(pdf_file_stream)
    return compute_document_hash(metadata)
