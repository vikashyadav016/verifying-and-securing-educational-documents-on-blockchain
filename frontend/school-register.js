const API = {
    registry: "http://localhost:5004",
};

const registerStatus = document.getElementById("registerStatus");
const statusResult = document.getElementById("statusResult");

function showStatus(element, kind, message) {
    element.className = `status ${kind}`;
    element.textContent = message;
}

async function registerSchool() {
    const password = document.getElementById("schoolPassword").value.trim();
    const confirmPassword = document.getElementById("schoolPasswordConfirm").value.trim();
    if (!password) {
        showStatus(registerStatus, "error", "Password is required.");
        return;
    }
    if (password !== confirmPassword) {
        showStatus(registerStatus, "error", "Passwords do not match.");
        return;
    }

    const payload = {
        school_id: document.getElementById("schoolId").value.trim(),
        name: document.getElementById("schoolName").value.trim(),
        board: document.getElementById("schoolBoard").value.trim(),
        chairman_name: document.getElementById("chairmanName").value.trim(),
        class_teacher_name: document.getElementById("classTeacherName").value.trim(),
        principal_name: document.getElementById("principalName").value.trim(),
        password,
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
            showStatus(registerStatus, "success", "School already approved. Login with your password.");
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
    const schoolId = document.getElementById("statusSchoolId").value.trim();
    const password = document.getElementById("statusPassword").value.trim();
    if (!schoolId || !password) {
        showStatus(statusResult, "error", "Enter School ID and password to check status.");
        return;
    }

    try {
        const response = await fetch(`${API.registry}/school/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ school_id: schoolId, password }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(statusResult, "error", data.error || "Unable to check status.");
            return;
        }
        showStatus(statusResult, "info", `Status: ${data.status}`);
    } catch (error) {
        showStatus(statusResult, "error", "Network error while checking status.");
    }
}

document.getElementById("registerBtn").addEventListener("click", event => {
    event.preventDefault();
    registerSchool();
});

document.getElementById("statusBtn").addEventListener("click", () => {
    checkStatus();
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
