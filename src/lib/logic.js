// ============================================================
//  BUSINESS LOGIC
//  Assignment, membership promotion, follow-up SLA tracking,
//  birthday detection, duplicate detection, report insights.
// ============================================================

import { CHURCH } from "../data/church.config.js";
import { getDB } from "./storage.js";

// Auto-match a newcomer to the cell leader covering their area
export function assignCellLeader(area, sublocation) {
  const db = getDB();
  const leaders = db.cellLeaders || [];
  // try exact sublocation match first, then area
  const target = (sublocation || area || "").toLowerCase();
  const areaLc = (area || "").toLowerCase();
  let match = leaders.find((l) => l.areas?.some((a) => a.toLowerCase() === target));
  if (!match) match = leaders.find((l) => l.areas?.some((a) => a.toLowerCase() === areaLc));
  return match || leaders[0] || null;
}

// Recompute a newcomer's status based on attendance count
export function computeStatus(nc) {
  const count = (nc.attendance || []).length;
  if (count >= CHURCH.membershipThreshold) return "member";
  if (count > 0) return "active";
  return "new";
}

// Has this newcomer been contacted within the SLA window?
export function followupOverdue(nc) {
  if (nc.status === "member" || nc.contactedAt) return false;
  const submitted = new Date(nc.submittedAt).getTime();
  const hoursSince = (Date.now() - submitted) / (1000 * 60 * 60);
  return hoursSince > CHURCH.followupSLAHours;
}

// Hours since submission (for display)
export function hoursSinceSubmit(nc) {
  return Math.floor((Date.now() - new Date(nc.submittedAt).getTime()) / (1000 * 60 * 60));
}

// How many Sundays since last attendance (catches people slipping away)
export function sundaysAbsent(nc) {
  if (!nc.attendance || nc.attendance.length === 0) return null;
  const last = nc.attendance.map((d) => new Date(d)).sort((a, b) => b - a)[0];
  const weeks = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24 * 7));
  return weeks;
}

// Duplicate detection by phone number
export function findDuplicate(phone, excludeId = null) {
  const db = getDB();
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) return null;
  return (db.newcomers || []).find(
    (n) => n.id !== excludeId && (n.phone || "").replace(/\D/g, "") === clean
  );
}

// Upcoming birthdays (within next N days)
export function upcomingBirthdays(days = 14) {
  const db = getDB();
  const now = new Date();
  const results = [];
  (db.newcomers || []).forEach((n) => {
    if (!n.birthday) return;
    const bd = new Date(n.birthday);
    if (isNaN(bd)) return;
    const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (next < now.setHours(0, 0, 0, 0)) next.setFullYear(now.getFullYear() + 1);
    const diff = Math.ceil((next - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= days) results.push({ ...n, daysUntil: diff });
  });
  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

// Generate full monthly report insights
export function generateInsights() {
  const db = getDB();
  const ncs = db.newcomers || [];
  const now = new Date();
  const thisMonth = ncs.filter((n) => {
    const d = new Date(n.submittedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = ncs.filter((n) => {
    const d = new Date(n.submittedAt);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const members = ncs.filter((n) => n.status === "member");
  const active = ncs.filter((n) => n.status === "active");
  const newOnes = ncs.filter((n) => n.status === "new");
  const overdue = ncs.filter((n) => followupOverdue(n));
  const noDept = members.filter((n) => !n.departments?.length);

  // Department interest breakdown
  const deptCounts = (db.departments || []).map((d) => ({
    name: d.name,
    id: d.id,
    count: ncs.filter((n) => n.departments?.includes(d.id)).length,
  })).sort((a, b) => b.count - a.count);

  // Prayer point frequency (what is the church praying about most?)
  const prayerFreq = {};
  ncs.forEach((n) => (n.prayerPoints || []).forEach((p) => (prayerFreq[p] = (prayerFreq[p] || 0) + 1)));
  const topPrayers = Object.entries(prayerFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Area distribution (where are people coming from?)
  const areaCounts = {};
  ncs.forEach((n) => (areaCounts[n.area] = (areaCounts[n.area] || 0) + 1));
  const topAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);

  // Conversion rate (new -> member)
  const conversionRate = ncs.length ? Math.round((members.length / ncs.length) * 100) : 0;

  // Cell leader performance
  const leaderPerf = (db.cellLeaders || []).map((l) => {
    const assigned = ncs.filter((n) => n.assignedLeader?.id === l.id);
    return {
      name: l.name,
      zone: l.zone,
      assigned: assigned.length,
      members: assigned.filter((n) => n.status === "member").length,
      overdue: assigned.filter((n) => followupOverdue(n)).length,
    };
  }).sort((a, b) => b.members - a.members);

  return {
    month: now.toLocaleString("default", { month: "long", year: "numeric" }),
    total: ncs.length,
    thisMonth: thisMonth.length,
    lastMonth: lastMonth.length,
    growth: lastMonth.length ? Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100) : 0,
    members: members.length,
    active: active.length,
    newOnes: newOnes.length,
    overdue: overdue.length,
    noDept: noDept.length,
    bornAgain: ncs.filter((n) => n.bornAgain === "yes").length,
    baptizedHG: ncs.filter((n) => n.baptizedHG === "yes").length,
    baptizedWater: ncs.filter((n) => n.baptizedWater === "yes").length,
    male: ncs.filter((n) => n.gender === "Male").length,
    female: ncs.filter((n) => n.gender === "Female").length,
    conversionRate,
    deptCounts,
    topPrayers,
    topAreas,
    leaderPerf,
    upcomingBirthdays: upcomingBirthdays(30),
  };
}

// CSV export
export function toCSV(newcomers, departments) {
  const headers = ["Name", "Phone", "Area", "Sublocation", "Village", "Born Again", "Baptized HG", "Baptized Water", "How Came", "Inviter", "Gender", "Marital", "Birthday", "Status", "Attendance Count", "Last Attended", "Departments", "Prayer Points", "Assigned Leader", "Date Added"];
  const rows = newcomers.map((n) => [
    n.name, n.phone, n.area, n.sublocation || "", n.village || "",
    n.bornAgain, n.baptizedHG, n.baptizedWater, n.howCame, n.inviterName || "",
    n.gender, n.marital, n.birthday || "", n.status, (n.attendance || []).length,
    (n.attendance || []).slice(-1)[0] || "",
    (n.departments || []).map((d) => departments.find((x) => x.id === d)?.name || d).join("; "),
    (n.prayerPoints || []).join("; "),
    n.assignedLeader?.name || "",
    new Date(n.submittedAt).toLocaleDateString(),
  ]);
  return [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function downloadFile(content, filename, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
