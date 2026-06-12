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

// Build a full digest message to a cell leader: greets them, lists every
// newcomer assigned to them (name + phone), and reminds them how to log in.
// `loginUrl` is the live app link (e.g. https://dcdutse.vercel.app).
export function leaderDigestMsg(leader, assignedList, loginUrl) {
  const firstName = (leader.name || "").split(" ").slice(0, 2).join(" ");
  const pin = (leader.phone || "").slice(-4);
  const lines = assignedList.map((n, i) => {
    const area = n.area ? `, ${n.area}${n.sublocation ? ` (${n.sublocation})` : ""}` : "";
    return `${i + 1}. ${n.name} — ${n.phone}${area}`;
  });
  const body = lines.length
    ? lines.join("\n")
    : "(No one is currently assigned to you.)";
  return (
    `🙏 Hello ${firstName}! Grace and peace.\n\n` +
    `You have ${assignedList.length} ${assignedList.length === 1 ? "soul" : "souls"} assigned to your cell for follow-up:\n\n` +
    `${body}\n\n` +
    `Please reach out to welcome them and invite them to your HomeCell. ` +
    `Kindly log in to update their attendance and follow-up status here:\n${loginUrl}\n\n` +
    `Your login: phone number ${leader.phone}, PIN ${pin} (the last 4 digits of your phone). ` +
    `God bless you for your labour of love! ✝️`
  );
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

// Personalize a broadcast template per recipient.
// Supports {firstName}, {name}, {church}, {branch}, {leaderName}.
export function personalize(template, person, leader) {
  return template
    .replace(/\{firstName\}/g, (person.name || "").split(" ")[0])
    .replace(/\{name\}/g, person.name || "")
    .replace(/\{church\}/g, CHURCH.name)
    .replace(/\{branch\}/g, CHURCH.branch)
    .replace(/\{leaderName\}/g, leader?.name || "your cell leader")
    .replace(/\{area\}/g, person.area || "");
}

// Personalized birthday message (auto-sent or tap-to-send)
export function personalizedBirthdayMsg(person) {
  const first = (person.name || "").split(" ")[0];
  return (
    `🎂🎉 Happy Birthday, ${first}! 🎉🎂\n\n` +
    `On behalf of the entire ${CHURCH.name} ${CHURCH.branch} family, ` +
    `we celebrate the gift of your life today. May this new year of your life ` +
    `overflow with God's favour, divine health, and breakthrough. ` +
    `You are deeply loved and valued here.\n\n` +
    `We look forward to celebrating with you! God bless you richly. ✝️\n\n` +
    `— ${CHURCH.leadPastor} & the entire ${CHURCH.name} family`
  );
}

// Build a mailto: link (works with any email client, zero cost / no API)
export function mailtoLink(email, subject, body) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
