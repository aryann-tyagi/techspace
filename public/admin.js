document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  loadAdminWinners();
  setupAdminForm();
});

async function loadAdminWinners() {
  const tableBody = document.querySelector("#winnersTable tbody");
  tableBody.innerHTML = "<tr><td colspan='8'>Loading...</td></tr>";

  try {
    const res = await fetch("/api/admin/winners");
    const winners = await res.json();

    if (!Array.isArray(winners) || winners.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='8'>No winners yet.</td></tr>";
      return;
    }

    tableBody.innerHTML = "";
    winners.forEach((w, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(w.workshopId)}</td>
        <td>${escapeHtml(w.workshopName)}</td>
        <td>${escapeHtml(String(w.position))}</td>
        <td>${escapeHtml(w.name)}</td>
        <td>${escapeHtml(w.regNo)}</td>
        <td>${escapeHtml(w.certificateCode)}</td>
        <td>${escapeHtml(w.certificateFile)}</td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = "<tr><td colspan='8'>Error loading winners.</td></tr>";
  }
}
document.getElementById("announcementForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("announcementInput").value.trim();
  const status = document.getElementById("announcementStatus");
  status.textContent = "Saving...";

  try {
    const res = await fetch("/api/announcement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!data.success) {
      status.textContent = data.message;
      status.style.color = "#f97373";
      return;
    }
    status.textContent = "Announcement updated!";
    status.style.color = "#4ade80";
    document.getElementById("announcementInput").value = "";
  } catch (err) {
    status.textContent = "Network error.";
    status.style.color = "#f97373";
  }
});

function setupAdminForm() {
  const form = document.getElementById("adminAddForm");
  const status = document.getElementById("adminStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Adding winner...";
    status.style.color = "#e5e7eb";

    const payload = {
      workshopId: document.getElementById("aWorkshopId").value.trim(),
      workshopName: document.getElementById("aWorkshopName").value.trim(),
      position: document.getElementById("aPosition").value.trim(),
      name: document.getElementById("aName").value.trim(),
      regNo: document.getElementById("aRegNo").value.trim(),
      certificateFile: document.getElementById("aFile").value.trim()
    };

    try {
      const res = await fetch("/api/admin/winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!data.success) {
        status.textContent = data.message || "Error adding winner.";
        status.style.color = "#f97373";
        return;
      }

      const w = data.winner;
      status.textContent =
        "Winner added! Generated Certificate Code: " + w.certificateCode;
      status.style.color = "#4ade80";

      form.reset();
      loadAdminWinners();
    } catch (err) {
      console.error(err);
      status.textContent = "Network error. Try again.";
      status.style.color = "#f97373";
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
