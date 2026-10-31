const API = {
    verify: "http://localhost:5002",
};

const publicVerifyForm = document.getElementById("publicVerifyForm");
const publicVerifyStatus = document.getElementById("publicVerifyStatus");

function showStatus(element, kind, message) {
    element.className = `status ${kind}`;
    element.textContent = message;
}

async function verifyPublicCertificate(event) {
    event.preventDefault();

    const fileInput = document.getElementById("publicVerifyFile");
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) {
        showStatus(publicVerifyStatus, "error", "Choose a certificate PDF first.");
        return;
    }

    const formData = new FormData();
    formData.append("certificate", file);

    showStatus(publicVerifyStatus, "info", "Verifying certificate...");

    try {
        const response = await fetch(`${API.verify}/verify`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showStatus(publicVerifyStatus, "error", data.error || "Verification failed.");
            return;
        }

        const kind = data.status === "Not Found" ? "error" : "success";
        showStatus(publicVerifyStatus, kind, data.message || "Verification complete.");
    } catch (error) {
        showStatus(publicVerifyStatus, "error", "Network error during verification.");
    }
}

publicVerifyForm.addEventListener("submit", verifyPublicCertificate);

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
