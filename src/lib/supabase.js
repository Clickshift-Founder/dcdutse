// ============================================================
//  SUPABASE CLIENT + DATA ADAPTER
//  If VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set,
//  the app uses the shared cloud database. If not, it falls
//  back to localStorage so the demo still works offline.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env?.VITE_SUPABASE_URL;
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(URL && KEY);
export const supabase = supabaseEnabled ? createClient(URL, KEY) : null;

let CHURCH_ID = null;

// Resolve (or cache) the church row id for DC Dutse
export async function getChurchId() {
  if (!supabaseEnabled) return null;
  if (CHURCH_ID) return CHURCH_ID;
  const { data } = await supabase.from("churches").select("id").limit(1).maybeSingle();
  CHURCH_ID = data?.id || null;
  return CHURCH_ID;
}

// Map a DB people row -> the shape the app's components expect
export function rowToPerson(r) {
  return {
    id: r.id,
    name: r.name, phone: r.phone, email: r.email,
    roles: r.roles || [], status: r.status,
    area: r.area, sublocation: r.sublocation, village: r.village, street: r.street,
    bornAgain: r.born_again ? "yes" : r.born_again === false ? "no" : "",
    baptizedHG: r.baptized_hg ? "yes" : r.baptized_hg === false ? "no" : "",
    baptizedWater: r.baptized_water ? "yes" : r.baptized_water === false ? "no" : "",
    howCame: r.how_came, inviterName: r.inviter_name, mission: r.mission,
    gender: r.gender, marital: r.marital, birthday: r.birthday,
    prayerPoints: r.prayer_points || [], customPrayer: r.custom_prayer,
    departments: r.departments || [], deptAssigned: r.dept_assigned,
    assignedLeaderId: r.assigned_leader_id,
    assignedLeaderName: r.assigned_leader_name,
    assignedLeaderPhone: r.assigned_leader_phone,
    attendance: (r.attendance || []).map((d) => (typeof d === "string" ? d : d)),
    contactedAt: r.contacted_at, whatsappAdded: r.whatsapp_added,
    zone: r.zone, coverage: r.coverage || [], canLogin: r.can_login, deptId: r.dept_id,
    lastBirthdayGreeted: r.last_birthday_greeted,
    submittedAt: r.created_at,
  };
}

// Map an app person -> DB columns
export function personToRow(p, churchId) {
  const yn = (v) => (v === "yes" ? true : v === "no" ? false : null);
  // assigned_leader_id is a uuid column. Only pass a value if it's a real UUID;
  // a local/generated id (e.g. "cl_csv_123") would crash the insert.
  const rawLeaderId = p.assignedLeaderId || p.assignedLeader?.id || null;
  const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const leaderId = isUuid(rawLeaderId) ? rawLeaderId : null;
  return {
    church_id: churchId,
    name: p.name, phone: p.phone, email: p.email || null,
    roles: p.roles || ["newcomer"], status: p.status || "new",
    area: p.area, sublocation: p.sublocation, village: p.village, street: p.street,
    born_again: yn(p.bornAgain), baptized_hg: yn(p.baptizedHG), baptized_water: yn(p.baptizedWater),
    how_came: p.howCame, inviter_name: p.inviterName, mission: p.mission,
    gender: p.gender, marital: p.marital,
    birthday: p.birthday || null,                 // stored as text (see SQL migration)
    prayer_points: p.prayerPoints || [], custom_prayer: p.customPrayer,
    departments: p.departments || [], dept_assigned: p.deptAssigned || null,
    assigned_leader_id: leaderId,
    assigned_leader_name: p.assignedLeader?.name || null,
    assigned_leader_phone: p.assignedLeader?.phone || null,
    attendance: p.attendance || [],
    contacted_at: p.contactedAt || null, whatsapp_added: !!p.whatsappAdded,
    zone: p.zone, coverage: p.coverage || [], can_login: !!p.canLogin, dept_id: p.deptId || null,
    last_birthday_greeted: p.lastBirthdayGreeted || null,
  };
}

// ---- CRUD ----
export async function sbListPeople() {
  const cid = await getChurchId();
  const { data, error } = await supabase.from("people").select("*").eq("church_id", cid).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToPerson);
}

export async function sbInsertPerson(p) {
  const cid = await getChurchId();
  const { data, error } = await supabase.from("people").insert(personToRow(p, cid)).select().single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function sbUpdatePerson(id, patch) {
  const cid = await getChurchId();
  const { data, error } = await supabase.from("people").update(personToRow(patch, cid)).eq("id", id).select().single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function sbDeletePerson(id) {
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) throw error;
}

export async function sbLogAudit(action, detail, actor) {
  const cid = await getChurchId();
  await supabase.from("audit").insert({ church_id: cid, action, detail, actor });
}

export async function sbListAudit() {
  const cid = await getChurchId();
  const { data } = await supabase.from("audit").select("*").eq("church_id", cid).order("at", { ascending: false }).limit(100);
  return data || [];
}

// ---- Campaigns / messages ----
export async function sbCreateCampaign(c) {
  const cid = await getChurchId();
  const { data, error } = await supabase.from("campaigns").insert({ church_id: cid, ...c }).select().single();
  if (error) throw error;
  return data;
}

export async function sbLogMessage(m) {
  const cid = await getChurchId();
  await supabase.from("messages").insert({ church_id: cid, ...m });
}

// ---- Cell reports ----
export async function sbListReports() {
  const cid = await getChurchId();
  const { data, error } = await supabase.from("cell_reports").select("*").eq("church_id", cid).order("week_of", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function sbInsertReport(r) {
  const cid = await getChurchId();
  const { data, error } = await supabase.from("cell_reports").insert({ church_id: cid, ...r }).select().single();
  if (error) throw error;
  return data;
}

export async function sbUpdateReport(id, patch) {
  const { data, error } = await supabase.from("cell_reports").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
