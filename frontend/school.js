const API = {
    cert: "http://localhost:5001",
    registry: "http://localhost:5004",
};

const state = {
    generatedBlob: null,
    generatedUrl: "",
    generatedFileName: "certificate.pdf",
};

const registerStatus = document.getElementById("registerStatus");
const loginStatus = document.getElementById("loginStatus");
const sessionBadge = document.getElementById("sessionBadge");
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

function setSession(schoolId, token) {
    localStorage.setItem("schoolId", schoolId);
    localStorage.setItem("schoolToken", token);
    updateSessionBadge();
}

function clearSession() {
    localStorage.removeItem("schoolId");
    localStorage.removeItem("schoolToken");
    updateSessionBadge();
}

function getSession() {
    return {
        schoolId: localStorage.getItem("schoolId") || "",
        token: localStorage.getItem("schoolToken") || "",
    };
}

function updateSessionBadge() {
    const session = getSession();
    if (session.schoolId && session.token) {
        sessionBadge.textContent = `Logged in: ${session.schoolId}`;
    } else {
        sessionBadge.textContent = "Not logged in";
    }
}

function buildFileName(payload) {
    const base = `${payload.student_id || "certificate"}_${payload.first_name || ""}_${payload.last_name || ""}`;
    const cleaned = base.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    return `${cleaned || "certificate"}.pdf`;
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

async function registerSchool() {
    const payload = {
        school_id: document.getElementById("schoolId").value.trim(),
        name: document.getElementById("schoolName").value.trim(),
        board: document.getElementById("schoolBoard").value.trim(),
        contact_name: document.getElementById("contactName").value.trim(),
        email: document.getElementById("contactEmail").value.trim(),
        phone: document.getElementById("contactPhone").value.trim(),
        address: document.getElementById("contactAddress").value.trim(),
    };

    showStatus(registerStatus, "info", "Submitting school request...");

    try {
        const response = await fetch(`${API.registry}/school/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showStatus(registerStatus, "error", data.error || "Registration failed.");
            return;
        }

        if (data.status === "approved") {
            showStatus(registerStatus, "success", "School already approved. Ask admin for your token.");
        } else if (data.status === "pending") {
            showStatus(registerStatus, "info", `Request submitted. ID: ${data.request_id}`);
        } else {
            showStatus(registerStatus, "success", "Request submitted successfully.");
        }
    } catch (error) {
        showStatus(registerStatus, "error", "Network error during registration.");
    }
}

async function checkStatus() {
    const schoolId = document.getElementById("schoolId").value.trim();
    if (!schoolId) {
        showStatus(registerStatus, "error", "Enter School ID to check status.");
        return;
    }

    try {
        const response = await fetch(`${API.registry}/school/status?school_id=${encodeURIComponent(schoolId)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(registerStatus, "error", data.error || "Unable to check status.");
            return;
        }
        showStatus(registerStatus, "info", `Status: ${data.status}`);
    } catch (error) {
        showStatus(registerStatus, "error", "Network error while checking status.");
    }
}

async function loginSchool(event) {
    event.preventDefault();
    const schoolId = document.getElementById("loginSchoolId").value.trim();
    const token = document.getElementById("schoolToken").value.trim();

    try {
        const response = await fetch(`${API.registry}/school/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ school_id: schoolId, token }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showStatus(loginStatus, "error", data.error || "Login failed.");
            return;
        }

        setSession(schoolId, token);
        showStatus(loginStatus, "success", "Login successful.");
        document.getElementById("generateSection").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        showStatus(loginStatus, "error", "Network error during login.");
    }
}

async function generateCertificate(event) {
    event.preventDefault();
    const payload = collectPayload();
    const session = getSession();

    if (!session.schoolId || !session.token) {
        showStatus(generateStatus, "error", "Login with your school token first.");
        return;
    }

    showStatus(generateStatus, "info", "Generating the certificate PDF...");

    try {
        const response = await fetch(`${API.cert}/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-School-Id": session.schoolId,
                "X-School-Token": session.token,
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
        sendToAdminBtn.style.display = "inline-flex";
        updateSummary(payload);
        showStatus(generateStatus, "success", "Certificate generated. Preview ready.");
    } catch (error) {
        showStatus(generateStatus, "error", "Network error while generating certificate.");
    }
}

function resetForm() {
    document.getElementById("detailsForm").reset();
    summaryBox.innerHTML = "";
    previewBox.innerHTML = "<div><strong>No certificate yet.</strong><p>Generate a certificate to see the preview here.</p></div>";
    downloadBtn.style.display = "none";
    sendToAdminBtn.style.display = "none";
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

function init() {
    updateSessionBadge();

    document.getElementById("registerBtn").addEventListener("click", event => {
        event.preventDefault();
        registerSchool();
    });

    document.getElementById("checkStatusBtn").addEventListener("click", () => {
        checkStatus();
    });

    document.getElementById("schoolLoginForm").addEventListener("submit", loginSchool);

    document.getElementById("logoutBtn").addEventListener("click", event => {
        event.preventDefault();
        clearSession();
        window.location.href = "login.html";
    });

    document.getElementById("generateBtn").addEventListener("click", generateCertificate);
    document.getElementById("resetBtn").addEventListener("click", resetForm);

    document.getElementById("scrollRegister").addEventListener("click", () => {
        document.getElementById("registerSection").scrollIntoView({ behavior: "smooth" });
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
