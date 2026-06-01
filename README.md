# ✝️ DC Connect — Church Engagement & Followup Platform

A complete, **offline-first** church management platform built for **Dominion City Dutse** — designed for low-network zones, tap-first data entry, and zero-friction newcomer registration.

Built by Emmanuel (ClickShift) · Pastor Stanley & Pastor Mrs. Chioma Nzewigbo

---

## ✨ What it does

Three roles, one platform:

| Role | Login? | What they do |
|------|--------|--------------|
| **Newcomers** | No login | Tap-first registration: address, spiritual background, prayer points, department interest. Instantly assigned to the nearest cell leader. |
| **Cell Leaders** | Phone + PIN | See only their assigned people, track Sunday attendance, get auto-flagged for overdue follow-ups, promote to membership at 5 services. |
| **Admin / Pastor** | PIN | Full oversight: live dashboard, monthly report with insights, manage leaders & locations, birthdays, audit log, CSV export, JSON backup/restore. |

### Smart features (beyond the basics)
- 📶 **Works fully offline** — installs as an app (PWA), saves locally, syncs when back online
- 💬 **Zero-cost WhatsApp** — tap-to-send pre-filled welcome messages (no API bill); upgrade to auto-send later
- ⏰ **Follow-up SLA** — auto-flags anyone not contacted within 48 hours
- 🎂 **Birthday reminders** — keeps the church family connected
- ⚠️ **Absence detection** — "absent 3 Sundays" warnings catch people slipping away
- 🔁 **Duplicate detection** — warns when a phone number already exists
- 📜 **Audit log** — every action tracked for accountability
- 🏛 **Multi-tenant ready** — rebrand for any church by editing one config file

---

## 🚀 Quick Start (local)

You need [Node.js](https://nodejs.org) v18+ installed.

```bash
# 1. install dependencies
npm install

# 2. run the dev server
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

### Demo logins
- **Cell Leader:** phone `08012345601`, PIN `5601` (PIN = last 4 digits of phone)
- **Admin:** PIN `1234`

---

## 🖼️ Adding your logo

Save your logo as **`public/church-logo.png`** (square, ~512×512px).
It appears automatically in the nav bar, welcome hero, browser tab, and installed-app icon.
A gold ✝️ placeholder shows until you add it.

---

## 🎨 Rebranding for another church

Edit **one file**: `src/data/church.config.js`

```js
export const CHURCH = {
  name: "Your Church Name",
  branch: "Your Branch",
  address: "Your address",
  leadPastor: "Pastor ...",
  // ... services, colors, messages, membership rules
};
```

Replace `public/church-logo.png`, update locations in `src/data/locations.js`, and you have a fully branded platform. This is what makes DC Connect a **product other churches can request**.

---

## 📦 Deploying

### Option A — GitHub Pages (free, easiest)
1. Push this folder to a GitHub repo.
2. In repo **Settings → Pages**, set source to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds & deploys on every push to `main`.

### Option B — Your DigitalOcean VPS
```bash
npm run build          # creates the dist/ folder
# copy dist/ to your web root, e.g.:
scp -r dist/* user@your-vps-ip:/var/www/dc-connect
```
Point Nginx/Cloudflare at that folder. (A ready-to-use SCP workflow is commented in `deploy.yml`.)

### Option C — Vercel / Netlify
Connect the repo, framework auto-detects as **Vite**. Done.

---

## 🔔 Enabling automatic WhatsApp/SMS (optional)

By default the app uses **tap-to-send** WhatsApp links — works immediately, costs nothing. To send messages **automatically**:

```bash
npm install express better-sqlite3 cors dotenv
cp .env.example .env     # fill in your Twilio or WhatsApp Cloud API keys
npm run server           # starts backend on port 4000
```

Then create a frontend `.env` with:
```
VITE_API_URL=http://your-vps-ip:4000
```

The backend (`server/index.js`) supports both **WhatsApp Cloud API (Meta)** and **Twilio**. Pick whichever you prefer in `.env`.

---

## 📁 Project structure

```
dc-dutse/
├── public/
│   └── church-logo.png          ← your logo goes here
├── src/
│   ├── data/
│   │   ├── church.config.js     ← REBRAND HERE (name, pastor, colors, messages)
│   │   ├── locations.js         ← FCT location repository
│   │   └── seed.js              ← departments, cell leaders, prayer points
│   ├── lib/
│   │   ├── storage.js           ← offline storage + sync queue + audit log
│   │   ├── notifications.js     ← WhatsApp links + auto-send hooks
│   │   ├── logic.js             ← assignment, membership, insights, birthdays
│   │   └── seedData.js          ← demo data
│   ├── pages/
│   │   ├── NewcomerPage.jsx     ← public registration
│   │   ├── CellLeaderPage.jsx   ← leader dashboard
│   │   └── AdminPage.jsx        ← admin oversight (10 tabs)
│   ├── components/Logo.jsx
│   ├── App.jsx
│   └── index.css
├── server/index.js              ← optional backend (SQLite + auto-messaging)
├── .github/workflows/deploy.yml
└── package.json
```

---

## 🔐 Security notes for production

- Change the admin PIN in `src/data/church.config.js` (and ideally move auth to the backend).
- Cell leader PINs default to the last 4 digits of their phone — ask leaders to treat them as private.
- For a public deployment with real data, run the backend and keep the database on your VPS, not in the browser.

---

## 🙏 A note

This was built to solve the real pain of manual data loss and poor followup — so no one who walks through the doors is ever forgotten. May it serve the Kingdom well.

*"...that we may present everyone mature in Christ." — Colossians 1:28*
