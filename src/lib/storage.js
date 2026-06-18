// ============================================================
//  STORAGE LAYER  —  offline-first
//  All writes hit localStorage immediately. When a backend is
//  configured (VITE_API_URL), unsynced records get pushed up.
// ============================================================

import { CELL_LEADERS, DEPARTMENTS } from "../data/seed.js";
import {
  supabaseEnabled, sbListPeople, sbInsertPerson, sbUpdatePerson,
  sbDeletePerson, getChurchId, supabase,
  sbListReports, sbInsertReport, sbUpdateReport,
} from "./supabase.js";

const DB_KEY = "dc_dutse_db_v1";

export function getDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error("Storage full or unavailable", e);
  }
}

export function initDB() {
  const db = getDB();
  if (!db.newcomers) db.newcomers = [];
  if (!db.cellLeaders) db.cellLeaders = CELL_LEADERS;
  if (!db.leadership) db.leadership = []; // pastors, HODs, existing members (non-newcomer people)
  if (!db.departments) db.departments = DEPARTMENTS;
  if (!db.customLocations) db.customLocations = [];
  if (!db.removedLocations) db.removedLocations = [];
  if (!db.cellReports) db.cellReports = [];
  if (!db.cellAdminTabs) db.cellAdminTabs = null; // null = use defaults from config
  if (!db.syncQueue) db.syncQueue = [];
  if (!db.auditLog) db.auditLog = [];
  if (!db.deptHeads) db.deptHeads = {}; // deptId -> login pin (optional)
  saveDB(db);
  return db;
}

// Audit log — accountability for the pastor ("who changed this?")
export function logAction(action, detail, actor = "system") {
  const db = getDB();
  db.auditLog = db.auditLog || [];
  db.auditLog.unshift({
    id: "log_" + Date.now(),
    action,
    detail,
    actor,
    at: new Date().toISOString(),
  });
  // keep last 500 entries
  db.auditLog = db.auditLog.slice(0, 500);
  saveDB(db);
}

// Queue an item for backend sync when offline
export function queueSync(type, data) {
  const db = getDB();
  db.syncQueue = db.syncQueue || [];
  db.syncQueue.push({ type, data, ts: Date.now(), synced: false });
  saveDB(db);
}

// Attempt to flush the sync queue to the backend (if configured)
export async function flushSyncQueue() {
  const apiUrl = import.meta.env?.VITE_API_URL;
  if (!apiUrl) return { ok: false, reason: "no-backend" };
  const db = getDB();
  const pending = (db.syncQueue || []).filter((q) => !q.synced);
  if (pending.length === 0) return { ok: true, synced: 0 };

  let synced = 0;
  for (const item of pending) {
    try {
      const res = await fetch(`${apiUrl}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        item.synced = true;
        synced++;
      }
    } catch {
      // still offline — stop trying, keep queue intact
      break;
    }
  }
  saveDB(db);
  return { ok: true, synced };
}

// Full export for backup / migration
export function exportDB() {
  return JSON.stringify(getDB(), null, 2);
}

// Import a backup file (admin feature)
export function importDB(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    saveDB(data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function resetDB() {
  localStorage.removeItem(DB_KEY);
  return initDB();
}

// ============================================================
//  CLOUD SYNC (Supabase)
//  When Supabase is configured, the local DB mirrors the cloud.
//  pullFromCloud() loads people from Supabase into local state on
//  startup; pushPersonToCloud() / updatePersonInCloud() write
//  through on changes. Cell leaders & departments still seed
//  locally but are also stored as people rows (roles array).
// ============================================================

export { supabaseEnabled };

// Load all people from Supabase into the local DB shape.
// Splits the unified `people` table back into newcomers + cellLeaders.
export async function pullFromCloud() {
  if (!supabaseEnabled) return getDB();
  try {
    const people = await sbListPeople();
    const db = getDB();
    // Cell leaders = anyone with the cellLeader role
    const leaders = people.filter((p) => (p.roles || []).includes("cellLeader")).map((p) => ({
      id: p.id, name: p.name, phone: p.phone, email: p.email, gender: p.gender,
      zone: p.zone, roles: p.roles, areas: p.coverage || [],
      canLogin: p.canLogin,
    }));
    // Newcomers/members = everyone else (or those with newcomer/member role)
    const newcomers = people
      .filter((p) => !(p.roles || []).includes("cellLeader") || (p.roles || []).includes("newcomer") || (p.roles || []).includes("member"))
      .map((p) => ({
        ...p,
        assignedLeader: p.assignedLeaderId ? leaders.find((l) => l.id === p.assignedLeaderId) || null : null,
      }));
    // leadership = pastors, HODs, etc.
    const leadership = people.filter((p) =>
      (p.roles || []).some((r) => ["pastor", "zonalPastor", "deptHead"].includes(r))
    );
    db.newcomers = newcomers;
    db.cellLeaders = leaders.length ? leaders : db.cellLeaders;
    db.leadership = leadership;
    db.cloudLoaded = true;
    saveDB(db);
    // Also pull cell reports
    try { db.cellReports = await sbListReports(); saveDB(db); } catch (e) { /* ignore */ }
    return db;
  } catch (e) {
    console.error("Cloud pull failed, using local data", e);
    return getDB();
  }
}

export async function pushPersonToCloud(person) {
  if (!supabaseEnabled) return person;
  try { return await sbInsertPerson(person); }
  catch (e) { console.error("Cloud insert failed", e); return person; }
}

export async function updatePersonInCloud(id, patch) {
  if (!supabaseEnabled) return;
  try { await sbUpdatePerson(id, patch); }
  catch (e) { console.error("Cloud update failed", e); }
}

export async function deletePersonFromCloud(id) {
  if (!supabaseEnabled) return;
  try { await sbDeletePerson(id); }
  catch (e) { console.error("Cloud delete failed", e); }
}


// ============================================================
//  CELL REPORTS (local + cloud)
// ============================================================
export async function loadReports() {
  if (supabaseEnabled) {
    try {
      const reports = await sbListReports();
      const db = getDB();
      db.cellReports = reports;
      saveDB(db);
      return reports;
    } catch (e) { console.error("Report load failed", e); return getDB().cellReports || []; }
  }
  return getDB().cellReports || [];
}

export async function submitReport(report) {
  const db = getDB();
  db.cellReports = db.cellReports || [];
  if (supabaseEnabled) {
    try {
      const saved = await sbInsertReport(report);
      db.cellReports.unshift(saved);
      saveDB(db);
      return saved;
    } catch (e) { console.error("Report submit failed", e); }
  }
  const local = { id: "rpt_" + Date.now(), created_at: new Date().toISOString(), ...report };
  db.cellReports.unshift(local);
  saveDB(db);
  return local;
}

export async function updateReport(id, patch) {
  const db = getDB();
  const r = (db.cellReports || []).find((x) => x.id === id);
  if (r) Object.assign(r, patch);
  saveDB(db);
  if (supabaseEnabled) {
    try { await sbUpdateReport(id, patch); } catch (e) { console.error("Report update failed", e); }
  }
}
