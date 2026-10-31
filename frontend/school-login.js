const API = {
    registry: "http://localhost:5004",
};

const loginForm = document.getElementById("schoolLoginForm");
const loginStatus = document.getElementById("loginStatus");

function showStatus(element, kind, message) {
    element.className = `status ${kind}`;
    element.textContent = message;
}

function setSession(schoolId, password) {
    localStorage.setItem("schoolId", schoolId);
    localStorage.setItem("schoolPassword", password);
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const schoolId = document.getElementById("loginSchoolId").value.trim();
    const password = document.getElementById("schoolPassword").value.trim();

    try {
        const response = await fetch(`${API.registry}/school/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ school_id: schoolId, password }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            showStatus(loginStatus, "error", data.error || "Login failed.");
            return;
        }

        setSession(schoolId, password);
        showStatus(loginStatus, "success", "Login successful. Redirecting...");
        setTimeout(() => {
            window.location.href = "school-dashboard.html";
        }, 600);
    } catch (error) {
        showStatus(loginStatus, "error", "Network error during login.");
    }
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
