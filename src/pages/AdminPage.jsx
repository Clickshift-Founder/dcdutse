import { useState, useRef } from "react";
import { CHURCH, ADMIN_PIN } from "../data/church.config.js";
import { LOCATION_DATA, mergeLocations } from "../data/locations.js";
import { DEPARTMENTS } from "../data/seed.js";
import { getDB, saveDB, logAction, exportDB, importDB, resetDB, pushPersonToCloud, updatePersonInCloud, deletePersonFromCloud, supabaseEnabled } from "../lib/storage.js";
import { generateInsights, assignCellLeader, followupOverdue, upcomingBirthdays, toCSV, downloadFile } from "../lib/logic.js";
import { waLink, smsLink, birthdayMsg, leaderDigestMsg, leaderAssignmentMsg, personalize, personalizedBirthdayMsg, mailtoLink, sendAutomated } from "../lib/notifications.js";

export default function AdminPage({ db, refreshDB, auth, setAuth }) {
  const [login, setLogin] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("dashboard");
  const fileRef = useRef();

  const doLogin = () => {
    if (login === ADMIN_PIN) { setAuth((a) => ({ ...a, admin: true })); setErr(""); logAction("admin_login", "Admin signed in", "admin"); }
    else setErr("Incorrect admin PIN.");
  };

  if (!auth.admin) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div style={{ textAlign: "center", marginBottom: 20, fontSize: 24 }}>⚙️</div>
          <div className="login-title">Admin Access</div>
          <div className="login-sub">Enter the admin PIN to continue</div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Admin PIN</label>
            <input className="form-input" type="password" placeholder="••••" inputMode="numeric" value={login}
              onChange={(e) => setLogin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
          </div>
          {err && <div className="notice notice-danger" style={{ marginBottom: 14 }}>{err}</div>}
          <button className="btn-primary" onClick={doLogin}>Enter Admin Dashboard</button>
          <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", marginTop: 10 }}>Default PIN: {ADMIN_PIN}</p>
        </div>
      </div>
    );
  }

  const newcomers = db.newcomers || [];
  const members = newcomers.filter((n) => n.status === "member");
  const insights = generateInsights();

  const updateStatus = (id, status) => {
    const curr = getDB();
    const n = curr.newcomers.find((x) => x.id === id);
    if (n) {
      n.status = status; saveDB(curr); logAction("status_changed", `${n.name} → ${status}`, "admin");
      if (supabaseEnabled) updatePersonInCloud(id, { ...n, status });
      refreshDB();
    }
  };
  const assignDept = (id, deptId) => {
    const curr = getDB();
    const n = curr.newcomers.find((x) => x.id === id);
    if (n) {
      n.departments = deptId ? [deptId] : [];
      n.deptAssigned = deptId || null;
      saveDB(curr); logAction("dept_assigned", `${n.name} → ${deptId || "none"}`, "admin");
      if (supabaseEnabled) updatePersonInCloud(id, { ...n });
      refreshDB();
    }
  };
  const deleteNC = (id) => {
    if (!confirm("Delete this record permanently?")) return;
    const curr = getDB();
    curr.newcomers = curr.newcomers.filter((n) => n.id !== id);
    saveDB(curr); logAction("record_deleted", id, "admin");
    if (supabaseEnabled) deletePersonFromCloud(id);
    refreshDB();
  };

  const exportCSV = () => {
    downloadFile(toCSV(newcomers, DEPARTMENTS), `dc_dutse_${new Date().toISOString().split("T")[0]}.csv`);
    logAction("export_csv", `${newcomers.length} records`, "admin");
  };
  const exportBackup = () => downloadFile(exportDB(), `dc_dutse_backup_${Date.now()}.json`, "application/json");
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importDB(reader.result);
      if (res.ok) { alert("Backup restored successfully!"); refreshDB(); }
      else alert("Import failed: " + res.error);
    };
    reader.readAsText(file);
  };

  const adminTabs = [
    ["dashboard", "📊 Dashboard"], ["report", "📈 Monthly Report"], ["cellperf", "🎯 Cell Performance"],
    ["newcomers", "👥 All Records"], ["assignments", "🔗 Assignments"], ["broadcast", "📢 Broadcast"],
    ["deptoversight", "🏛 Dept Oversight"], ["directory", "📖 Directory"], ["people", "➕ Add People"],
    ["members", "🏅 Members"], ["pending", "🌱 Not Yet Members"], ["flagged", "🚩 Flagged"],
    ["birthdays", "🎂 Birthdays"], ["leaders", "🧑‍💼 Cell Leaders"], ["locations", "📍 Locations"],
    ["audit", "📜 Audit Log"], ["settings", "⚙️ Settings"],
  ];

  return (
    <div className="page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 className="section-title">Admin Dashboard</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{CHURCH.name} {CHURCH.branch} · {CHURCH.leadPastor}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-secondary" style={{ fontSize: 12 }} onClick={exportCSV}>⬇️ Export CSV</button>
          <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setAuth((a) => ({ ...a, admin: false }))}>Logout</button>
        </div>
      </div>

      <div className="tab-bar">
        {adminTabs.map(([id, label]) => (
          <button key={id} className={"tab-btn" + (tab === id ? " active" : "")} onClick={() => setTab(id)} style={{ flex: "0 0 auto" }}>{label}</button>
        ))}
      </div>

      {tab === "dashboard" && <Dashboard insights={insights} newcomers={newcomers} leaders={db.cellLeaders || []} />}
      {tab === "report" && <MonthlyReport insights={insights} onExport={exportCSV} />}
      {tab === "cellperf" && <CellPerformance db={db} newcomers={newcomers} />}
      {tab === "newcomers" && <AllRecords newcomers={newcomers} onStatus={updateStatus} onDept={assignDept} onDelete={deleteNC} />}
      {tab === "assignments" && <Assignments db={db} newcomers={newcomers} refreshDB={refreshDB} />}
      {tab === "broadcast" && <Broadcast db={db} newcomers={newcomers} />}
      {tab === "deptoversight" && <DeptOversight db={db} newcomers={newcomers} onAssignHead={assignDept} />}
      {tab === "directory" && <Directory db={db} newcomers={newcomers} refreshDB={refreshDB} />}
      {tab === "people" && <AddPeople db={db} refreshDB={refreshDB} />}
      {tab === "members" && <Members members={members} leadership={db.leadership || []} onAssignDept={assignDept} />}
      {tab === "pending" && <NotYetMembers newcomers={newcomers} />}
      {tab === "flagged" && <Flagged newcomers={newcomers} />}
      {tab === "birthdays" && <Birthdays />}
      {tab === "leaders" && <Leaders db={db} newcomers={newcomers} refreshDB={refreshDB} />}
      {tab === "locations" && <Locations db={db} refreshDB={refreshDB} />}
      {tab === "audit" && <AuditLog log={db.auditLog || []} />}
      {tab === "settings" && <Settings db={db} fileRef={fileRef} onBackup={exportBackup} onImport={handleImport} refreshDB={refreshDB} />}
    </div>
  );
}

function Dashboard({ insights, newcomers, leaders }) {
  return (
    <>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{insights.total}</div><div className="stat-label">Total Newcomers</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--green)" }}>{insights.members}</div><div className="stat-label">Full Members</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--blue)" }}>{insights.active}</div><div className="stat-label">In Progress</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--red)" }}>{insights.overdue}</div><div className="stat-label">Overdue Follow-up</div></div>
        <div className="stat-card"><div className="stat-num">{insights.conversionRate}%</div><div className="stat-label">Conversion Rate</div></div>
        <div className="stat-card"><div className="stat-num">{leaders.length}</div><div className="stat-label">Cell Leaders</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }} className="dash-cols">
        <BarPanel title="Department Interest" rows={insights.deptCounts.slice(0, 6).map((d) => [d.name, d.count, insights.total])} />
        <BarPanel title="Spiritual & Demographics" rows={[
          ["Born Again", insights.bornAgain, insights.total, "var(--green)"],
          ["Baptized (HG)", insights.baptizedHG, insights.total, "var(--gold)"],
          ["Baptized (Water)", insights.baptizedWater, insights.total, "var(--blue)"],
          ["Female", insights.female, insights.total, "#ec4899"],
          ["Male", insights.male, insights.total, "var(--blue)"],
        ]} />
      </div>

      <div className="form-card" style={{ marginBottom: 0 }}>
        <div className="form-section-title">Cell Leader Coverage</div>
        {insights.leaderPerf.map((l) => (
          <div key={l.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{l.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.zone}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--navy)", fontWeight: 600 }}>{l.assigned} assigned · {l.members} members</div>
              {l.overdue > 0 && <div style={{ fontSize: 11, color: "var(--red)" }}>{l.overdue} overdue</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BarPanel({ title, rows }) {
  return (
    <div className="form-card" style={{ margin: 0 }}>
      <div className="form-section-title">{title}</div>
      {rows.map(([label, count, total, color]) => {
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
              <span>{label}</span><span style={{ color: color || "var(--gold)" }}>{count}{total ? ` (${pct}%)` : ""}</span>
            </div>
            <div className="report-bar"><div className="report-fill" style={{ width: pct + "%", background: color || undefined }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyReport({ insights, onExport }) {
  return (
    <div>
      <div className="notice" style={{ marginBottom: 20 }}>
        📈 Report for <strong>{insights.month}</strong> · {insights.thisMonth} new this month
        {insights.growth !== 0 && <span style={{ color: insights.growth > 0 ? "var(--green)" : "var(--red)" }}> ({insights.growth > 0 ? "+" : ""}{insights.growth}% vs last month)</span>}
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{insights.thisMonth}</div><div className="stat-label">New This Month</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--green)" }}>{insights.members}</div><div className="stat-label">Total Members</div></div>
        <div className="stat-card"><div className="stat-num">{insights.conversionRate}%</div><div className="stat-label">Conversion</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--red)" }}>{insights.noDept}</div><div className="stat-label">Members, No Dept</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="form-card" style={{ margin: 0 }}>
          <div className="form-section-title">🙏 Top Prayer Needs</div>
          {insights.topPrayers.map(([p, c], i) => (
            <div key={p} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>{p}</span><span style={{ color: "var(--navy)", fontWeight: 600 }}>{c}</span>
            </div>
          ))}
          {insights.topPrayers.length === 0 && <p style={{ fontSize: 12, color: "var(--text-dim)" }}>No data yet</p>}
        </div>
        <div className="form-card" style={{ margin: 0 }}>
          <div className="form-section-title">📍 Where People Come From</div>
          {insights.topAreas.slice(0, 6).map(([a, c], i) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < 5 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>{a}</span><span style={{ color: "var(--navy)", fontWeight: 600 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      <BarPanel title="Department Pipeline" rows={insights.deptCounts.map((d) => [d.name, d.count, insights.total])} />

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn-primary" style={{ maxWidth: 280 }} onClick={onExport}>⬇️ Download Full CSV Report</button>
        <button className="btn-secondary" onClick={() => window.print()}>🖨️ Print This Report</button>
      </div>
    </div>
  );
}

function AllRecords({ newcomers, onStatus, onDept, onDelete }) {
  const [q, setQ] = useState("");
  const filtered = newcomers.filter((n) => !q || n.name.toLowerCase().includes(q.toLowerCase()) || n.phone.includes(q) || n.area.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <input className="form-input" placeholder="🔍 Search by name, phone, or area..." value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 16, maxWidth: 400 }} />
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>{filtered.length} of {newcomers.length} records</p>
      {filtered.map((nc) => (
        <div key={nc.id} className="newcomer-row">
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{nc.name}</div>
            <div className="newcomer-meta">📞 {nc.phone} · 📍 {nc.area}{nc.sublocation ? ` › ${nc.sublocation}` : ""}</div>
            <div className="newcomer-meta">👤 {nc.assignedLeader?.name || "Unassigned"} · {new Date(nc.submittedAt).toLocaleDateString()}</div>
            <div className="attend-dots">
              {Array.from({ length: CHURCH.membershipThreshold }).map((_, i) => <div key={i} className={"attend-dot " + (i < nc.attendance.length ? "dot-present" : "dot-absent")} />)}
              <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 4 }}>{nc.attendance.length}/{CHURCH.membershipThreshold}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <span className={"status-pill " + (nc.status === "new" ? "pill-new" : nc.status === "member" ? "pill-member" : nc.status === "flagged" ? "pill-flagged" : "pill-active")}>{nc.status}</span>
            <select className="form-input form-select" style={{ fontSize: 11, padding: "4px 24px 4px 8px", width: "auto" }} value={nc.status} onChange={(e) => onStatus(nc.id, e.target.value)}>
              {["new", "active", "member", "flagged"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {nc.status === "member" && (
              <select className="form-input form-select" style={{ fontSize: 11, padding: "4px 24px 4px 8px", width: "auto" }} value={nc.departments?.[0] || ""} onChange={(e) => onDept(nc.id, e.target.value)}>
                <option value="">No dept</option>
                {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <button className="btn-danger" onClick={() => onDelete(nc.id)}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}

// ---- Assignments: manually assign unassigned newcomers + message leaders ----
function Assignments({ db, newcomers, refreshDB }) {
  const [view, setView] = useState("unassigned");
  const leaders = db.cellLeaders || [];

  const unassigned = newcomers.filter((n) => !n.assignedLeader);

  const assignTo = (ncId, leaderId) => {
    if (!leaderId) return;
    const leader = leaders.find((l) => l.id === leaderId);
    const curr = getDB();
    const nc = curr.newcomers.find((n) => n.id === ncId);
    if (nc && leader) {
      nc.assignedLeader = leader;
      saveDB(curr);
      logAction("manual_assign", `${nc.name} → ${leader.name}`, "admin");
      if (supabaseEnabled) updatePersonInCloud(ncId, { ...nc, assignedLeaderId: leader.id });
      refreshDB();
    }
  };

  // Suggest the geographically closest leader for an unassigned newcomer
  const suggestLeader = (nc) => {
    const sub = (nc.sublocation || "").toLowerCase();
    const area = (nc.area || "").toLowerCase();
    let s = leaders.find((l) => l.areas?.some((a) => a.toLowerCase() === sub));
    if (!s) s = leaders.find((l) => l.areas?.some((a) => a.toLowerCase() === area));
    return s || null;
  };

  return (
    <>
      <div className="tab-bar" style={{ marginBottom: 18 }}>
        {[["unassigned", `🔴 Unassigned (${unassigned.length})`], ["byleader", "📣 Message Leaders"]].map(([id, label]) => (
          <button key={id} className={"tab-btn" + (view === id ? " active" : "")} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {view === "unassigned" && (
        <>
          <div className="notice notice-warn" style={{ marginBottom: 16 }}>
            🔗 These newcomers had no cell leader covering their exact location. Assign each to the closest leader — a suggestion is pre-selected where possible.
          </div>
          {unassigned.map((nc) => {
            const suggested = suggestLeader(nc);
            return (
              <div key={nc.id} className="newcomer-row">
                <div style={{ flex: 1 }}>
                  <div className="newcomer-name">{nc.name}</div>
                  <div className="newcomer-meta">📞 {nc.phone} · 📍 {nc.area}{nc.sublocation ? ` › ${nc.sublocation}` : ""}{nc.village ? ` › ${nc.village}` : ""}</div>
                  {suggested && <div className="newcomer-meta" style={{ color: "var(--blue)" }}>💡 Suggested: {suggested.name} ({suggested.zone})</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <select className="form-input form-select" style={{ fontSize: 12, padding: "7px 28px 7px 10px", width: "auto" }} defaultValue={suggested?.id || ""} id={`assign-${nc.id}`}>
                    <option value="">— Choose leader —</option>
                    {leaders.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.zone}</option>)}
                  </select>
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => assignTo(nc.id, document.getElementById(`assign-${nc.id}`).value)}>✓ Assign</button>
                </div>
              </div>
            );
          })}
          {unassigned.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>Everyone is assigned to a cell leader 🎉</div>}
        </>
      )}

      {view === "byleader" && (
        <>
          <div className="notice" style={{ marginBottom: 16 }}>
            📣 Tap to send each cell leader a WhatsApp message listing everyone assigned to them, with a reminder to log in at <code>{CHURCH.appUrl}</code>. Great for your weekly followup push — works now, no API needed.
          </div>
          {leaders.map((l) => {
            const assigned = newcomers.filter((n) => n.assignedLeader?.id === l.id);
            const msg = leaderDigestMsg(l, assigned, CHURCH.appUrl);
            return (
              <div key={l.id} className="newcomer-row">
                <div style={{ flex: 1 }}>
                  <div className="newcomer-name">{l.name}</div>
                  <div className="newcomer-meta">📞 {l.phone} · {l.zone || "—"}</div>
                  <div className="newcomer-meta">{assigned.length} {assigned.length === 1 ? "soul" : "souls"} assigned{assigned.length ? `: ${assigned.slice(0, 3).map((n) => n.name.split(" ")[0]).join(", ")}${assigned.length > 3 ? "…" : ""}` : ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <a className="btn-wa" href={waLink(l.phone, msg)} target="_blank" rel="noreferrer">💬 Send List</a>
                  <a className="btn-wa" href={`tel:${l.phone}`} style={{ background: "var(--blue-soft)", borderColor: "#d4e2fb", color: "var(--navy)" }}>📞 Call</a>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function Members({ members, leadership, onAssignDept }) {
  const noDept = members.filter((n) => !n.deptAssigned);

  // Build dept options labelled with their Head of Department name
  const headName = (deptId) => {
    const head = (leadership || []).find((p) => (p.roles || []).includes("deptHead") && p.deptId === deptId);
    return head?.name || DEPARTMENTS.find((d) => d.id === deptId)?.leader || "";
  };

  return (
    <>
      {noDept.length > 0 && <div className="notice notice-warn">⚠️ {noDept.length} member{noDept.length > 1 ? "s have" : " has"} not been assigned to a department. Use the dropdown to assign them (their indicated interest is marked ⭐). They need {CHURCH.foundationClass} before functioning.</div>}
      {members.map((nc) => {
        const indicated = nc.departments || [];
        return (
          <div key={nc.id} className="newcomer-row">
            <div style={{ flex: 1 }}>
              <div className="newcomer-name">{nc.name} {nc.whatsappAdded ? "✅" : "⚠️"}</div>
              <div className="newcomer-meta">📞 {nc.phone} · 📍 {nc.area}</div>
              <div className="newcomer-meta">Cell: {nc.assignedLeader?.name || "—"}</div>
              {nc.deptAssigned
                ? <div className="newcomer-meta" style={{ color: "var(--green)" }}>✓ Serving in {DEPARTMENTS.find((d) => d.id === nc.deptAssigned)?.name} (Head: {headName(nc.deptAssigned)})</div>
                : indicated.length
                  ? <div className="newcomer-meta" style={{ color: "var(--gold)" }}>⭐ Indicated interest: {indicated.map((d) => DEPARTMENTS.find((x) => x.id === d)?.name).join(", ")}</div>
                  : <div className="newcomer-meta" style={{ color: "var(--text-dim)" }}>No department indicated</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              <span className="status-pill pill-member">Member</span>
              {!nc.whatsappAdded && <span className="status-pill pill-flagged">WhatsApp Pending</span>}
              <select className="form-input form-select" style={{ fontSize: 11, padding: "5px 26px 5px 8px", width: "auto", maxWidth: 200 }} value={nc.deptAssigned || ""} onChange={(e) => onAssignDept(nc.id, e.target.value)}>
                <option value="">— Assign department —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.id}>{indicated.includes(d.id) ? "⭐ " : ""}{d.name} → {headName(d.id) || "no head"}</option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
      {members.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No full members yet</div>}
    </>
  );
}

const ROLES = [
  { id: "member", label: "Member" },
  { id: "cellLeader", label: "Cell Leader" },
  { id: "zonalPastor", label: "Zonal Pastor" },
  { id: "deptHead", label: "Head of Department" },
  { id: "pastor", label: "Pastor" },
];

// ---- Add People: register existing pastors, HODs, members (not newcomers) ----
function AddPeople({ db, refreshDB }) {
  const LOC = mergeLocations(LOCATION_DATA, db.customLocations || []);
  const blank = { name: "", phone: "", email: "", roles: [], zone: "", deptId: "", canLogin: false, area: "", sublocation: "", village: "" };
  const [f, setF] = useState(blank);
  const [imported, setImported] = useState(null);
  const importRef = useRef();

  const subList = f.area ? Object.keys(LOC[f.area]?.subs || {}) : [];
  const villageList = f.area && f.sublocation ? (LOC[f.area]?.subs?.[f.sublocation] || []) : [];

  const toggleRole = (r) => setF((x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }));

  const add = () => {
    if (!f.name || !f.phone) return alert("Name and phone are required.");
    const curr = getDB();
    curr.leadership = curr.leadership || [];
    const person = {
      id: "person_" + Date.now(),
      name: f.name, phone: f.phone,
      roles: f.roles.length ? f.roles : ["member"],
      zone: f.zone, deptId: f.deptId,
      canLogin: f.canLogin,
      status: "member",
      addedAt: new Date().toISOString(),
    };
    curr.leadership.push(person);
    // If they're a cell leader and can log in, also add to cellLeaders so the portal works
    if (f.roles.includes("cellLeader") && f.canLogin) {
      curr.cellLeaders = curr.cellLeaders || [];
      curr.cellLeaders.push({ id: "cl_" + Date.now(), name: f.name, phone: f.phone, zone: f.zone || "—", roles: f.roles, areas: [] });
    }
    saveDB(curr);
    logAction("person_added", `${f.name} (${f.roles.join(", ") || "member"})`, "admin");
    // Push to cloud as a people row with the chosen roles
    if (supabaseEnabled) {
      pushPersonToCloud({
        name: f.name, phone: f.phone, email: f.email || null,
        roles: f.roles.length ? f.roles : ["member"],
        status: "member", zone: f.zone, deptId: f.deptId, canLogin: f.canLogin,
        area: f.area, sublocation: f.sublocation, village: f.village,
      }).then(() => refreshDB());
    } else {
      refreshDB();
    }
    setF(blank);
  };

  // CSV import: columns Name,Phone,Email,Roles,Zone,Department
  const handleCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = reader.result.split(/\r?\n/).filter((l) => l.trim());
      const rows = lines.slice(1); // skip header
      const curr = getDB();
      curr.leadership = curr.leadership || [];
      let count = 0;
      const cloudInserts = [];
      rows.forEach((line) => {
        const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        const [name, phone, email, roles, zone, dept] = cells;
        if (!name || !phone) return;
        const roleArr = roles ? roles.split(/[;|]/).map((r) => r.trim()).filter(Boolean) : ["member"];
        curr.leadership.push({
          id: "person_" + Date.now() + "_" + count,
          name, phone, email: email || "",
          roles: roleArr,
          zone: zone || "", deptId: dept || "",
          canLogin: false, status: "member",
          addedAt: new Date().toISOString(),
        });
        if (supabaseEnabled) {
          cloudInserts.push(pushPersonToCloud({
            name, phone, email: email || null, roles: roleArr,
            status: "member", zone: zone || "", deptId: dept || "",
          }));
        }
        count++;
      });
      saveDB(curr);
      logAction("csv_import", `${count} people imported`, "admin");
      if (supabaseEnabled) { await Promise.all(cloudInserts); }
      refreshDB();
      setImported(count);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        ➕ Add existing church people who aren't newcomers — pastors, heads of department, cell leaders, and established members. Login is optional (most pastors/HODs don't need it; cell leaders do).
      </div>

      <div className="form-card">
        <div className="form-section-title">Add a Person</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" placeholder="Pastor / Bro / Sis ..." value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" placeholder="0801..." value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} /></div>
        </div>
        <div className="form-group" style={{ marginTop: 14 }}><label className="form-label">Email (optional)</label><input className="form-input" type="email" placeholder="name@email.com — for email notifications" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} /></div>

        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">Home Address (optional, but helps with cell matching)</label>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <select className="form-input form-select" value={f.area} onChange={(e) => setF((x) => ({ ...x, area: e.target.value, sublocation: "", village: "" }))}>
              <option value="">— Area —</option>
              {Object.keys(LOC).map((a) => <option key={a} value={a}>{LOC[a].label}</option>)}
            </select>
            <select className="form-input form-select" value={f.sublocation} onChange={(e) => setF((x) => ({ ...x, sublocation: e.target.value, village: "" }))} disabled={!f.area}>
              <option value="">{f.area ? "— Neighbourhood —" : "Area first"}</option>
              {subList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-input form-select" value={f.village} onChange={(e) => setF((x) => ({ ...x, village: e.target.value }))} disabled={!f.sublocation}>
              <option value="">{f.sublocation ? "— Village —" : "Neighbourhood first"}</option>
              {villageList.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="notice notice-warn" style={{ marginTop: 14, marginBottom: 0 }}>
          💡 Adding a <strong>cell leader</strong>? Use the <strong>🧑‍💼 Cell Leaders</strong> tab instead — it lets you set their coverage locations so newcomers auto-match to them.
        </div>

        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">Role(s) — select all that apply</label>
          <div className="toggle-group">
            {ROLES.map((r) => (
              <button key={r.id} className={"toggle-btn" + (f.roles.includes(r.id) ? " selected" : "")} onClick={() => toggleRole(r.id)} style={{ fontSize: 12, padding: "8px 14px" }}>{r.label}</button>
            ))}
          </div>
        </div>

        <div className="form-grid-2" style={{ marginTop: 14 }}>
          {(f.roles.includes("cellLeader") || f.roles.includes("zonalPastor")) && (
            <div className="form-group"><label className="form-label">Zone</label><input className="form-input" placeholder="e.g. Dutse Main Zone" value={f.zone} onChange={(e) => setF((x) => ({ ...x, zone: e.target.value }))} /></div>
          )}
          {f.roles.includes("deptHead") && (
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-input form-select" value={f.deptId} onChange={(e) => setF((x) => ({ ...x, deptId: e.target.value }))}>
                <option value="">— Select department —</option>
                {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {f.roles.includes("cellLeader") && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={f.canLogin} onChange={(e) => setF((x) => ({ ...x, canLogin: e.target.checked }))} />
            Enable portal login for this cell leader (PIN = last 4 digits of phone)
          </label>
        )}

        <button className="btn-primary" style={{ marginTop: 16 }} onClick={add}>➕ Add Person</button>
      </div>

      <div className="form-card">
        <div className="form-section-title">📥 Bulk Import (CSV)</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          Upload a CSV with columns: <code>Name, Phone, Email, Roles, Zone, Department</code>. Email is optional. Separate multiple roles with a semicolon (e.g. <code>cellLeader;deptHead</code>). Roles can be: member, cellLeader, zonalPastor, deptHead, pastor.
        </p>
        <button className="btn-secondary" onClick={() => importRef.current?.click()}>📂 Choose CSV File</button>
        <input ref={importRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSV} />
        {imported !== null && <div className="notice" style={{ marginTop: 12 }}>✅ Imported {imported} people successfully.</div>}
      </div>
    </>
  );
}

// ---- Directory: everyone, filterable by role ----
function Directory({ db, newcomers, refreshDB }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  // Combine leadership people + cell leaders + members from newcomers into one directory
  const leadership = db.leadership || [];
  const cellLeaders = (db.cellLeaders || []).map((l) => ({ ...l, status: "member", fromCellLeaders: true }));
  const memberNewcomers = newcomers.filter((n) => n.status === "member").map((n) => ({ ...n, roles: ["member"] }));

  // Merge, de-duplicating by phone
  const seen = new Set();
  const everyone = [];
  [...leadership, ...cellLeaders, ...memberNewcomers].forEach((p) => {
    const key = (p.phone || "").replace(/\D/g, "");
    if (key && seen.has(key)) {
      // merge roles into existing
      const ex = everyone.find((e) => (e.phone || "").replace(/\D/g, "") === key);
      if (ex) ex.roles = Array.from(new Set([...(ex.roles || []), ...(p.roles || [])]));
      return;
    }
    if (key) seen.add(key);
    everyone.push({ ...p, roles: p.roles || ["member"] });
  });

  const counts = {
    all: everyone.length,
    pastor: everyone.filter((p) => p.roles.includes("pastor") || p.roles.includes("zonalPastor")).length,
    cellLeader: everyone.filter((p) => p.roles.includes("cellLeader")).length,
    deptHead: everyone.filter((p) => p.roles.includes("deptHead")).length,
    member: everyone.filter((p) => p.roles.includes("member") || p.roles.length === 0).length,
  };

  const filtered = everyone.filter((p) => {
    const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.phone || "").includes(q);
    if (!matchQ) return false;
    if (filter === "all") return true;
    if (filter === "pastor") return p.roles.includes("pastor") || p.roles.includes("zonalPastor");
    return p.roles.includes(filter);
  });

  const roleLabel = (r) => ROLES.find((x) => x.id === r)?.label || r;

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>📖 Everyone in the church directory — pastors, cell leaders, heads of department, and members in one place. Filter by role below.</div>
      <input className="form-input" placeholder="🔍 Search by name or phone..." value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14, maxWidth: 400 }} />
      <div className="tab-bar" style={{ marginBottom: 18 }}>
        {[["all", `All (${counts.all})`], ["pastor", `Pastors (${counts.pastor})`], ["cellLeader", `Cell Leaders (${counts.cellLeader})`], ["deptHead", `Dept Heads (${counts.deptHead})`], ["member", `Members (${counts.member})`]].map(([id, label]) => (
          <button key={id} className={"tab-btn" + (filter === id ? " active" : "")} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {filtered.map((p) => (
        <div key={p.id} className="newcomer-row">
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{p.name}</div>
            <div className="newcomer-meta">📞 {p.phone}{p.zone ? ` · ${p.zone}` : ""}{p.deptId ? ` · ${DEPARTMENTS.find((d) => d.id === p.deptId)?.name || p.deptId}` : ""}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "flex-start", justifyContent: "flex-end", maxWidth: 220 }}>
            {p.roles.map((r) => (
              <span key={r} className={"status-pill " + (r === "member" ? "pill-member" : r === "cellLeader" ? "pill-active" : "pill-new")}>{roleLabel(r)}</span>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No one in this category yet.</div>}
    </>
  );
}

// ---- Not Yet Members: everyone still on the journey ----
function NotYetMembers({ newcomers }) {
  const pending = newcomers.filter((n) => n.status !== "member");
  const grouped = {
    new: pending.filter((n) => n.status === "new"),
    active: pending.filter((n) => n.status === "active"),
    flagged: pending.filter((n) => n.status === "flagged"),
  };
  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        🌱 {pending.length} {pending.length === 1 ? "person is" : "people are"} still on the journey to membership ({CHURCH.membershipThreshold} services needed). Keep following up!
      </div>
      {[["new", "🆕 Brand New (not yet contacted/attended)"], ["active", "📈 Active (attending, not yet at threshold)"], ["flagged", "🚩 Flagged"]].map(([key, title]) =>
        grouped[key].length > 0 ? (
          <div key={key} style={{ marginBottom: 20 }}>
            <h3 className="serif" style={{ fontSize: 14, color: "var(--navy)", marginBottom: 10 }}>{title} — {grouped[key].length}</h3>
            {grouped[key].map((nc) => (
              <div key={nc.id} className="newcomer-row">
                <div style={{ flex: 1 }}>
                  <div className="newcomer-name">{nc.name}</div>
                  <div className="newcomer-meta">📞 {nc.phone} · 📍 {nc.area} · Cell: {nc.assignedLeader?.name || "—"}</div>
                  <div className="attend-dots">
                    {Array.from({ length: CHURCH.membershipThreshold }).map((_, i) => <div key={i} className={"attend-dot " + (i < nc.attendance.length ? "dot-present" : "dot-absent")} />)}
                    <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 4 }}>{nc.attendance.length}/{CHURCH.membershipThreshold} services</span>
                  </div>
                </div>
                <span className={"status-pill " + (nc.status === "new" ? "pill-new" : nc.status === "flagged" ? "pill-flagged" : "pill-active")}>{nc.status}</span>
              </div>
            ))}
          </div>
        ) : null
      )}
      {pending.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>Everyone has reached membership! 🎉</div>}
    </>
  );
}

function Flagged({ newcomers }) {
  const flagged = newcomers.filter((n) => n.status === "flagged" || followupOverdue(n) || (n.status === "member" && !n.departments?.length));
  return (
    <>
      <div className="notice notice-warn" style={{ marginBottom: 16 }}>People needing attention: overdue follow-ups, manual flags, or members without a department.</div>
      {flagged.map((nc) => (
        <div key={nc.id} className="newcomer-row" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{nc.name}</div>
            <div className="newcomer-meta">📞 {nc.phone} · {nc.assignedLeader?.name || "Unassigned"} ({nc.assignedLeader?.phone || "—"})</div>
            <div className="newcomer-meta" style={{ color: "var(--red)" }}>
              {nc.status === "flagged" ? "🚩 Manually flagged" : followupOverdue(nc) ? `⏰ Not contacted in ${CHURCH.followupSLAHours}h+` : "Member but no department"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <span className="status-pill pill-flagged">{nc.status === "flagged" ? "Flagged" : followupOverdue(nc) ? "Overdue" : "No Dept"}</span>
            <a className="btn-wa" href={`tel:${nc.phone}`} style={{ background: "var(--blue-soft)", borderColor: "#d4e2fb", color: "var(--navy)", fontSize: 11, padding: "6px 12px" }}>📞 Call</a>
          </div>
        </div>
      ))}
      {flagged.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No flagged records 🎉</div>}
    </>
  );
}

function Birthdays() {
  const list = upcomingBirthdays(30);
  const todays = list.filter((n) => n.daysUntil === 0);
  const backendOn = Boolean(import.meta.env?.VITE_API_URL);

  const autoSendToday = async () => {
    if (!todays.length) return;
    let sent = 0;
    for (const nc of todays) {
      const res = await sendAutomated(nc.phone, personalizedBirthdayMsg(nc), "whatsapp");
      if (res.ok) sent++;
    }
    alert(`Sent ${sent} birthday message(s).`);
    logAction("birthday_auto", `${sent} sent`, "admin");
  };

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>🎂 Upcoming birthdays in the next 30 days. Each message is personalized with the person's name and a blessing from {CHURCH.leadPastor}. {backendOn ? "Auto-send is available for today's birthdays." : "Tap to send each one (free)."}</div>

      {todays.length > 0 && backendOn && (
        <button className="btn-primary" style={{ maxWidth: 320, marginBottom: 16 }} onClick={autoSendToday}>⚡ Auto-Send {todays.length} Birthday Message{todays.length > 1 ? "s" : ""} Today</button>
      )}

      {list.map((nc) => (
        <div key={nc.id} className="newcomer-row">
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{nc.name} {nc.daysUntil === 0 && <span style={{ fontSize: 11, color: "var(--gold)" }}>🎉 Today!</span>}</div>
            <div className="newcomer-meta">🎂 {nc.daysUntil === 0 ? "Today!" : `In ${nc.daysUntil} day${nc.daysUntil > 1 ? "s" : ""}`} · {nc.birthday}</div>
            <div className="newcomer-meta">📞 {nc.phone}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <a className="btn-wa" href={waLink(nc.phone, personalizedBirthdayMsg(nc))} target="_blank" rel="noreferrer">🎉 Send Wishes</a>
            <a className="btn-wa" href={`tel:${nc.phone}`} style={{ fontSize: 11, padding: "6px 12px", background: "var(--blue-soft)", borderColor: "#d4e2fb", color: "var(--navy)" }}>📞 Call</a>
          </div>
        </div>
      ))}
      {list.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No birthdays in the next 30 days</div>}
    </>
  );
}

function Leaders({ db, newcomers, refreshDB }) {
  const LOC = mergeLocations(LOCATION_DATA, db.customLocations || []);
  const [f, setF] = useState({ name: "", phone: "", zone: "", email: "" });
  const [areas, setAreas] = useState([]); // chosen coverage: [{area, sublocation}]
  const [pick, setPick] = useState({ area: "", sub: "", village: "" });
  const leaders = db.cellLeaders || [];

  const areaList = Object.keys(LOC);
  const subList = pick.area ? Object.keys(LOC[pick.area]?.subs || {}) : [];
  const villageList = pick.area && pick.sub ? (LOC[pick.area]?.subs?.[pick.sub] || []) : [];

  const addCoverage = () => {
    if (!pick.area) return;
    // Most precise chosen level becomes the match label: village > neighbourhood > area
    const label = pick.village || pick.sub || pick.area;
    if (areas.some((a) => a.label === label)) return;
    setAreas([...areas, { label, area: pick.area, sublocation: pick.sub, village: pick.village }]);
    setPick({ area: pick.area, sub: pick.sub, village: "" }); // keep area+sub for adding more villages
  };
  const removeCoverage = (label) => setAreas(areas.filter((a) => a.label !== label));

  const add = () => {
    if (!f.name || !f.phone) return alert("Name and phone are required.");
    if (areas.length === 0) return alert("Add at least one coverage location so newcomers can be auto-matched.");
    const curr = getDB();
    curr.cellLeaders = curr.cellLeaders || [];
    const coverage = areas.map((a) => a.label);
    curr.cellLeaders.push({
      id: "cl_" + Date.now(),
      name: f.name, phone: f.phone, zone: f.zone, email: f.email,
      roles: ["cellLeader"],
      areas: coverage, // exact strings from the same dropdowns newcomers use
    });
    saveDB(curr); logAction("leader_added", `${f.name} covering ${coverage.join(", ")}`, "admin");
    if (supabaseEnabled) {
      pushPersonToCloud({
        name: f.name, phone: f.phone, email: f.email || null,
        roles: ["cellLeader"], status: "member",
        zone: f.zone, coverage, canLogin: true,
      }).then(() => refreshDB());
    } else {
      refreshDB();
    }
    setF({ name: "", phone: "", zone: "", email: "" });
    setAreas([]); setPick({ area: "", sub: "", village: "" });
  };
  const remove = (id) => {
    if (!confirm("Remove this cell leader?")) return;
    const curr = getDB();
    curr.cellLeaders = curr.cellLeaders.filter((l) => l.id !== id);
    saveDB(curr); logAction("leader_removed", id, "admin");
    if (supabaseEnabled) deletePersonFromCloud(id);
    refreshDB();
  };

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        🧑‍💼 Coverage locations use the same Area → Neighbourhood list as the newcomer form, so when a newcomer picks their address, the system auto-matches them to the cell leader covering it.
      </div>

      <div className="form-card">
        <div className="form-section-title">➕ Add New Cell Leader</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" placeholder="Bro/Sis ..." value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" placeholder="0801..." value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Zone (org label, not used for matching)</label><input className="form-input" placeholder="e.g. Dutse Main Zone" value={f.zone} onChange={(e) => setF((x) => ({ ...x, zone: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Email (optional)</label><input className="form-input" placeholder="email@domain.com" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} /></div>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Coverage Locations (where this leader's cell members live) — pick down to village for precise matching</label>
          <div className="form-grid" style={{ marginBottom: 10, gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <select className="form-input form-select" value={pick.area} onChange={(e) => setPick({ area: e.target.value, sub: "", village: "" })}>
              <option value="">— Area —</option>
              {areaList.map((a) => <option key={a} value={a}>{LOC[a].label}</option>)}
            </select>
            <select className="form-input form-select" value={pick.sub} onChange={(e) => setPick((p) => ({ ...p, sub: e.target.value, village: "" }))} disabled={!pick.area}>
              <option value="">{pick.area ? "— Neighbourhood —" : "Area first"}</option>
              {subList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-input form-select" value={pick.village} onChange={(e) => setPick((p) => ({ ...p, village: e.target.value }))} disabled={!pick.sub}>
              <option value="">{pick.sub ? "— Village (optional) —" : "Neighbourhood first"}</option>
              {villageList.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <button className="btn-secondary" onClick={addCoverage} disabled={!pick.area}>➕ Add this location</button>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
            Tip: choosing a village gives the most precise auto-match. You can add several — e.g. all villages this leader covers.
          </p>

          {areas.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {areas.map((a) => (
                <span key={a.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--blue-soft)", border: "1px solid #d4e2fb", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--navy)" }}>
                  {a.label}
                  <span onClick={() => removeCoverage(a.label)} style={{ cursor: "pointer", color: "var(--text-dim)", fontWeight: 700 }}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <button className="btn-primary" style={{ marginTop: 16 }} onClick={add}>➕ Add Cell Leader</button>
      </div>

      {leaders.map((l) => (
        <div key={l.id} className="newcomer-row">
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{l.name} {l.roles?.includes("zonalPastor") && <span style={{ fontSize: 10, color: "var(--purple)" }}>· Zonal Pastor</span>}</div>
            <div className="newcomer-meta">📞 {l.phone} · Zone: {l.zone || "—"}</div>
            <div className="newcomer-meta">Covers: {(l.areas || []).join(", ") || "⚠️ no locations set"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Login PIN: {l.phone.slice(-4)} · {newcomers.filter((n) => n.assignedLeader?.id === l.id).length} assigned</div>
          </div>
          <button className="btn-danger" onClick={() => remove(l.id)}>Remove</button>
        </div>
      ))}
    </>
  );
}

function Locations({ db, refreshDB }) {
  const LOC = mergeLocations(LOCATION_DATA, db.customLocations || []);
  const [mode, setMode] = useState("village"); // village | neighbourhood | area
  const [sel, setSel] = useState({ area: "", sub: "" });
  const [text, setText] = useState({ villages: "", newSub: "", newSubVillages: "", newArea: "", newAreaSub: "", newAreaVillages: "" });

  const areaList = Object.keys(LOC);
  const subList = sel.area ? Object.keys(LOC[sel.area]?.subs || {}) : [];
  const villageList = sel.area && sel.sub ? (LOC[sel.area]?.subs?.[sel.sub] || []) : [];

  const saveCustom = (entry, detail) => {
    const curr = getDB();
    curr.customLocations = curr.customLocations || [];
    curr.customLocations.push({ id: "loc_" + Date.now(), ...entry });
    saveDB(curr); logAction("location_added", detail, "admin"); refreshDB();
  };

  // Add villages to an EXISTING area + neighbourhood (most common)
  const addVillages = () => {
    if (!sel.area || !sel.sub || !text.villages.trim()) return alert("Pick an area, a neighbourhood, and type at least one village.");
    // Use the canonical existing keys so nothing duplicates
    saveCustom({ area: sel.area, sub: sel.sub, villages: text.villages }, `Villages added to ${sel.area} › ${sel.sub}: ${text.villages}`);
    setText((t) => ({ ...t, villages: "" }));
    alert("Village(s) added ✓");
  };

  // Add a NEW neighbourhood to an existing area
  const addNeighbourhood = () => {
    if (!sel.area || !text.newSub.trim()) return alert("Pick an existing area and type the new neighbourhood name.");
    saveCustom({ area: sel.area, sub: text.newSub, villages: text.newSubVillages }, `Neighbourhood added to ${sel.area}: ${text.newSub}`);
    setText((t) => ({ ...t, newSub: "", newSubVillages: "" }));
    alert("Neighbourhood added ✓");
  };

  // Add a brand-NEW area
  const addArea = () => {
    if (!text.newArea.trim() || !text.newAreaSub.trim()) return alert("Type the new area and at least one neighbourhood.");
    saveCustom({ area: text.newArea, sub: text.newAreaSub, villages: text.newAreaVillages }, `New area added: ${text.newArea} › ${text.newAreaSub}`);
    setText((t) => ({ ...t, newArea: "", newAreaSub: "", newAreaVillages: "" }));
    alert("New area added ✓");
  };

  const totalSubs = Object.values(LOC).reduce((t, a) => t + Object.keys(a.subs).length, 0);
  const totalVillages = Object.values(LOC).reduce((t, a) => t + Object.values(a.subs).reduce((s, v) => s + v.length, 0), 0);

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        📍 Add locations using the dropdowns below so nothing duplicates. Most additions are <strong>new villages</strong> under an existing neighbourhood — that's the default tab. New locations appear instantly in both the newcomer form and the cell-leader coverage picker.
      </div>

      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {[["village", "➕ Add Village(s)"], ["neighbourhood", "➕ New Neighbourhood"], ["area", "➕ New Area"]].map(([id, label]) => (
          <button key={id} className={"tab-btn" + (mode === id ? " active" : "")} onClick={() => setMode(id)}>{label}</button>
        ))}
      </div>

      {mode === "village" && (
        <div className="form-card">
          <div className="form-section-title">Add Village(s) to an Existing Neighbourhood</div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Area / District</label>
              <select className="form-input form-select" value={sel.area} onChange={(e) => setSel({ area: e.target.value, sub: "" })}>
                <option value="">— Select area —</option>
                {areaList.map((a) => <option key={a} value={a}>{LOC[a].label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Neighbourhood / Ward</label>
              <select className="form-input form-select" value={sel.sub} onChange={(e) => setSel((s) => ({ ...s, sub: e.target.value }))} disabled={!sel.area}>
                <option value="">{sel.area ? "— Select neighbourhood —" : "Select an area first"}</option>
                {subList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {sel.area && sel.sub && villageList.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Existing villages here</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {villageList.map((v) => <span key={v} style={{ background: "var(--blue-soft)", border: "1px solid #d4e2fb", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--navy)" }}>{v}</span>)}
              </div>
            </div>
          )}
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">New Village(s) — comma-separated for multiple</label>
            <input className="form-input" placeholder="e.g. First Transformer, Back of Mosque" value={text.villages} onChange={(e) => setText((t) => ({ ...t, villages: e.target.value }))} />
          </div>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={addVillages}>➕ Add Village(s)</button>
        </div>
      )}

      {mode === "neighbourhood" && (
        <div className="form-card">
          <div className="form-section-title">Add a New Neighbourhood to an Existing Area</div>
          <div className="form-group">
            <label className="form-label">Area / District</label>
            <select className="form-input form-select" value={sel.area} onChange={(e) => setSel({ area: e.target.value, sub: "" })}>
              <option value="">— Select area —</option>
              {areaList.map((a) => <option key={a} value={a}>{LOC[a].label}</option>)}
            </select>
          </div>
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div className="form-group"><label className="form-label">New Neighbourhood Name</label><input className="form-input" placeholder="e.g. New Estate" value={text.newSub} onChange={(e) => setText((t) => ({ ...t, newSub: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Villages (optional, comma-separated)</label><input className="form-input" placeholder="Block A, Block B" value={text.newSubVillages} onChange={(e) => setText((t) => ({ ...t, newSubVillages: e.target.value }))} /></div>
          </div>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={addNeighbourhood}>➕ Add Neighbourhood</button>
        </div>
      )}

      {mode === "area" && (
        <div className="form-card">
          <div className="form-section-title">Add a Brand-New Area</div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">New Area / District Name</label><input className="form-input" placeholder="e.g. Dutse New Extension" value={text.newArea} onChange={(e) => setText((t) => ({ ...t, newArea: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">First Neighbourhood</label><input className="form-input" placeholder="e.g. Phase 1" value={text.newAreaSub} onChange={(e) => setText((t) => ({ ...t, newAreaSub: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Villages (optional, comma-separated)</label><input className="form-input" placeholder="Block A, Block B" value={text.newAreaVillages} onChange={(e) => setText((t) => ({ ...t, newAreaVillages: e.target.value }))} /></div>
          </div>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={addArea}>➕ Add Area</button>
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "16px 0 12px" }}>
        Loaded: {Object.keys(LOC).length} areas · {totalSubs} neighbourhoods · {totalVillages} villages
        {(db.customLocations || []).length ? ` (${db.customLocations.length} custom addition${db.customLocations.length > 1 ? "s" : ""})` : ""}
      </p>

      {Object.entries(LOC).map(([k, v]) => (
        <div key={k} className="form-card" style={{ marginBottom: 12 }}>
          <div className="serif" style={{ fontSize: 14, color: "var(--navy)", marginBottom: 10, fontWeight: 700 }}>{v.label}</div>
          {Object.entries(v.subs).map(([s, villages]) => (
            <div key={s} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{s}</div>
              {villages.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 10 }}>
                  {villages.map((vil) => <span key={vil} style={{ background: "#f1f5f9", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 9px", fontSize: 11, color: "var(--text-muted)" }}>{vil}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function AuditLog({ log }) {
  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>📜 Every action on the platform is logged here for accountability.</div>
      {log.slice(0, 100).map((entry) => (
        <div key={entry.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <div>
            <span style={{ color: "var(--navy)", fontWeight: 600 }}>{entry.action}</span>
            <span style={{ color: "var(--text-muted)" }}> — {entry.detail}</span>
          </div>
          <div style={{ color: "var(--text-dim)", whiteSpace: "nowrap", marginLeft: 12 }}>{entry.actor} · {new Date(entry.at).toLocaleString()}</div>
        </div>
      ))}
      {log.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No activity logged yet</div>}
    </>
  );
}

function Settings({ db, fileRef, onBackup, onImport, refreshDB }) {
  const handleReset = () => { if (confirm("Reset ALL data? This cannot be undone.")) { resetDB(); refreshDB(); } };
  return (
    <div className="form-card">
      <div className="form-section-title">⚙️ Platform Settings</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.9 }}>
        <p>🏠 <strong style={{ color: "var(--text)" }}>Address:</strong> {CHURCH.address}</p>
        <p>👨‍💼 <strong style={{ color: "var(--text)" }}>Lead Pastor:</strong> {CHURCH.leadPastor}</p>
        <p>👩‍💼 <strong style={{ color: "var(--text)" }}>Pastor's Wife:</strong> {CHURCH.pastorWife}</p>
        <p>📅 <strong style={{ color: "var(--text)" }}>Services:</strong> {CHURCH.services.map((s) => `${s.day} ${s.time}`).join(" · ")}</p>
        <p>🎯 <strong style={{ color: "var(--text)" }}>Membership threshold:</strong> {CHURCH.membershipThreshold} services</p>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "20px 0", flexWrap: "wrap" }}>
        <button className="btn-secondary" onClick={onBackup}>💾 Download Backup (JSON)</button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>📂 Restore from Backup</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={onImport} />
        <button className="btn-danger" style={{ padding: "10px 16px" }} onClick={handleReset}>🗑️ Reset All Data</button>
      </div>

      <div className="notice notice-warn" style={{ marginBottom: 12 }}>
        💡 <strong>WhatsApp/SMS:</strong> The app currently uses tap-to-send WhatsApp links (zero cost — works now). For fully automatic messages, connect a Twilio or WhatsApp Cloud API key in the backend <code style={{ fontSize: 11 }}>.env</code> file.
      </div>
      <div className="notice" style={{ marginBottom: 12 }}>
        📶 <strong>Offline Mode:</strong> All data saves locally and syncs when internet returns. ({(db.syncQueue || []).filter((q) => !q.synced).length} items pending sync)
      </div>
      <div className="notice" style={{ marginBottom: 0 }}>
        🖼️ <strong>Logo:</strong> Place your church logo at <code style={{ fontSize: 11 }}>public/church-logo.png</code> — it appears everywhere automatically. To rebrand for another church, edit <code style={{ fontSize: 11 }}>src/data/church.config.js</code>.
      </div>
    </div>
  );
}

// ============================================================
//  CELL PERFORMANCE — pastor's snapshot of every cell leader
//  and how their assigned people are doing.
// ============================================================
function CellPerformance({ db, newcomers }) {
  const [expanded, setExpanded] = useState(null);
  const [q, setQ] = useState("");
  const leaders = db.cellLeaders || [];

  const rows = leaders.map((l) => {
    const assigned = newcomers.filter((n) => n.assignedLeader?.id === l.id);
    return {
      leader: l,
      assigned,
      total: assigned.length,
      pending: assigned.filter((n) => n.status === "new").length,
      active: assigned.filter((n) => n.status === "active").length,
      members: assigned.filter((n) => n.status === "member").length,
      flagged: assigned.filter((n) => n.status === "flagged").length,
      notContacted: assigned.filter((n) => !n.contactedAt).length,
      overdue: assigned.filter((n) => followupOverdue(n)).length,
    };
  }).sort((a, b) => b.total - a.total);

  const unassigned = newcomers.filter((n) => !n.assignedLeader);

  // Global totals across all cells
  const totals = {
    leaders: leaders.length,
    souls: newcomers.length,
    members: newcomers.filter((n) => n.status === "member").length,
    pending: newcomers.filter((n) => n.status === "new").length,
    active: newcomers.filter((n) => n.status === "active").length,
    notContacted: newcomers.filter((n) => !n.contactedAt && n.status !== "member").length,
  };

  // Search: match a leader by name/phone, OR auto-expand a leader who has a
  // matching soul, and surface that soul.
  const ql = q.trim().toLowerCase();
  const matchedSouls = ql ? newcomers.filter((n) => n.name.toLowerCase().includes(ql) || (n.phone || "").includes(ql)) : [];
  const visibleRows = ql
    ? rows.filter((r) =>
        r.leader.name.toLowerCase().includes(ql) ||
        (r.leader.phone || "").includes(ql) ||
        r.assigned.some((n) => n.name.toLowerCase().includes(ql) || (n.phone || "").includes(ql))
      )
    : rows;

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        🎯 A snapshot for the Pastor: every cell leader, how many souls they oversee, and exactly where each stands. Tap any leader to see their full list. Use search to jump straight to a person or a leader.
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-num">{totals.souls}</div><div className="stat-label">Total Souls</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--green)" }}>{totals.members}</div><div className="stat-label">Now Members</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--blue)" }}>{totals.active}</div><div className="stat-label">Active (pending membership)</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--gold)" }}>{totals.pending}</div><div className="stat-label">New / Pending</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--red)" }}>{totals.notContacted}</div><div className="stat-label">Not Yet Contacted</div></div>
        <div className="stat-card"><div className="stat-num">{totals.leaders}</div><div className="stat-label">Cell Leaders</div></div>
      </div>

      <input className="form-input" placeholder="🔍 Search a cell leader or a soul by name / phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14, maxWidth: 440 }} />

      {ql && matchedSouls.length > 0 && (
        <div className="form-card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Matching souls</div>
          {matchedSouls.map((n) => (
            <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{n.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>📞 {n.phone} · Cell: {n.assignedLeader?.name || "⚠️ unassigned"} · {n.attendance?.length || 0}/{CHURCH.membershipThreshold} services</div>
              </div>
              <span className={"status-pill " + (n.status === "new" ? "pill-new" : n.status === "member" ? "pill-member" : n.status === "flagged" ? "pill-flagged" : "pill-active")}>{n.status}</span>
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          ⚠️ {unassigned.length} newcomer{unassigned.length > 1 ? "s are" : " is"} not yet assigned to any cell leader. See the Assignments tab to assign them.
        </div>
      )}

      {visibleRows.map(({ leader, assigned, total, pending, active, members, flagged, notContacted, overdue }) => (
        <div key={leader.id} style={{ marginBottom: 10 }}>
          <div className="newcomer-row" style={{ cursor: "pointer", marginBottom: 0 }} onClick={() => setExpanded(expanded === leader.id ? null : leader.id)}>
            <div style={{ flex: 1 }}>
              <div className="newcomer-name">{leader.name} {overdue > 0 && <span style={{ fontSize: 11, color: "var(--red)" }}>⏰ {overdue} overdue</span>}</div>
              <div className="newcomer-meta">📞 {leader.phone} · {leader.zone || "—"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <span className="status-pill" style={{ background: "var(--blue-soft)", color: "var(--navy)", border: "1px solid #d4e2fb" }}>{total} total</span>
                {pending > 0 && <span className="status-pill pill-new">{pending} pending</span>}
                {active > 0 && <span className="status-pill pill-active">{active} active</span>}
                {members > 0 && <span className="status-pill pill-member">{members} members</span>}
                {flagged > 0 && <span className="status-pill pill-flagged">{flagged} flagged</span>}
                {notContacted > 0 && <span className="status-pill" style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid #f4c9c9" }}>{notContacted} not contacted</span>}
              </div>
            </div>
            <div style={{ fontSize: 20, color: "var(--text-dim)" }}>{expanded === leader.id ? "▾" : "▸"}</div>
          </div>

          {expanded === leader.id && (
            <div style={{ background: "var(--blue-soft)", border: "1px solid #d4e2fb", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px 16px" }}>
              {assigned.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)", padding: 8 }}>No one assigned yet.</div>}
              {assigned.map((n) => (
                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #d4e2fb" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{n.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>📞 {n.phone} · {n.attendance?.length || 0}/{CHURCH.membershipThreshold} services {!n.contactedAt && "· ⚠️ not contacted"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className={"status-pill " + (n.status === "new" ? "pill-new" : n.status === "member" ? "pill-member" : n.status === "flagged" ? "pill-flagged" : "pill-active")}>{n.status}</span>
                    <a className="btn-wa" href={`tel:${n.phone}`} style={{ fontSize: 11, padding: "5px 10px", background: "#fff", borderColor: "#d4e2fb", color: "var(--navy)" }}>📞</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {rows.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No cell leaders added yet.</div>}
      {rows.length > 0 && visibleRows.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No cell leaders match "{q}".</div>}
    </>
  );
}

// ============================================================
//  BROADCAST — bulk messaging to filtered audiences.
//  Manual (tap-to-send / mailto, zero cost) + automatic
//  (via backend if VITE_API_URL configured).
// ============================================================
function Broadcast({ db, newcomers }) {
  const leaders = db.cellLeaders || [];
  const leadership = db.leadership || [];
  const [audience, setAudience] = useState("members");
  const [channel, setChannel] = useState("whatsapp");
  const [subject, setSubject] = useState("A word from Dominion City Dutse");
  const [body, setBody] = useState("Hello {firstName}, grace and peace to you from all of us at {church} {branch}! We're thinking of you this week. 🙏");
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState(null);

  // Build the recipient list from the chosen audience
  const allPeople = [
    ...newcomers,
    ...leaders.map((l) => ({ ...l, status: "member", roles: l.roles || ["cellLeader"] })),
    ...leadership,
  ];
  // De-dupe by phone
  const seen = new Set();
  const everyone = allPeople.filter((p) => {
    const k = (p.phone || "").replace(/\D/g, "");
    if (!k || seen.has(k)) return false;
    seen.add(k); return true;
  });

  const zones = [...new Set(leaders.map((l) => l.zone).filter(Boolean))];

  const recipients = (() => {
    switch (audience) {
      case "members": return everyone.filter((p) => p.status === "member" || (p.roles || []).includes("member"));
      case "newcomers": return newcomers.filter((n) => (n.roles || ["newcomer"]).includes("newcomer") || n.status !== "member");
      case "not_members": return newcomers.filter((n) => n.status !== "member");
      case "active": return newcomers.filter((n) => n.status === "active");
      case "flagged": return newcomers.filter((n) => n.status === "flagged" || followupOverdue(n));
      case "leaders": return leaders;
      case "all": return everyone;
      default:
        if (audience.startsWith("zone:")) {
          const z = audience.slice(5);
          const zoneLeaders = leaders.filter((l) => l.zone === z).map((l) => l.id);
          return newcomers.filter((n) => zoneLeaders.includes(n.assignedLeader?.id));
        }
        if (audience.startsWith("dept:")) {
          const d = audience.slice(5);
          return newcomers.filter((n) => (n.departments || []).includes(d) || n.deptAssigned === d);
        }
        return [];
    }
  })();

  const withChannel = channel === "email"
    ? recipients.filter((r) => r.email)
    : recipients.filter((r) => r.phone);

  const sampleMsg = withChannel.length ? personalize(body, withChannel[0]) : personalize(body, { name: "John Doe" });

  // Manual send: open each recipient's WhatsApp/SMS/email one at a time
  const manualSend = () => {
    if (!withChannel.length) return alert("No recipients match this audience/channel.");
    setSending(true);
    let i = 0;
    const openNext = () => {
      if (i >= withChannel.length) { setSending(false); setSentResult({ count: withChannel.length, mode: "manual" }); logAction("broadcast_manual", `${withChannel.length} to ${audience} via ${channel}`, "admin"); return; }
      const r = withChannel[i];
      const msg = personalize(body, r);
      let url;
      if (channel === "whatsapp") url = waLink(r.phone, msg);
      else if (channel === "sms") url = smsLink(r.phone, msg);
      else url = mailtoLink(r.email, subject, msg);
      window.open(url, "_blank");
      i++;
      setTimeout(openNext, 600); // small gap so the browser doesn't block popups
    };
    openNext();
  };

  // Automatic send via backend (only if configured)
  const autoSend = async () => {
    setSending(true);
    let sent = 0, failed = 0;
    for (const r of withChannel) {
      const msg = personalize(body, r);
      const res = await sendAutomated(channel === "email" ? r.email : r.phone, msg, channel);
      if (res.ok) sent++; else failed++;
    }
    setSending(false);
    setSentResult({ count: sent, failed, mode: "auto" });
    logAction("broadcast_auto", `${sent} sent, ${failed} failed to ${audience} via ${channel}`, "admin");
  };

  const backendOn = Boolean(import.meta.env?.VITE_API_URL);

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        📢 Send a message to many people at once. <strong>Manual mode</strong> opens each chat with your message pre-filled (free, works now). <strong>Auto mode</strong> sends silently in the background {backendOn ? "(backend connected ✓)" : "(needs backend + provider — not yet connected)"}.
      </div>

      <div className="form-card">
        <div className="form-section-title">Compose Broadcast</div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Audience</label>
            <select className="form-input form-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="members">All Members</option>
              <option value="newcomers">All Newcomers</option>
              <option value="not_members">Not Yet Members</option>
              <option value="active">Active (attending)</option>
              <option value="flagged">Flagged / Overdue</option>
              <option value="leaders">Cell Leaders</option>
              <option value="all">Everyone</option>
              {zones.map((z) => <option key={z} value={`zone:${z}`}>Zone: {z}</option>)}
              {DEPARTMENTS.map((d) => <option key={d.id} value={`dept:${d.id}`}>Dept: {d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Channel</label>
            <div className="toggle-group">
              {[["whatsapp", "WhatsApp"], ["sms", "SMS"], ["email", "Email"]].map(([id, label]) => (
                <button key={id} className={"toggle-btn" + (channel === id ? " selected" : "")} onClick={() => setChannel(id)} style={{ fontSize: 12, padding: "8px 14px" }}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {channel === "email" && (
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Email Subject</label>
            <input className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        )}

        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">Message — use {"{firstName}"}, {"{name}"}, {"{church}"}, {"{branch}"} for personalization</label>
          <textarea className="form-input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} style={{ resize: "vertical" }} />
        </div>

        <div style={{ background: "var(--blue-soft)", border: "1px solid #d4e2fb", borderRadius: 10, padding: 14, marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Preview (first recipient)</div>
          <div style={{ fontSize: 13, color: "var(--navy)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{sampleMsg}</div>
        </div>

        <div className="info-badge" style={{ marginTop: 14 }}>
          Recipients matching: <span>{withChannel.length}</span>{channel === "email" && recipients.length !== withChannel.length ? ` (of ${recipients.length}, rest have no email)` : ""}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn-primary" style={{ maxWidth: 280, opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={manualSend}>
            {sending ? "Opening…" : `💬 Manual Send (${withChannel.length})`}
          </button>
          {backendOn && (
            <button className="btn-secondary" disabled={sending} onClick={autoSend}>⚡ Auto Send (background)</button>
          )}
        </div>

        {sentResult && (
          <div className="notice" style={{ marginTop: 14 }}>
            ✅ {sentResult.mode === "manual" ? `Opened ${sentResult.count} message windows.` : `Sent ${sentResult.count}${sentResult.failed ? `, ${sentResult.failed} failed` : ""}.`}
          </div>
        )}
        {sending && channel === "whatsapp" && (
          <div className="notice notice-warn" style={{ marginTop: 12 }}>
            💡 Your browser may ask to allow multiple popups — click Allow. Each opens a pre-filled WhatsApp; tap send on each.
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
//  DEPARTMENT OVERSIGHT — members assigned to departments,
//  grouped under their Head of Department, with contacts.
// ============================================================
function DeptOversight({ db, newcomers, onAssignHead }) {
  const leadership = db.leadership || [];

  // Find the head for a department id
  const headFor = (deptId) => leadership.find((p) => (p.roles || []).includes("deptHead") && p.deptId === deptId)
    || { name: DEPARTMENTS.find((d) => d.id === deptId)?.leader || "—", phone: DEPARTMENTS.find((d) => d.id === deptId)?.leaderPhone || "" };

  // People assigned to each department (deptAssigned or in departments[])
  const byDept = DEPARTMENTS.map((dept) => {
    const people = newcomers.filter((n) => n.deptAssigned === dept.id || (n.status === "member" && (n.departments || []).includes(dept.id)));
    return { dept, head: headFor(dept.id), people };
  }).filter((d) => d.people.length > 0);

  const exportDeptCSV = () => {
    const headers = ["Department", "Head of Dept", "Head Phone", "Member Name", "Member Phone", "Status"];
    const rows = [];
    byDept.forEach(({ dept, head, people }) => {
      people.forEach((p) => rows.push([dept.name, head.name, head.phone, p.name, p.phone, p.status]));
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadFile(csv, `dc_dutse_departments_${new Date().toISOString().split("T")[0]}.csv`);
    logAction("export_dept_csv", `${rows.length} dept assignments`, "admin");
  };

  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        🏛 Members serving in each department, grouped under their Head of Department with contact numbers so HODs can reach them. Members reach the membership threshold, then get assigned to the department they indicated.
      </div>

      {byDept.length > 0 && (
        <button className="btn-secondary" style={{ marginBottom: 16 }} onClick={exportDeptCSV}>⬇️ Export Department List (CSV)</button>
      )}

      {byDept.map(({ dept, head, people }) => (
        <div key={dept.id} className="form-card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="serif" style={{ fontSize: 15, color: "var(--navy)", fontWeight: 700 }}>{dept.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Head: {head.name}{head.phone ? ` · 📞 ${head.phone}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="info-badge"><span>{people.length}</span> serving</span>
              {head.phone && <a className="btn-wa" href={`tel:${head.phone}`} style={{ fontSize: 11, padding: "6px 12px", background: "var(--blue-soft)", borderColor: "#d4e2fb", color: "var(--navy)" }}>📞 Call Head</a>}
            </div>
          </div>
          {people.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>📞 {p.phone} · Cell: {p.assignedLeader?.name || "—"}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <a className="btn-wa" href={waLink(p.phone, `Hello ${p.name.split(" ")[0]}, this is the ${dept.name} of ${CHURCH.name} ${CHURCH.branch}. `)} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "5px 10px" }}>💬</a>
                <a className="btn-wa" href={`tel:${p.phone}`} style={{ fontSize: 11, padding: "5px 10px", background: "var(--blue-soft)", borderColor: "#d4e2fb", color: "var(--navy)" }}>📞</a>
              </div>
            </div>
          ))}
        </div>
      ))}
      {byDept.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No members assigned to departments yet. Members get assigned once they reach {CHURCH.membershipThreshold} services.</div>}
    </>
  );
}
