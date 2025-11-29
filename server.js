const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, "winners.json");
const ADMIN_USER = process.env.ADMIN_USER || "techspace";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "veryhard69";

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [type, value] = authHeader.split(" ");

  if (type !== "Basic" || !value) {
    res.set("WWW-Authenticate", 'Basic realm="TechSpace Admin"');
    return res.sendStatus(401);
  }

  const [user, pass] = Buffer.from(value, "base64").toString().split(":");
  if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="TechSpace Admin"');
  return res.sendStatus(401);
}

// ===== HELPERS: LOAD & SAVE WINNERS =====
let winners = [];

function loadWinnersFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      winners = JSON.parse(raw || "[]");
      if (!Array.isArray(winners)) {
        console.warn("⚠ winners.json was not an array, resetting.");
        winners = [];
      }
    } else {
      console.warn("⚠ winners.json not found, starting with empty list.");
      winners = [];
      saveWinnersToFile();
    }
  } catch (err) {
    console.error("❌ Error reading winners.json:", err);
    winners = [];
  }
}

function saveWinnersToFile() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(winners, null, 2), "utf-8");
    console.log("💾 winners.json updated. Total winners:", winners.length);
  } catch (err) {
    console.error("❌ Error writing winners.json:", err);
  }
}
const ANN_FILE = path.join(__dirname, "announcement.json");
let announcement = { text: "No announcements yet." };

function loadAnnouncement() {
  try {
    if (fs.existsSync(ANN_FILE)) {
      const raw = fs.readFileSync(ANN_FILE, "utf8");
      announcement = JSON.parse(raw || "{}");
      if (!announcement.text) announcement.text = "No announcements yet.";
    } else {
      saveAnnouncement();
    }
  } catch (err) {
    console.error("❌ Error loading announcement.json:", err);
  }
}

function saveAnnouncement() {
  try {
    fs.writeFileSync(ANN_FILE, JSON.stringify(announcement, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Error writing announcement.json:", err);
  }
}

loadAnnouncement();

// Load once at startup
loadWinnersFromFile();


// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/certificates", express.static(path.join(__dirname, "certificates")));
// Get announcement
app.get("/api/announcement", (req, res) => {
  res.json(announcement);
});

// Update announcement (Admin)
app.post("/api/announcement", (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: "Announcement cannot be empty." });
  }
  announcement.text = text.trim();
  saveAnnouncement();
  return res.json({ success: true, announcement });
});


// ===== PUBLIC API (STUDENTS) =====

// Public winners list (you can strip codes if you want)
app.get("/api/winners", (req, res) => {
  // If you DON'T want students to see codes, uncomment this:
   const publicWinners = winners.map(({ certificateCode, certificateFile, ...rest }) => rest);
   return res.json(publicWinners);

  res.json(winners);
});

// Certificate verification
app.post("/api/certificate", (req, res) => {
  const { regNo, certificateCode } = req.body;

  if (!regNo || !certificateCode) {
    return res.status(400).json({
      success: false,
      message: "Registration number and certificate code are required."
    });
  }

  const match = winners.find(
    (w) =>
      w.regNo.toLowerCase().trim() === regNo.toLowerCase().trim() &&
      w.certificateCode.trim() === certificateCode.trim()
  );

  if (!match) {
    return res.status(404).json({
      success: false,
      message: "No matching certificate found. Check your details."
    });
  }

  return res.json({
    success: true,
    downloadUrl: `/certificates/${match.certificateFile}`
  });
});

// ===== ADMIN API =====

// Admin list (with codes + file)
app.get("/api/admin/winners", (req, res) => {
  res.json(winners);
});

// Helper: auto-generate certificate code
function generateCertificateCode(workshopId, regNo) {
  const cleanWorkshop = (workshopId || "WS").toUpperCase();
  const lastDigits =
    (regNo || "")
      .replace(/\D/g, "")
      .slice(-4) || Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${cleanWorkshop}-${lastDigits}-${randomPart}`;
}

// Add winner from admin panel
app.post("/api/admin/winners", (req, res) => {
  console.log("📥 /api/admin/winners body:", req.body);

  const {
    workshopId,
    workshopName,
    position,
    name,
    regNo,
    certificateFile
  } = req.body;

  if (!workshopId || !workshopName || !position || !name || !regNo || !certificateFile) {
    return res.status(400).json({
      success: false,
      message: "All fields are required."
    });
  }

  const numericPosition = parseInt(position, 10);
  if (![1, 2, 3].includes(numericPosition)) {
    return res.status(400).json({
      success: false,
      message: "Position must be 1, 2 or 3."
    });
  }

  const certificateCode = generateCertificateCode(workshopId, regNo);

  const newWinner = {
    id: winners.length > 0 ? winners[winners.length - 1].id + 1 : 1,
    workshopId,
    workshopName,
    position: numericPosition,
    name,
    regNo,
    certificateCode,
    certificateFile
  };

  winners.push(newWinner);
  saveWinnersToFile();

  console.log("✅ Added winner:", newWinner);

  return res.json({
    success: true,
    winner: newWinner
  });
});

// Serve admin page
app.get("/admin", adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// protect all admin APIs
app.use("/api/admin", adminAuth);


// // ===== CHAT (Socket.IO) =====
// io.on("connection", (socket) => {
//   console.log("🔌 Client connected:", socket.id);

//   socket.on("chatMessage", (msgObj) => {
//     io.emit("chatMessage", msgObj);
//   });

//   socket.on("disconnect", () => {
//     console.log("❌ Client disconnected:", socket.id);
//   });
// });

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

