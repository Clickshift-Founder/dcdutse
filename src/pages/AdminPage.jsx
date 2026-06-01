import { useState, useRef } from "react";
import { CHURCH, ADMIN_PIN } from "../data/church.config.js";
import { LOCATION_DATA } from "../data/locations.js";
import { DEPARTMENTS } from "../data/seed.js";
import { getDB, saveDB, logAction, exportDB, importDB, resetDB } from "../lib/storage.js";
import { generateInsights, assignCellLeader, followupOverdue, upcomingBirthdays, toCSV, downloadFile } from "../lib/logic.js";
import { waLink, birthdayMsg } from "../lib/notifications.js";

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
    if (n) { n.status = status; saveDB(curr); logAction("status_changed", `${n.name} → ${status}`, "admin"); refreshDB(); }
  };
  const assignDept = (id, deptId) => {
    const curr = getDB();
    const n = curr.newcomers.find((x) => x.id === id);
    if (n) {
      n.departments = deptId ? [deptId] : [];
      saveDB(curr); logAction("dept_assigned", `${n.name} → ${deptId || "none"}`, "admin"); refreshDB();
    }
  };
  const deleteNC = (id) => {
    if (!confirm("Delete this record permanently?")) return;
    const curr = getDB();
    curr.newcomers = curr.newcomers.filter((n) => n.id !== id);
    saveDB(curr); logAction("record_deleted", id, "admin"); refreshDB();
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
    ["dashboard", "📊 Dashboard"], ["report", "📈 Monthly Report"], ["newcomers", "👥 All Records"],
    ["directory", "📖 Directory"], ["people", "➕ Add People"], ["members", "🏅 Members"],
    ["pending", "🌱 Not Yet Members"], ["flagged", "🚩 Flagged"], ["birthdays", "🎂 Birthdays"],
    ["leaders", "🧑‍💼 Cell Leaders"], ["locations", "📍 Locations"], ["audit", "📜 Audit Log"], ["settings", "⚙️ Settings"],
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
      {tab === "newcomers" && <AllRecords newcomers={newcomers} onStatus={updateStatus} onDept={assignDept} onDelete={deleteNC} />}
      {tab === "directory" && <Directory db={db} newcomers={newcomers} refreshDB={refreshDB} />}
      {tab === "people" && <AddPeople db={db} refreshDB={refreshDB} />}
      {tab === "members" && <Members members={members} />}
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

function Members({ members }) {
  const noDept = members.filter((n) => !n.departments?.length);
  return (
    <>
      {noDept.length > 0 && <div className="notice notice-warn">⚠️ {noDept.length} members have not joined a department. They need {CHURCH.foundationClass} before functioning.</div>}
      {members.map((nc) => (
        <div key={nc.id} className="newcomer-row">
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{nc.name} {nc.whatsappAdded ? "✅" : "⚠️"}</div>
            <div className="newcomer-meta">📞 {nc.phone} · 📍 {nc.area}</div>
            <div className="newcomer-meta">Cell: {nc.assignedLeader?.name || "—"} · Depts: {nc.departments?.length ? nc.departments.map((d) => DEPARTMENTS.find((x) => x.id === d)?.name || d).join(", ") : "None"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <span className="status-pill pill-member">Member</span>
            {!nc.whatsappAdded && <span className="status-pill pill-flagged">WhatsApp Pending</span>}
            {!nc.departments?.length && <span className="status-pill pill-flagged">No Department</span>}
          </div>
        </div>
      ))}
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
  const blank = { name: "", phone: "", roles: [], zone: "", deptId: "", canLogin: false };
  const [f, setF] = useState(blank);
  const [imported, setImported] = useState(null);
  const importRef = useRef();

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
    refreshDB();
    setF(blank);
  };

  // CSV import: expects columns Name,Phone,Roles,Zone,Department
  const handleCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = reader.result.split(/\r?\n/).filter((l) => l.trim());
      const rows = lines.slice(1); // skip header
      const curr = getDB();
      curr.leadership = curr.leadership || [];
      let count = 0;
      rows.forEach((line) => {
        const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        const [name, phone, roles, zone, dept] = cells;
        if (!name || !phone) return;
        curr.leadership.push({
          id: "person_" + Date.now() + "_" + count,
          name, phone,
          roles: roles ? roles.split(/[;|]/).map((r) => r.trim()).filter(Boolean) : ["member"],
          zone: zone || "", deptId: dept || "",
          canLogin: false, status: "member",
          addedAt: new Date().toISOString(),
        });
        count++;
      });
      saveDB(curr);
      logAction("csv_import", `${count} people imported`, "admin");
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
          Upload a CSV with columns: <code>Name, Phone, Roles, Zone, Department</code>. Separate multiple roles with a semicolon (e.g. <code>cellLeader;deptHead</code>). Roles can be: member, cellLeader, zonalPastor, deptHead, pastor.
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
          <span className="status-pill pill-flagged">{nc.status === "flagged" ? "Flagged" : followupOverdue(nc) ? "Overdue" : "No Dept"}</span>
        </div>
      ))}
      {flagged.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No flagged records 🎉</div>}
    </>
  );
}

function Birthdays() {
  const list = upcomingBirthdays(30);
  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>🎂 Upcoming birthdays in the next 30 days — a call or message keeps people connected to the church family.</div>
      {list.map((nc) => (
        <div key={nc.id} className="newcomer-row">
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{nc.name}</div>
            <div className="newcomer-meta">🎂 {nc.daysUntil === 0 ? "Today!" : `In ${nc.daysUntil} day${nc.daysUntil > 1 ? "s" : ""}`} · {nc.birthday}</div>
            <div className="newcomer-meta">📞 {nc.phone}</div>
          </div>
          <a className="btn-wa" href={waLink(nc.phone, birthdayMsg(nc))} target="_blank" rel="noreferrer">🎉 Send Wishes</a>
        </div>
      ))}
      {list.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No birthdays in the next 30 days</div>}
    </>
  );
}

function Leaders({ db, newcomers, refreshDB }) {
  const [f, setF] = useState({ name: "", phone: "", zone: "", areas: "", email: "" });
  const leaders = db.cellLeaders || [];
  const add = () => {
    if (!f.name || !f.phone) return;
    const curr = getDB();
    curr.cellLeaders = curr.cellLeaders || [];
    curr.cellLeaders.push({ id: "cl_" + Date.now(), ...f, roles: ["cellLeader"], areas: f.areas.split(",").map((s) => s.trim()).filter(Boolean) });
    saveDB(curr); logAction("leader_added", f.name, "admin"); refreshDB();
    setF({ name: "", phone: "", zone: "", areas: "", email: "" });
  };
  const remove = (id) => {
    if (!confirm("Remove this cell leader?")) return;
    const curr = getDB();
    curr.cellLeaders = curr.cellLeaders.filter((l) => l.id !== id);
    saveDB(curr); logAction("leader_removed", id, "admin"); refreshDB();
  };
  return (
    <>
      <div className="form-card">
        <div className="form-section-title">➕ Add New Cell Leader</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" placeholder="Bro/Sis ..." value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="0801..." value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Zone Name</label><input className="form-input" placeholder="Dutse Main Zone" value={f.zone} onChange={(e) => setF((x) => ({ ...x, zone: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Email (optional)</label><input className="form-input" placeholder="email@domain.com" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} /></div>
        </div>
        <div className="form-group" style={{ marginTop: 14 }}><label className="form-label">Covered Areas (comma-separated)</label><input className="form-input" placeholder="Dutse Alhaji, Dutse Sokale, Bamko" value={f.areas} onChange={(e) => setF((x) => ({ ...x, areas: e.target.value }))} /></div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={add}>➕ Add Cell Leader</button>
      </div>
      {leaders.map((l) => (
        <div key={l.id} className="newcomer-row">
          <div style={{ flex: 1 }}>
            <div className="newcomer-name">{l.name} {l.roles?.includes("zonalPastor") && <span style={{ fontSize: 10, color: "var(--purple)" }}>· Zonal Pastor</span>}</div>
            <div className="newcomer-meta">📞 {l.phone} · Zone: {l.zone}</div>
            <div className="newcomer-meta">Areas: {(l.areas || []).join(", ")}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Login PIN: {l.phone.slice(-4)} · {newcomers.filter((n) => n.assignedLeader?.id === l.id).length} assigned</div>
          </div>
          <button className="btn-danger" onClick={() => remove(l.id)}>Remove</button>
        </div>
      ))}
    </>
  );
}

function Locations({ db, refreshDB }) {
  const [f, setF] = useState({ area: "", sub: "", villages: "" });
  const add = () => {
    if (!f.area || !f.sub) return;
    const curr = getDB();
    curr.customLocations = curr.customLocations || [];
    curr.customLocations.push({ id: "loc_" + Date.now(), ...f });
    saveDB(curr); logAction("location_added", `${f.area} › ${f.sub}`, "admin"); refreshDB();
    setF({ area: "", sub: "", villages: "" });
  };
  const totalSubs = Object.values(LOCATION_DATA).reduce((t, a) => t + Object.keys(a.subs).length, 0);
  return (
    <>
      <div className="form-card">
        <div className="form-section-title">➕ Add New Location</div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Area / District</label><input className="form-input" placeholder="e.g. Dutse New Extension" value={f.area} onChange={(e) => setF((x) => ({ ...x, area: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Sublocation / Ward</label><input className="form-input" placeholder="e.g. New Estate" value={f.sub} onChange={(e) => setF((x) => ({ ...x, sub: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Villages (optional, comma-separated)</label><input className="form-input" placeholder="Block A, Block B" value={f.villages} onChange={(e) => setF((x) => ({ ...x, villages: e.target.value }))} /></div>
        </div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={add}>➕ Add Location</button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Loaded: {totalSubs} sublocations across {Object.keys(LOCATION_DATA).length} areas{(db.customLocations || []).length ? ` + ${db.customLocations.length} custom` : ""}</p>
      {Object.entries(LOCATION_DATA).map(([k, v]) => (
        <div key={k} className="form-card" style={{ marginBottom: 12 }}>
          <div className="serif" style={{ fontSize: 13, color: v.color, marginBottom: 8 }}>{v.label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.keys(v.subs).map((s) => <span key={s} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--text-muted)" }}>{s}</span>)}
          </div>
        </div>
      ))}
      {(db.customLocations || []).length > 0 && (
        <div className="form-card">
          <div className="form-section-title">Custom Added Locations</div>
          {db.customLocations.map((l) => <div key={l.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text)" }}>{l.area} › {l.sub} {l.villages ? `› ${l.villages}` : ""}</div>)}
        </div>
      )}
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
