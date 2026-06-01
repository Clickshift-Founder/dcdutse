// ============================================================
//  STORAGE LAYER  —  offline-first
//  All writes hit localStorage immediately. When a backend is
//  configured (VITE_API_URL), unsynced records get pushed up.
// ============================================================

import { CELL_LEADERS, DEPARTMENTS } from "../data/seed.js";

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
