// ============================================================
//  NOTIFICATIONS
//  Two modes:
//  1. ZERO-COST (default): generates wa.me WhatsApp deep links &
//     SMS links. Works immediately, no API key, no billing.
//     Perfect for launch — leaders tap and the message is pre-filled.
//  2. AUTOMATED (optional): if VITE_API_URL is set, the backend
//     sends messages automatically via Twilio / WhatsApp Cloud API.
// ============================================================

import { CHURCH } from "../data/church.config.js";

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// Normalize a Nigerian phone number to international format for wa.me
export function toIntl(phone) {
  let p = (phone || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "234" + p.slice(1);
  else if (p.startsWith("234")) p = p;
  else if (p.length === 10) p = "234" + p;
  return p;
}

// Build a WhatsApp deep link (opens WhatsApp with message pre-filled)
export function waLink(phone, message) {
  return `https://wa.me/${toIntl(phone)}?text=${encodeURIComponent(message)}`;
}

// Build an SMS link (fallback for feature phones / no WhatsApp)
export function smsLink(phone, message) {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

// ---- Message builders ----

export function newcomerWelcomeMsg(nc, leader) {
  return fill(CHURCH.messages.newcomerWelcome, {
    church: CHURCH.name,
    branch: CHURCH.branch,
    firstName: (nc.name || "").split(" ")[0],
    leaderName: leader?.name || "your cell leader",
    leaderPhone: leader?.phone || "",
  });
}

export function leaderAssignmentMsg(nc, leader) {
  return fill(CHURCH.messages.leaderAssignment, {
    leaderName: (leader?.name || "").split(" ").slice(0, 2).join(" "),
    ncName: nc.name,
    ncPhone: nc.phone,
    ncArea: nc.area + (nc.sublocation ? ` (${nc.sublocation})` : ""),
    prayerPoints: (nc.prayerPoints || []).slice(0, 3).join(", ") || "—",
  });
}

export function deptInterestMsg(nc, dept) {
  return fill(CHURCH.messages.deptInterest, {
    ncName: nc.name,
    ncPhone: nc.phone,
    deptName: dept.name,
  });
}

export function membershipMsg(nc, count) {
  return fill(CHURCH.messages.membershipReached, {
    ncName: nc.name,
    count,
    foundationClass: CHURCH.foundationClass,
  });
}

export function birthdayMsg(nc) {
  return fill(CHURCH.messages.birthdayReminder, { name: nc.name });
}

// ---- Automated send (only if backend configured) ----

export async function sendAutomated(to, message, channel = "whatsapp") {
  const apiUrl = import.meta.env?.VITE_API_URL;
  if (!apiUrl) return { ok: false, reason: "no-backend", fallback: waLink(to, message) };
  try {
    const res = await fetch(`${apiUrl}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: toIntl(to), message, channel }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "send-failed" };
  } catch (e) {
    return { ok: false, reason: "offline", fallback: waLink(to, message) };
  }
}
