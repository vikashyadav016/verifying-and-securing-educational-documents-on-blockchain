const API = {
    cert: "http://localhost:5001",
    registry: "http://localhost:5004",
};

const state = {
    generatedBlob: null,
    generatedUrl: "",
    generatedFileName: "certificate.pdf",
    schoolProfile: null,
};

const sessionBadge = document.getElementById("sessionBadge");
const sessionStatus = document.getElementById("sessionStatus");
const generateStatus = document.getElementById("generateStatus");
const previewBox = document.getElementById("previewBox");
const summaryBox = document.getElementById("summaryBox");
const downloadBtn = document.getElementById("downloadBtn");
const sendToAdminBtn = document.getElementById("sendToAdminBtn");
const submitStatus = document.getElementById("submitStatus");

function showStatus(element, kind, message) {
    element.className = `status ${kind}`;
    element.textContent = message;
}

function getSession() {
    return {
        schoolId: localStorage.getItem("schoolId") || "",
        password: localStorage.getItem("schoolPassword") || "",
    };
}

function clearSession() {
    localStorage.removeItem("schoolId");
    localStorage.removeItem("schoolPassword");
}

function updateSessionBadge() {
    const session = getSession();
    if (session.schoolId && session.password) {
        sessionBadge.textContent = `Logged in: ${session.schoolId}`;
    } else {
        sessionBadge.textContent = "Not logged in";
    }
}

function buildFileName(payload) {
    const base = `${payload.student_id || "certificate"}_${payload.board || ""}_${payload.session || ""}`;
    const cleaned = base.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    return `${cleaned || "certificate"}.pdf`;
}

function applySchoolProfile(profile) {
    if (!profile) return;
    const schoolNameField = document.getElementById("schoolNameCert");
    if (schoolNameField) {
        schoolNameField.value = profile.name || "";
    }
    const boardField = document.getElementById("schoolBoardCert");
    if (boardField) {
        boardField.value = profile.board || "";
    }
}

async function loadSchoolProfile() {
    const session = getSession();
    if (!session.schoolId || !session.password) {
        return;
    }

    try {
        const response = await fetch(`${API.registry}/school/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ school_id: session.schoolId, password: session.password }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(sessionStatus, "error", data.error || "Unable to load school profile.");
            return;
        }

        state.schoolProfile = data;
        applySchoolProfile(data);
    } catch (error) {
        showStatus(sessionStatus, "error", "Network error while loading school profile.");
    }
}

function gradeFromPercent(percent) {
    if (percent >= 90) return "A+";
    if (percent >= 80) return "A";
    if (percent >= 70) return "B";
    if (percent >= 60) return "C";
    if (percent >= 50) return "D";
    return "F";
}

function collectPayload() {
    return {
        student_id: document.getElementById("studentId").value.trim(),
        school: document.getElementById("schoolNameCert").value.trim(),
        board: document.getElementById("schoolBoardCert").value.trim(),
        first_name: document.getElementById("firstName").value.trim(),
        last_name: document.getElementById("lastName").value.trim(),
        gender: document.getElementById("gender").value,
        session: document.getElementById("session").value.trim(),
        math_score: document.getElementById("mathScore").value,
        history_score: document.getElementById("historyScore").value,
        physics_score: document.getElementById("physicsScore").value,
        chemistry_score: document.getElementById("chemistryScore").value,
        biology_score: document.getElementById("biologyScore").value,
        english_score: document.getElementById("englishScore").value,
        geography_score: document.getElementById("geographyScore").value,
    };
}

function updateSummary(payload) {
    const scores = [
        Number(payload.math_score || 0),
        Number(payload.history_score || 0),
        Number(payload.physics_score || 0),
        Number(payload.chemistry_score || 0),
        Number(payload.biology_score || 0),
        Number(payload.english_score || 0),
        Number(payload.geography_score || 0),
    ];
    const total = scores.reduce((sum, value) => sum + value, 0);
    const percent = (total / 700) * 100;
    const grade = gradeFromPercent(percent);
    summaryBox.innerHTML = `
        <div><span>Name</span><strong>${payload.first_name} ${payload.last_name}</strong></div>
        <div><span>Total marks</span><strong>${total} / 700</strong></div>
        <div><span>Percentage</span><strong>${percent.toFixed(2)}%</strong></div>
        <div><span>Grade</span><strong>${grade}</strong></div>
    `;
}

async function generateCertificate(event) {
    event.preventDefault();
    const payload = collectPayload();
    const session = getSession();

    if (!session.schoolId || !session.password) {
        showStatus(generateStatus, "error", "Login with your school password first.");
        return;
    }

    if (!payload.student_id) {
        showStatus(generateStatus, "error", "Student ID is required.");
        return;
    }

    showStatus(generateStatus, "info", "Generating the certificate PDF...");

    try {
        const response = await fetch(`${API.cert}/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-School-Id": session.schoolId,
                "X-School-Password": session.password,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            showStatus(generateStatus, "error", data.error || "Failed to generate certificate.");
            return;
        }

        const blob = await response.blob();
        const fileName = buildFileName(payload);
        if (state.generatedUrl) {
            URL.revokeObjectURL(state.generatedUrl);
        }

        state.generatedBlob = blob;
        state.generatedFileName = fileName;
        state.generatedUrl = URL.createObjectURL(blob);

        previewBox.innerHTML = `<iframe title="Certificate preview" src="${state.generatedUrl}"></iframe>`;
        downloadBtn.href = state.generatedUrl;
        downloadBtn.download = fileName;
        downloadBtn.style.display = "inline-flex";
        if (sendToAdminBtn) {
            sendToAdminBtn.style.display = "inline-flex";
        }
        updateSummary(payload);
        showStatus(generateStatus, "success", "Certificate generated. Preview ready.");
    } catch (error) {
        showStatus(generateStatus, "error", "Network error while generating certificate.");
    }
}

function resetForm() {
    document.getElementById("detailsForm").reset();
    applySchoolProfile(state.schoolProfile);
    summaryBox.innerHTML = "";
    previewBox.innerHTML = "<div><strong>No certificate yet.</strong><p>Generate a certificate to see the preview here.</p></div>";
    downloadBtn.style.display = "none";
    if (sendToAdminBtn) {
        sendToAdminBtn.style.display = "none";
    }
    if (submitStatus) {
        submitStatus.className = "status";
        submitStatus.textContent = "";
    }
    if (state.generatedUrl) {
        URL.revokeObjectURL(state.generatedUrl);
    }
    state.generatedBlob = null;
    state.generatedUrl = "";
    state.generatedFileName = "certificate.pdf";
    generateStatus.className = "status";
    generateStatus.textContent = "";
}

function getGeneratedFile() {
    if (!state.generatedBlob) return null;
    return new File([state.generatedBlob], state.generatedFileName, { type: "application/pdf" });
}

async function submitToAdmin() {
    const session = getSession();
    const payload = collectPayload();
    const studentId = payload.student_id;
    const sessionValue = payload.session;
    const file = getGeneratedFile();

    if (!session.schoolId || !session.password) {
        showStatus(submitStatus, "error", "Login with your school password first.");
        return;
    }

    if (!file) {
        showStatus(submitStatus, "error", "Generate a certificate first.");
        return;
    }

    if (!sessionValue) {
        showStatus(submitStatus, "error", "Session is required.");
        return;
    }

    const formData = new FormData();
    formData.append("certificate", file);
    formData.append("school_id", session.schoolId);
    formData.append("password", session.password);
    formData.append("student_id", studentId);
    formData.append("session", sessionValue);
    formData.append("first_name", payload.first_name);
    formData.append("last_name", payload.last_name);
    formData.append("gender", payload.gender);

    showStatus(submitStatus, "info", "Submitting certificate hash to admin...");

    try {
        const response = await fetch(`${API.registry}/school/submit-certificate`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showStatus(submitStatus, "error", data.error || "Failed to submit certificate.");
            return;
        }

        showStatus(submitStatus, "success", `Submitted to admin. Hash: ${data.pdf_hash || data.submission_id}`);
    } catch (error) {
        showStatus(submitStatus, "error", "Network error while submitting certificate.");
    }
}

function requireSession() {
    const session = getSession();
    if (!session.schoolId || !session.password) {
        window.location.href = "school-login.html";
        return false;
    }
    return true;
}

function init() {
    if (!requireSession()) {
        return;
    }

    updateSessionBadge();
    loadSchoolProfile();

    document.getElementById("logoutBtn").addEventListener("click", event => {
        event.preventDefault();
        clearSession();
        window.location.href = "login.html";
    });

    document.getElementById("generateBtn").addEventListener("click", generateCertificate);
    document.getElementById("resetBtn").addEventListener("click", resetForm);
    if (sendToAdminBtn) {
        sendToAdminBtn.addEventListener("click", submitToAdmin);
    }

    document.getElementById("scrollGenerate").addEventListener("click", () => {
        document.getElementById("generateSection").scrollIntoView({ behavior: "smooth" });
    });

    const reveals = document.querySelectorAll(".reveal");
    if (reveals.length) {
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("revealed");
                    }
                });
            },
            { threshold: 0.2 }
        );
        reveals.forEach(el => observer.observe(el));
    }
}

init();
