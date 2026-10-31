from datetime import datetime
from io import BytesIO
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Drawing, Line, String

SUBJECTS = [
    ("Mathematics", "math_score"),
    ("History", "history_score"),
    ("Physics", "physics_score"),
    ("Chemistry", "chemistry_score"),
    ("Biology", "biology_score"),
    ("English", "english_score"),
    ("Geography", "geography_score"),
]


def get_grade(percentage):
    if percentage >= 90:
        return "A+"
    if percentage >= 80:
        return "A"
    if percentage >= 70:
        return "B"
    if percentage >= 60:
        return "C"
    if percentage >= 50:
        return "D"
    return "F"


def get_curriculum_activities_grade(academic_grade):
    grade_hierarchy = {
        "F": "D",
        "D": "C",
        "C": "B",
        "B": "A",
        "A": "A+",
        "A+": "A+",
    }
    return grade_hierarchy.get(academic_grade, academic_grade)


def create_signature_image(name, role_label):
    drawing = Drawing(150, 80)
    drawing.add(Line(10, 20, 140, 20, strokeColor=colors.black, strokeWidth=1.5))

    sig_text = name or ""
    drawing.add(
        String(75, 35, sig_text, fontSize=9, textAnchor="middle", fontName="Helvetica-BoldOblique")
    )

    position_text = role_label or ""
    drawing.add(
        String(75, 50, position_text, fontSize=7, textAnchor="middle", fontName="Helvetica-Oblique")
    )

    return drawing


def parse_score(value):
    try:
        score = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, score))


def clean_text(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def build_filename(student_id, board, session):
    base = f"{student_id}_{board}_{session}"
    base = re.sub(r"[^A-Za-z0-9_]+", "_", base).strip("_")
    return f"{base or 'certificate'}.pdf"


def generate_certificate_pdf(payload):
    student_id = clean_text(payload.get("student_id")) or "000"
    first_name = clean_text(payload.get("first_name"))
    last_name = clean_text(payload.get("last_name"))
    gender = clean_text(payload.get("gender")) or "Not specified"
    school = clean_text(payload.get("school"))
    board = clean_text(payload.get("board"))
    session = clean_text(payload.get("session"))
    chairman_name = clean_text(payload.get("chairman_name"))
    class_teacher_name = clean_text(payload.get("class_teacher_name"))
    principal_name = clean_text(payload.get("principal_name"))

    missing_fields = []
    if not school:
        missing_fields.append("school")
    if not board:
        missing_fields.append("board")
    if not chairman_name:
        missing_fields.append("chairman_name")
    if not class_teacher_name:
        missing_fields.append("class_teacher_name")
    if not principal_name:
        missing_fields.append("principal_name")
    if missing_fields:
        raise ValueError(f"Missing required school details: {', '.join(missing_fields)}")

    if not first_name or not last_name:
        raise ValueError("First name and last name are required.")
    if not session:
        raise ValueError("Session is required.")

    subject_scores = []
    total_marks = 0
    for subject, key in SUBJECTS:
        score = parse_score(payload.get(key))
        subject_scores.append((subject, score))
        total_marks += score

    percentage = (total_marks / (len(SUBJECTS) * 100)) * 100
    grade = get_grade(percentage)
    curriculum_grade = get_curriculum_activities_grade(grade)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.3 * inch,
        leftMargin=0.3 * inch,
        topMargin=0.3 * inch,
        bottomMargin=0.3 * inch,
    )

    styles = getSampleStyleSheet()
    institute_style = ParagraphStyle(
        "InstituteHeader",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#c41e3a"),
        spaceAfter=2,
        alignment=1,
        fontName="Helvetica-Bold",
    )

    exam_style = ParagraphStyle(
        "ExamName",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#1a3a5c"),
        spaceAfter=8,
        alignment=1,
        fontName="Helvetica-Bold",
    )

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#1a3a5c"),
        spaceAfter=6,
        alignment=1,
        fontName="Helvetica-Bold",
    )

    story = []
    story.append(Paragraph(board, institute_style))
    story.append(Paragraph("10th Class Marksheet and Certificate", exam_style))
    story.append(Spacer(1, 0.08 * inch))
    story.append(Paragraph("Student Academic Record", title_style))
    story.append(Spacer(1, 0.08 * inch))

    student_info_data = [
        ["Student ID:", str(student_id), "Name:", f"{first_name} {last_name}"],
        ["Gender:", gender.capitalize(), "School:", school],
        ["Board:", board, "Session:", session],
    ]
    student_info_table = Table(student_info_data, colWidths=[1.2 * inch, 1.5 * inch, 1.2 * inch, 2.5 * inch])
    student_info_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#e8f0f7")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#b0c4de")),
            ]
        )
    )

    story.append(student_info_table)
    story.append(Spacer(1, 0.2 * inch))

    marks_data = [["Subject", "Marks"]]
    for subject, score in subject_scores:
        marks_data.append([subject, str(int(score))])

    marks_table = Table(marks_data, colWidths=[4 * inch, 1.5 * inch])
    marks_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4a7ba7")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 12),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#8b9dbe")),
                ("FONTSIZE", (0, 1), (-1, -1), 11),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
            ]
        )
    )

    story.append(marks_table)
    story.append(Spacer(1, 0.2 * inch))

    summary_data = [
        ["Total Marks:", f"{total_marks} / 700", "Percentage:", f"{percentage:.2f}%"],
        ["Academic Grade:", grade, "Curriculum Grade:", curriculum_grade],
    ]
    summary_table = Table(summary_data, colWidths=[1.5 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#d0e8f2")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#b0c4de")),
            ]
        )
    )

    story.append(summary_table)
    story.append(Spacer(1, 0.12 * inch))

    if percentage >= 40:
        cert_content = [
            [
                Paragraph(
                    "<b>CERTIFICATE OF ACHIEVEMENT</b>",
                    ParagraphStyle(
                        "CertTitle",
                        parent=styles["Normal"],
                        fontSize=11,
                        textColor=colors.HexColor("#006400"),
                        fontName="Helvetica-Bold",
                        alignment=1,
                    ),
                )
            ],
            [
                Paragraph(
                    f"<b><font size=12>{first_name} {last_name}</font></b>",
                    ParagraphStyle(
                        "StudentName",
                        parent=styles["Normal"],
                        fontSize=12,
                        textColor=colors.HexColor("#006400"),
                        fontName="Helvetica-Bold",
                        alignment=1,
                    ),
                )
            ],
            [
                Paragraph(
                    "has passed the 10th Class Board Examination",
                    ParagraphStyle(
                        "CertText",
                        parent=styles["Normal"],
                        fontSize=9,
                        textColor=colors.HexColor("#006400"),
                        alignment=1,
                    ),
                )
            ],
            [
                Paragraph(
                    f"<b>Score: {percentage:.2f}%</b> | <b>Grade: {grade}</b>",
                    ParagraphStyle(
                        "CertScore",
                        parent=styles["Normal"],
                        fontSize=10,
                        textColor=colors.HexColor("#006400"),
                        fontName="Helvetica-Bold",
                        alignment=1,
                    ),
                )
            ],
        ]

        inner_table = Table(cert_content, colWidths=[4.5 * inch])
        inner_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFACD")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("GRID", (0, 0), (-1, -1), 1.5, colors.HexColor("#006400")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )

        outer_table = Table([[inner_table]], colWidths=[4.7 * inch])
        outer_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#006400")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("GRID", (0, 0), (-1, -1), 2, colors.HexColor("#006400")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )

        story.append(outer_table)
    else:
        failed_content = [
            [
                Paragraph(
                    "<b>EXAMINATION RESULT</b>",
                    ParagraphStyle(
                        "FailTitle",
                        parent=styles["Normal"],
                        fontSize=11,
                        textColor=colors.HexColor("#8B0000"),
                        fontName="Helvetica-Bold",
                        alignment=1,
                    ),
                )
            ],
            [
                Paragraph(
                    f"<b><font size=12>{first_name} {last_name}</font></b>",
                    ParagraphStyle(
                        "StudentNameFail",
                        parent=styles["Normal"],
                        fontSize=12,
                        textColor=colors.HexColor("#8B0000"),
                        fontName="Helvetica-Bold",
                        alignment=1,
                    ),
                )
            ],
            [
                Paragraph(
                    "did not meet the passing criteria",
                    ParagraphStyle(
                        "FailText",
                        parent=styles["Normal"],
                        fontSize=9,
                        textColor=colors.HexColor("#8B0000"),
                        alignment=1,
                    ),
                )
            ],
            [
                Paragraph(
                    f"<b>Score: {percentage:.2f}%</b> | <b>Minimum: 40%</b>",
                    ParagraphStyle(
                        "FailScore",
                        parent=styles["Normal"],
                        fontSize=10,
                        textColor=colors.HexColor("#8B0000"),
                        fontName="Helvetica-Bold",
                        alignment=1,
                    ),
                )
            ],
        ]

        inner_table = Table(failed_content, colWidths=[4.5 * inch])
        inner_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFACD")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("GRID", (0, 0), (-1, -1), 1.5, colors.HexColor("#8B0000")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )

        outer_table = Table([[inner_table]], colWidths=[4.7 * inch])
        outer_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#8B0000")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("GRID", (0, 0), (-1, -1), 2, colors.HexColor("#8B0000")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )

        story.append(outer_table)

    story.append(Spacer(1, 0.1 * inch))
    signature_drawing = Table(
        [
            [
                create_signature_image(chairman_name, "Chairman of Board"),
                create_signature_image(class_teacher_name, "Class Teacher (10th)"),
                create_signature_image(principal_name, "Principal"),
            ]
        ],
        colWidths=[1.8 * inch, 1.8 * inch, 1.8 * inch],
    )
    signature_drawing.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )

    story.append(signature_drawing)
    story.append(Spacer(1, 0.08 * inch))

    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#666666"),
        alignment=1,
        fontName="Helvetica-Oblique",
    )
    current_date = datetime.now().strftime("%d-%B-%Y")
    story.append(Paragraph(f"<i>Certificate Issued on: {current_date}</i>", footer_style))

    story_table_data = [[Spacer(1, 0.05 * inch)]]
    for item in story:
        story_table_data.append([item])
    story_table_data.append([Spacer(1, 0.05 * inch)])

    inner_table = Table(story_table_data, colWidths=[7.2 * inch])
    inner_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    outer_wrapper = Table([[inner_table]], colWidths=[7.4 * inch])
    outer_wrapper.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFB6C1")),
                ("GRID", (0, 0), (-1, -1), 4, colors.HexColor("#333333")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    doc.build([outer_wrapper])
    buffer.seek(0)
    filename = build_filename(student_id, board, session)
    return buffer, filename
