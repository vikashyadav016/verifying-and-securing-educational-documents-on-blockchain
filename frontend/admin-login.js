const API = {
    registry: "http://localhost:5004",
};

const loginForm = document.getElementById("adminLoginForm");
const loginStatus = document.getElementById("adminLoginStatus");

function showStatus(element, kind, message) {
    element.className = `status ${kind}`;
    element.textContent = message;
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const username = document.getElementById("adminUser").value.trim();
    const password = document.getElementById("adminPassword").value.trim();

    try {
        const response = await fetch(`${API.registry}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            showStatus(loginStatus, "error", data.error || "Invalid credentials.");
            return;
        }

        localStorage.setItem("adminUser", username);
        localStorage.setItem("adminPassword", password);
        showStatus(loginStatus, "success", "Login successful. Redirecting...");
        setTimeout(() => {
            window.location.href = "admin.html";
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
