document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  renderWorkshops();
  loadWinners();
  setupCertificate();
  setupChat();
});

function loadAnnouncement() {
  fetch("/api/announcement")
    .then(res => res.json())
    .then(data => {
      if (data && data.text) {
        document.getElementById("announcementText").textContent = data.text;
        document.getElementById("announcementCard").style.display = "block";
      }
    })
    .catch(err => console.error("Announcement error:", err));
}

document.addEventListener("DOMContentLoaded", () => {
  loadAnnouncement(); // ← Load this before winners
});

// ----------------- WORKSHOPS (GOOGLE FORMS) -----------------
const workshops = [
  {
    id: "ws1",
    name: "Web Dev Bootcamp",
    date: "12 December 2025",
    venue: "Lab 301",
    formUrl: "https://forms.gle/link1"
  },
  {
    id: "ws2",
    name: "AI & ML Basics",
    date: "20 December 2025",
    venue: "Seminar Hall",
    formUrl: "https://forms.gle/link2"
  }
];

function renderWorkshops() {
  const container = document.getElementById("workshopsList");
  workshops.forEach((ws) => {
    const div = document.createElement("div");
    div.className = "workshop-card";

    div.innerHTML = `
      <h3>${escapeHtml(ws.name)}</h3>
      <div class="workshop-meta">
        <div>📅 ${escapeHtml(ws.date)}</div>
        <div>📍 ${escapeHtml(ws.venue)}</div>
      </div>
      <button class="btn btn-small">Register (Google Form)</button>
    `;

    const btn = div.querySelector("button");
    btn.addEventListener("click", () => window.open(ws.formUrl, "_blank"));

    container.appendChild(div);
  });
}

// ----------------- WINNERS (with medals + badges) -----------------
async function loadWinners() {
  const container = document.getElementById("winnersList");
  container.innerHTML = "Loading winners...";

  const res = await fetch("/api/winners");
  const winners = await res.json();

  if (!Array.isArray(winners) || winners.length === 0) {
    container.textContent = "No winners added yet.";
    return;
  }

  // Group by workshopName
  const groups = {};
  winners.forEach((w) => {
    if (!groups[w.workshopName]) groups[w.workshopName] = [];
    groups[w.workshopName].push(w);
  });

  container.innerHTML = "";

  Object.entries(groups).forEach(([workshopName, list]) => {
    // Sort by position
    list.sort((a, b) => a.position - b.position);

    const card = document.createElement("div");
    card.className = "winner-card";

    const header = document.createElement("div");
    header.className = "winner-header";

    const title = document.createElement("div");
    title.className = "winner-title";
    title.textContent = workshopName;

    const chip = document.createElement("div");
    chip.className = "winner-chip";
    chip.textContent = "Top 3";

    header.appendChild(title);
    header.appendChild(chip);
    card.appendChild(header);

    list.forEach((w) => {
      const row = document.createElement("div");
      row.className = `winner-row position-${w.position}`;

      const badge = document.createElement("div");
      badge.className = "position-badge";
      badge.textContent = getPositionEmoji(w.position);

      const info = document.createElement("div");
      info.className = "winner-info";

      const nameEl = document.createElement("div");
      nameEl.className = "winner-name";
      nameEl.textContent = `${w.name} (${w.regNo})`;

      const posLabel = document.createElement("div");
      posLabel.className = "winner-reg";
      posLabel.textContent = positionLabel(w.position);

      info.appendChild(nameEl);
      info.appendChild(posLabel);

      row.appendChild(badge);
      row.appendChild(info);

      card.appendChild(row);
    });

    container.appendChild(card);
  });
}

function getPositionEmoji(pos) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return pos;
}

function positionLabel(pos) {
  if (pos === 1) return "1st Place";
  if (pos === 2) return "2nd Place";
  if (pos === 3) return "3rd Place";
  return `${pos}th Place`;
}

// ----------------- CERTIFICATE -----------------
function setupCertificate() {
  const form = document.getElementById("certificateForm");
  const msg = document.getElementById("certificateMessage");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "Checking...";
    msg.style.color = "#e5e7eb";

    const payload = {
      regNo: document.getElementById("certRegNo").value.trim(),
      certificateCode: document.getElementById("certificateCode").value.trim()
    };

    try {
      const res = await fetch("/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!data.success) {
        msg.textContent = data.message || "Certificate not found.";
        msg.style.color = "#f97373";
        return;
      }

      msg.textContent = "Verified! Downloading...";
      msg.style.color = "#4ade80";
      window.location.href = data.downloadUrl;
    } catch (err) {
      console.error(err);
      msg.textContent = "Network error. Try again.";
      msg.style.color = "#f97373";
    }
  });
}

// ----------------- CHAT -----------------
function setupChat() {
  const socket = io();
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const nameInput = document.getElementById("chatName");
  const messages = document.getElementById("chatMessages");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const text = input.value.trim();
    if (!name || !text) return;

    const msgObj = {
      name,
      message: text,
      time: new Date().toLocaleTimeString()
    };
    socket.emit("chatMessage", msgObj);
    input.value = "";
  });

  socket.on("chatMessage", (msg) => {
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `
      <span class="name">${escapeHtml(msg.name)}</span>
      <span class="time">${escapeHtml(msg.time || "")}</span>
      <div>${escapeHtml(msg.message)}</div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  });
}

// ----------------- UTIL -----------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
