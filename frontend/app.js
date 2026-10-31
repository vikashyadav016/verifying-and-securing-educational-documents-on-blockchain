const API = {
    cert: "http://localhost:5001",
    verify: "http://localhost:5002",
    admin: "http://localhost:5003",
};

const state = {
    generatedBlob: null,
    generatedUrl: "",
    generatedFileName: "certificate.pdf",
};

const generateStatus = document.getElementById("generateStatus");
const previewBox = document.getElementById("previewBox");
const summaryBox = document.getElementById("summaryBox");
const downloadBtn = document.getElementById("downloadBtn");
const sendToAdminBtn = document.getElementById("sendToAdminBtn");
const adminStatus = document.getElementById("adminStatus");
const verifyStatus = document.getElementById("verifyStatus");
const adminFileField = document.getElementById("adminFileField");

function revealOnScroll() {
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("revealed");
                }
            });
        },
        { threshold: 0.15 }
    );
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}

function showStatus(element, kind, message) {
    element.className = `status ${kind}`;
    element.textContent = message;
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
        school: document.getElementById("school").value.trim(),
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

async function generateCertificate() {
    const payload = collectPayload();
    showStatus(generateStatus, "info", "Generating the certificate PDF...");

    try {
        const response = await fetch(`${API.cert}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

function getAdminFile() {
    const source = document.querySelector("input[name='adminSource']:checked").value;
    if (source === "generated") {
        return getGeneratedFile();
    }
    const adminFile = document.getElementById("adminFile");
    return adminFile.files && adminFile.files[0] ? adminFile.files[0] : null;
}

async function submitFile(endpoint, file, password, statusElement) {
    if (!file) {
        showStatus(statusElement, "error", "Please attach a certificate PDF.");
        return;
    }

    const formData = new FormData();
    formData.append("certificate", file);
    if (password !== null) {
        formData.append("password", password);
    }

    try {
        const start = performance.now();
        const response = await fetch(endpoint, { method: "POST", body: formData });
        const elapsed = performance.now() - start;
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            const kind = data.status === "Not Found" ? "error" : "success";
            showStatus(
                statusElement,
                kind,
                `${data.status || "Done"}: ${data.message || ""} (${elapsed.toFixed(0)} ms)`
            );
        } else {
            showStatus(statusElement, "error", data.error || "Request failed.");
        }
    } catch (error) {
        showStatus(statusElement, "error", "Network error while processing request.");
    }
}

function updateAdminSource() {
    const source = document.querySelector("input[name='adminSource']:checked").value;
    adminFileField.style.display = source === "upload" ? "block" : "none";
}

document.getElementById("generateBtn").addEventListener("click", event => {
    event.preventDefault();
    generateCertificate();
});

document.getElementById("resetBtn").addEventListener("click", () => {
    resetForm();
});

document.getElementById("sendToAdminBtn").addEventListener("click", () => {
    document.getElementById("sourceGenerated").checked = true;
    updateAdminSource();
    document.getElementById("adminSection").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("adminVerifyBtn").addEventListener("click", () => {
    const file = getAdminFile();
    submitFile(`${API.verify}/verify`, file, null, adminStatus);
});

document.getElementById("adminUploadBtn").addEventListener("click", () => {
    const file = getAdminFile();
    const password = document.getElementById("adminPassword").value;
    if (!password) {
        showStatus(adminStatus, "error", "Admin password is required for upload.");
        return;
    }
    submitFile(`${API.admin}/upload`, file, password, adminStatus);
});

document.getElementById("verifyBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("verifyFile");
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    submitFile(`${API.verify}/verify`, file, null, verifyStatus);
});

document.getElementById("jumpGenerate").addEventListener("click", () => {
    document.getElementById("generateSection").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("jumpVerify").addEventListener("click", () => {
    document.getElementById("verifySection").scrollIntoView({ behavior: "smooth" });
});

document.querySelectorAll("input[name='adminSource']").forEach(radio => {
    radio.addEventListener("change", updateAdminSource);
});

updateAdminSource();
revealOnScroll();
