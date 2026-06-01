// ============================================================
//  OPTIONAL BACKEND  —  DC Connect
//  The frontend works 100% standalone (localStorage + PWA).
//  Run this server only when you want:
//    • central SQLite database (multi-device shared data)
//    • automatic WhatsApp / SMS notifications
//
//  Setup:
//    cd dc-dutse
//    npm install express better-sqlite3 cors dotenv
//    cp .env.example .env   (then fill in your keys)
//    npm run server
//
//  Then set VITE_API_URL=http://your-vps-ip:4000 in the frontend .env
// ============================================================

import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---- Database ----
const db = new Database(join(__dirname, "dc-connect.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS newcomers (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY,
    action TEXT, detail TEXT, actor TEXT, at TEXT
  );
`);

// ---- Sync endpoint (receives offline records from the app) ----
app.post("/api/sync", (req, res) => {
  const { type, data } = req.body || {};
  if (type === "newcomer" && data?.id) {
    db.prepare("INSERT OR REPLACE INTO newcomers (id, data, updated_at) VALUES (?, ?, ?)")
      .run(data.id, JSON.stringify(data), new Date().toISOString());
    return res.json({ ok: true });
  }
  res.status(400).json({ ok: false, error: "unknown sync type" });
});

// ---- Fetch all records (for multi-device sync) ----
app.get("/api/newcomers", (_req, res) => {
  const rows = db.prepare("SELECT data FROM newcomers ORDER BY updated_at DESC").all();
  res.json(rows.map((r) => JSON.parse(r.data)));
});

// ---- Notification endpoint (WhatsApp / SMS) ----
app.post("/api/notify", async (req, res) => {
  const { to, message, channel } = req.body || {};
  if (!to || !message) return res.status(400).json({ ok: false, error: "missing to/message" });

  try {
    if (channel === "whatsapp" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
      // WhatsApp Cloud API
      const r = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }),
      });
      const j = await r.json();
      return res.json({ ok: r.ok, provider: "whatsapp-cloud", response: j });
    }

    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
      // Twilio (SMS or WhatsApp via Twilio)
      const from = channel === "whatsapp" ? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}` : process.env.TWILIO_SMS_FROM;
      const dest = channel === "whatsapp" ? `whatsapp:+${to}` : `+${to}`;
      const body = new URLSearchParams({ From: from, To: dest, Body: message });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const j = await r.json();
      return res.json({ ok: r.ok, provider: "twilio", response: j });
    }

    // No provider configured — tell the frontend to use wa.me fallback
    res.json({ ok: false, error: "no-provider-configured" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✝️  DC Connect backend running on http://localhost:${PORT}`));
