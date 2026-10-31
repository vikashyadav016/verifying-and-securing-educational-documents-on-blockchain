const API = {
    registry: "http://localhost:5004",
    verify: "http://localhost:5002",
    blockchain: "http://localhost:5003",
};

const adminBadge = document.getElementById("adminBadge");
const adminStatus = document.getElementById("adminStatus");
const requestStatus = document.getElementById("requestStatus");
const requestsContainer = document.getElementById("requestsContainer");
const approvedStatus = document.getElementById("approvedStatus");
const approvedContainer = document.getElementById("approvedContainer");
const approvedCount = document.getElementById("approvedCount");
const submissionStatus = document.getElementById("submissionStatus");
const submissionsContainer = document.getElementById("submissionsContainer");
const uploadedStatus = document.getElementById("uploadedStatus");
const uploadedContainer = document.getElementById("uploadedContainer");
const uploadedCount = document.getElementById("uploadedCount");
const bulkStatus = document.getElementById("bulkStatus");
const blockchainPassword = document.getElementById("blockchainPassword");
const selectionCount = document.getElementById("selectionCount");
const toastContainer = document.getElementById("toastContainer");
const refreshBtn = document.getElementById("refreshBtn");
const bulkUploadBtn = document.getElementById("bulkUploadBtn");
const selectAllPendingBtn = document.getElementById("selectAllPendingBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const selectedSubmissionIds = new Set();
const MAX_CERTIFICATES = 200;
const STATUS_MIN_DURATION_MS = 4000;
const TOAST_DEFAULT_DURATION_MS = 9000;
const statusTimers = new Map();
const toastTimers = new WeakMap();
let isUploading = false;

function clearStatus(element) {
    if (!element) return;
    const timer = statusTimers.get(element);
    if (timer) {
        clearTimeout(timer);
        statusTimers.delete(element);
    }
    element.className = "status";
    element.textContent = "";
    element.style.display = "none";
}

function showStatus(element, kind, message, options = {}) {
    if (!element) return;
    const durationMs = Math.max(options.durationMs || STATUS_MIN_DURATION_MS, STATUS_MIN_DURATION_MS);
    const persist = options.persist === true;

    const timer = statusTimers.get(element);
    if (timer) {
        clearTimeout(timer);
        statusTimers.delete(element);
    }

    element.className = `status ${kind}`;
    element.textContent = message;
    element.style.display = "block";

    if (!persist) {
        const nextTimer = window.setTimeout(() => {
            clearStatus(element);
        }, durationMs);
        statusTimers.set(element, nextTimer);
    }
}

function showToast(kind, message, options = {}) {
    if (!toastContainer) return;
    const durationMs = Math.max(options.durationMs || TOAST_DEFAULT_DURATION_MS, STATUS_MIN_DURATION_MS);
    const toast = document.createElement("div");
    toast.className = `toast ${kind}`;

    const messageEl = document.createElement("div");
    messageEl.className = "toast-message";
    messageEl.textContent = message;
    toast.appendChild(messageEl);

    if (options.linkUrl) {
        const link = document.createElement("a");
        link.href = options.linkUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = options.linkText || "View";
        toast.appendChild(link);
    }

    toastContainer.appendChild(toast);

    const removeToast = () => {
        toast.classList.add("hide");
        window.setTimeout(() => {
            toast.remove();
        }, 200);
    };

    const timer = window.setTimeout(removeToast, durationMs);
    toastTimers.set(toast, timer);
}

function setUploadBusy(isBusy) {
    isUploading = isBusy;
    const buttons = [refreshBtn, bulkUploadBtn, selectAllPendingBtn, clearSelectionBtn];
    buttons.forEach(button => {
        if (button) {
            button.disabled = isBusy;
        }
    });
}

function finalizeUploadRefresh() {
    fetchSubmissions({ showStatus: false, force: true });
    setUploadBusy(false);
}

function formatTxMessage(data, fallback) {
    const base = data && data.message ? data.message : fallback;
    if (!data || !data.tx_hash) {
        return base;
    }
    const txUrl = data.tx_url || `https://sepolia.etherscan.io/tx/${data.tx_hash}`;
    return `${base} Transaction: ${data.tx_hash}. Explorer: ${txUrl}`;
}

function getAdminHeaders() {
    const user = localStorage.getItem("adminUser") || "";
    const password = localStorage.getItem("adminPassword") || "";
    return {
        "X-Admin-User": user,
        "X-Admin-Password": password,
    };
}

function updateAdminBadge() {
    const user = localStorage.getItem("adminUser");
    if (user) {
        adminBadge.textContent = `Logged in: ${user}`;
    } else {
        adminBadge.textContent = "Not logged in";
    }
}

function updateSelectionCount() {
    if (!selectionCount) return;
    const count = selectedSubmissionIds.size;
    selectionCount.textContent = `${count} / ${MAX_CERTIFICATES} selected`;
    selectionCount.classList.toggle("limit-reached", count >= MAX_CERTIFICATES);
}

function updateCheckboxStates() {
    if (!submissionsContainer) return;
    const isFull = selectedSubmissionIds.size >= MAX_CERTIFICATES;
    submissionsContainer.querySelectorAll("input[data-select-submission]").forEach(checkbox => {
        if (checkbox.dataset.uploadedStatus === "uploaded") {
            checkbox.disabled = true;
            return;
        }
        checkbox.disabled = isFull && !checkbox.checked;
    });
}

function setSelectedSubmission(submissionId, selected) {
    if (selected) {
        if (selectedSubmissionIds.size >= MAX_CERTIFICATES) {
            showStatus(bulkStatus, "error", `Maximum ${MAX_CERTIFICATES} certificates can be selected at once.`);
            return false;
        }
        selectedSubmissionIds.add(submissionId);
    } else {
        selectedSubmissionIds.delete(submissionId);
    }
    updateSelectionCount();
    updateCheckboxStates();
    return true;
}

function clearSelection() {
    selectedSubmissionIds.clear();
    if (submissionsContainer) {
        submissionsContainer.querySelectorAll("input[data-select-submission]").forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    updateSelectionCount();
    updateCheckboxStates();
}

async function fetchRequests() {
    requestsContainer.innerHTML = "";
    showStatus(requestStatus, "info", "Loading requests...");

    try {
        const response = await fetch(`${API.registry}/admin/requests`, {
            headers: getAdminHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(requestStatus, "error", data.error || "Failed to load requests.");
            return;
        }

        const requests = data.requests || [];
        if (!requests.length) {
            showStatus(requestStatus, "info", "No pending requests.");
            return;
        }

        showStatus(requestStatus, "success", `${requests.length} request(s) pending.`);
        const table = document.createElement("table");
        table.className = "table";
        table.innerHTML = `
            <thead>
                <tr>
                    <th>School</th>
                    <th>Board</th>
                    <th>Contact</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector("tbody");

        requests.forEach(req => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>
                    <strong>${req.school_id}</strong><br>
                    ${req.name}
                </td>
                <td>${req.board}</td>
                <td>${req.contact_name || "-"}<br>${req.email || "-"}</td>
                <td>
                    <div class="inline">
                        <button class="btn ghost" data-action="approve" data-id="${req.request_id}">Approve</button>
                        <button class="btn ghost" data-action="reject" data-id="${req.request_id}">Reject</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        requestsContainer.appendChild(table);
    } catch (error) {
        showStatus(requestStatus, "error", "Network error while loading requests.");
    }
}

async function approveRequest(requestId) {
    try {
        const response = await fetch(`${API.registry}/admin/requests/${requestId}/approve`, {
            method: "POST",
            headers: getAdminHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(requestStatus, "error", data.error || "Approval failed.");
            return;
        }
        showStatus(requestStatus, "success", `Approved ${data.school_id}. School can login with its password.`);
        fetchRequests();
    } catch (error) {
        showStatus(requestStatus, "error", "Network error while approving request.");
    }
}

async function rejectRequest(requestId) {
    try {
        const response = await fetch(`${API.registry}/admin/requests/${requestId}/reject`, {
            method: "POST",
            headers: getAdminHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(requestStatus, "error", data.error || "Rejection failed.");
            return;
        }
        showStatus(requestStatus, "success", "Request rejected.");
        fetchRequests();
    } catch (error) {
        showStatus(requestStatus, "error", "Network error while rejecting request.");
    }
}



async function fetchApprovedSchools() {
    if (!approvedContainer) return;
    approvedContainer.innerHTML = "";
    showStatus(approvedStatus, "info", "Loading approved schools...");
    try {
        const headers = getAdminHeaders();
        console.log("Fetching approved schools with headers:", { user: headers["X-Admin-User"], hasPassword: !!headers["X-Admin-Password"] });

        const resp = await fetch(`${API.registry}/admin/schools`, {
            headers: headers,
        });
        console.log("Approved schools response status:", resp.status);

        const data = await resp.json().catch(() => ({}));
        console.log("Approved schools data:", data);

        if (!resp.ok) {
            showStatus(approvedStatus, "error", data.error || "Failed to load.");
            return;
        }
        const schools = data.schools || [];
        if (approvedCount) {
            approvedCount.textContent = `${schools.length} approved`;
        }
        if (!schools.length) {
            showStatus(approvedStatus, "info", "No approved schools yet. Approve school requests to see them here.");
            return;
        }
        showStatus(approvedStatus, "success", `${schools.length} approved school(s).`);
        const table = document.createElement("table");
        table.className = "table";
        table.innerHTML = `
                <thead>
                    <tr>
                        <th>School ID</th>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Approved</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
        const tbody = table.querySelector("tbody");
        schools.forEach(s => {
            const row = document.createElement("tr");
            row.innerHTML = `
                    <td><strong>${s.school_id}</strong></td>
                    <td>${s.name || "-"}</td>
                    <td>${s.contact_name || "-"}<br><small>${s.email || "-"}</small></td>
                    <td><small>${s.approved_at || "-"}</small></td>
                    <td>
                        <div class="inline">
                            <button class="btn ghost" data-action="reset" data-id="${s.school_id}">Reset password</button>
                        </div>
                    </td>
                `;
            tbody.appendChild(row);
        });
        approvedContainer.appendChild(table);
    } catch (err) {
        console.error("Error fetching approved schools:", err);
        showStatus(approvedStatus, "error", "Network error while loading approved schools.");
    }
}

async function fetchSubmissionFile(submissionId) {
    const response = await fetch(`${API.registry}/admin/submissions/${submissionId}/file`, {
        headers: getAdminHeaders(),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download file.");
    }
    const blob = await response.blob();
    return new File([blob], `${submissionId}.pdf`, { type: "application/pdf" });
}

async function downloadSubmission(submissionId) {
    try {
        const file = await fetchSubmissionFile(submissionId);
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showStatus(submissionStatus, "error", error.message || "Download failed.");
    }
}

async function verifySubmission(submissionId) {
    showStatus(submissionStatus, "info", "Verifying certificate...");
    try {
        const file = await fetchSubmissionFile(submissionId);
        const formData = new FormData();
        formData.append("certificate", file);

        const response = await fetch(`${API.verify}/verify`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(submissionStatus, "error", data.error || "Verification failed.");
            return;
        }
        showStatus(submissionStatus, data.status === "Not Found" ? "error" : "success", data.message || "Verification complete.");
    } catch (error) {
        showStatus(submissionStatus, "error", error.message || "Verification failed.");
    }
}

async function uploadSubmission(submissionId) {
    const password = blockchainPassword ? blockchainPassword.value.trim() : "";
    if (!password) {
        showStatus(submissionStatus, "error", "Enter blockchain admin password.");
        return;
    }

    if (isUploading) {
        showStatus(submissionStatus, "info", "Upload already in progress. Please wait.");
        return;
    }

    setUploadBusy(true);
    showStatus(submissionStatus, "info", "Uploading certificate hash to blockchain...");
    try {
        const file = await fetchSubmissionFile(submissionId);
        const formData = new FormData();
        formData.append("certificate", file);
        formData.append("password", password);

        const response = await fetch(`${API.blockchain}/upload`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(submissionStatus, "error", data.error || "Upload failed.");
            return;
        }

        await fetch(`${API.registry}/admin/submissions/${submissionId}/mark-uploaded`, {
            method: "POST",
            headers: getAdminHeaders(),
        });
        showStatus(submissionStatus, "success", formatTxMessage(data, "Uploaded successfully."));
        if (data && data.tx_hash) {
            showToast("success", `Transaction hash: ${data.tx_hash}`, {
                linkUrl: data.tx_url,
                linkText: "View on Etherscan",
            });
        }
        finalizeUploadRefresh();
    } catch (error) {
        showStatus(submissionStatus, "error", error.message || "Upload failed.");
        setUploadBusy(false);
    }
}

async function uploadSelectedSubmissions() {
    const submissionIds = Array.from(selectedSubmissionIds);
    if (!submissionIds.length) {
        showStatus(bulkStatus, "error", "Select at least one hash to upload.");
        return;
    }

    const password = blockchainPassword ? blockchainPassword.value.trim() : "";
    if (!password) {
        showStatus(bulkStatus, "error", "Enter blockchain admin password.");
        return;
    }

    if (isUploading) {
        showStatus(bulkStatus, "info", "Upload already in progress. Please wait.");
        return;
    }

    setUploadBusy(true);
    showStatus(bulkStatus, "info", `Uploading ${submissionIds.length} hash(es) to blockchain...`);

    try {
        const files = await Promise.all(submissionIds.map(fetchSubmissionFile));
        const formData = new FormData();
        files.forEach(file => formData.append("certificates", file));
        formData.append("password", password);

        const response = await fetch(`${API.blockchain}/bulk-upload`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showStatus(bulkStatus, "error", data.error || "Bulk upload failed.");
            return;
        }

        await Promise.all(
            submissionIds.map(submissionId =>
                fetch(`${API.registry}/admin/submissions/${submissionId}/mark-uploaded`, {
                    method: "POST",
                    headers: getAdminHeaders(),
                })
            )
        );

        clearSelection();
        showStatus(bulkStatus, "success", formatTxMessage(data, `Uploaded ${submissionIds.length} hash(es).`));
        if (data && data.tx_hash) {
            showToast("success", `Transaction hash: ${data.tx_hash}`, {
                linkUrl: data.tx_url,
                linkText: "View on Etherscan",
            });
        }
        finalizeUploadRefresh();
    } catch (error) {
        showStatus(bulkStatus, "error", error.message || "Bulk upload failed.");
        setUploadBusy(false);
    }
}

async function fetchSubmissions(options = {}) {
    const shouldUpdateStatus = options.showStatus !== false;
    if (isUploading && !options.force) {
        return;
    }
    if (!submissionsContainer && !uploadedContainer) return;
    if (submissionsContainer) {
        submissionsContainer.innerHTML = "";
    }
    if (uploadedContainer) {
        uploadedContainer.innerHTML = "";
    }
    if (shouldUpdateStatus) {
        showStatus(submissionStatus, "info", "Loading pending submissions...");
    }
    if (uploadedStatus) {
        showStatus(uploadedStatus, "info", "Loading uploaded certificates...");
    }

    try {
        const response = await fetch(`${API.registry}/admin/submissions`, {
            headers: getAdminHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (shouldUpdateStatus) {
                showStatus(submissionStatus, "error", data.error || "Failed to load submissions.");
            }
            return;
        }

        const submissions = data.submissions || [];
        const pendingSubmissions = submissions.filter(item => item.status !== "uploaded");
        const uploadedSubmissions = submissions.filter(item => item.status === "uploaded");

        if (uploadedCount) {
            uploadedCount.textContent = `${uploadedSubmissions.length} uploaded`;
        }

        if (selectionCount) {
            selectionCount.textContent = `${selectedSubmissionIds.size} / ${MAX_CERTIFICATES} selected`;
        }

        if (!pendingSubmissions.length) {
            selectedSubmissionIds.clear();
            updateSelectionCount();
            if (shouldUpdateStatus) {
                showStatus(submissionStatus, "info", "No pending submissions yet.");
            }
        } else {
            if (shouldUpdateStatus) {
                showStatus(submissionStatus, "success", `${pendingSubmissions.length} pending submission(s).`);
            }
            const table = document.createElement("table");
            table.className = "table";
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Select</th>
                        <th>Submission</th>
                        <th>Hash</th>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector("tbody");

            pendingSubmissions.forEach(item => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>
                        <input
                            type="checkbox"
                            data-select-submission
                            data-id="${item.submission_id}"
                            data-uploaded-status="pending"
                            ${selectedSubmissionIds.has(item.submission_id) ? "checked" : ""}
                            title="Select to upload to blockchain"
                        >
                    </td>
                    <td>
                        <strong>${item.school_id}</strong><br>
                        <small>${item.submission_id}</small>
                    </td>
                    <td><small>${item.pdf_hash || "-"}</small></td>
                    <td>${item.student_id || "-"}</td>
                    <td><span class="badge badge-pending">${item.status}</span></td>
                    <td>
                        <div class="inline">
                            <button class="btn ghost" data-action="download" data-id="${item.submission_id}">Download</button>
                            <button class="btn ghost" data-action="verify" data-id="${item.submission_id}">Verify</button>
                            <button class="btn ghost" data-action="upload" data-id="${item.submission_id}">Upload</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });

            if (submissionsContainer) {
                submissionsContainer.appendChild(table);
            }

            const pendingIdSet = new Set(pendingSubmissions.map(item => item.submission_id));
            Array.from(selectedSubmissionIds).forEach(id => {
                if (!pendingIdSet.has(id)) {
                    selectedSubmissionIds.delete(id);
                }
            });

            if (submissionsContainer) {
                submissionsContainer.querySelectorAll("input[data-select-submission]").forEach(checkbox => {
                    const id = checkbox.getAttribute("data-id");
                    checkbox.addEventListener("change", event => {
                        if (!setSelectedSubmission(id, event.target.checked)) {
                            event.target.checked = false;
                        }
                    });
                });
            }
            updateSelectionCount();
            updateCheckboxStates();
        }

        if (!uploadedSubmissions.length) {
            if (uploadedStatus) {
                showStatus(uploadedStatus, "info", "No uploaded certificates yet.");
            }
        } else {
            if (uploadedStatus) {
                showStatus(uploadedStatus, "success", `${uploadedSubmissions.length} uploaded certificate(s).`);
            }

            const table = document.createElement("table");
            table.className = "table";
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Submission</th>
                        <th>Hash</th>
                        <th>Student</th>
                        <th>Uploaded</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector("tbody");

            uploadedSubmissions.forEach(item => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>
                        <strong>${item.school_id}</strong><br>
                        <small>${item.submission_id}</small>
                    </td>
                    <td><small>${item.pdf_hash || "-"}</small></td>
                    <td>${item.student_id || "-"}</td>
                    <td><small>${item.uploaded_at || "-"}</small></td>
                    <td>
                        <div class="inline">
                            <button class="btn ghost" data-action="download" data-id="${item.submission_id}">Download</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });

            if (uploadedContainer) {
                uploadedContainer.appendChild(table);
            }
        }
    } catch (error) {
        if (shouldUpdateStatus) {
            showStatus(submissionStatus, "error", "Network error while loading submitted hashes.");
        }
        if (uploadedStatus) {
            showStatus(uploadedStatus, "error", "Network error while loading uploaded certificates.");
        }
    }
}

async function resetSchoolPassword(schoolId) {
    if (!confirm(`Reset password for ${schoolId}? This will generate a new password.`)) return;
    try {
        const resp = await fetch(`${API.registry}/admin/schools/${encodeURIComponent(schoolId)}/reset-password`, {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json" }, getAdminHeaders()),
            body: JSON.stringify({})
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            showStatus(approvedStatus, "error", data.error || "Reset failed.");
            return;
        }
        showStatus(approvedStatus, "success", `Password for ${data.school_id} reset. New password: ${data.new_password}`);
        fetchApprovedSchools();
    } catch (err) {
        showStatus(approvedStatus, "error", "Network error while resetting password.");
    }
}



function bindTableActions() {
    requestsContainer.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const action = button.getAttribute("data-action");
        const requestId = button.getAttribute("data-id");
        if (action === "approve") {
            approveRequest(requestId);
        } else if (action === "reject") {
            rejectRequest(requestId);
        }
    });

    if (approvedContainer) {
        approvedContainer.addEventListener("click", event => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;
            const action = button.getAttribute("data-action");
            const id = button.getAttribute("data-id");
            if (action === "reset") resetSchoolPassword(id);
        });
    }

    if (submissionsContainer) {
        submissionsContainer.addEventListener("click", event => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;
            const action = button.getAttribute("data-action");
            const submissionId = button.getAttribute("data-id");
            if (action === "download") {
                downloadSubmission(submissionId);
            } else if (action === "verify") {
                verifySubmission(submissionId);
            } else if (action === "upload") {
                uploadSubmission(submissionId);
            }
        });
    }

    if (uploadedContainer) {
        uploadedContainer.addEventListener("click", event => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;
            const action = button.getAttribute("data-action");
            const submissionId = button.getAttribute("data-id");
            if (action === "download") {
                downloadSubmission(submissionId);
            } else if (action === "verify") {
                verifySubmission(submissionId);
            }
        });
    }
}

function logout(event) {
    if (event) {
        event.preventDefault();
    }
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminPassword");
    window.location.href = "login.html";
}

function init() {
    const user = localStorage.getItem("adminUser");
    const password = localStorage.getItem("adminPassword");
    if (!user || !password) {
        window.location.href = "admin-login.html";
        return;
    }

    updateAdminBadge();
    bindTableActions();
    fetchRequests();
    fetchSubmissions();
    fetchApprovedSchools();

    if (refreshBtn) refreshBtn.addEventListener("click", () => {
        if (isUploading) {
            showStatus(submissionStatus, "info", "Upload in progress. Please wait for the transaction hash.");
            return;
        }
        fetchRequests();
        fetchSubmissions();
        fetchApprovedSchools();
    });

    document.getElementById("jumpApprovedBtn").addEventListener("click", () => {
        const approvedSection = document.getElementById("approvedSchoolsSection");
        if (approvedSection) {
            approvedSection.open = true;
            approvedSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });

    if (bulkUploadBtn) bulkUploadBtn.addEventListener("click", uploadSelectedSubmissions);

    if (selectAllPendingBtn) {
        selectAllPendingBtn.addEventListener("click", () => {
            let remainingSlots = MAX_CERTIFICATES - selectedSubmissionIds.size;
            submissionsContainer.querySelectorAll("input[data-select-submission]").forEach(checkbox => {
                if (remainingSlots <= 0) return;
                if (checkbox.dataset.uploadedStatus === "uploaded" || checkbox.checked) return;
                checkbox.checked = true;
                if (setSelectedSubmission(checkbox.getAttribute("data-id"), true)) {
                    remainingSlots -= 1;
                }
            });
        });
    }

    if (clearSelectionBtn) clearSelectionBtn.addEventListener("click", clearSelection);

    document.getElementById("logoutBtn").addEventListener("click", logout);

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
