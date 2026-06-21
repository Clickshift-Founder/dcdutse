import { useState, useEffect } from "react";
import { CHURCH } from "../data/church.config.js";
import { DEPARTMENTS } from "../data/seed.js";
import { getDB, saveDB, logAction, updatePersonInCloud, supabaseEnabled, submitReport, loadReports } from "../lib/storage.js";
import { computeStatus, followupOverdue, hoursSinceSubmit, sundaysAbsent } from "../lib/logic.js";
import { waLink, newcomerWelcomeMsg, membershipMsg } from "../lib/notifications.js";

// Get the Sunday of the current week (week anchor for reports)
function currentWeekSunday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day); // back to Sunday
  return d.toISOString().split("T")[0];
}

export default function CellLeaderPage({ db, refreshDB, auth, setAuth }) {
  const [login, setLogin] = useState({ phone: "", pin: "" });
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("people"); // people | report
  const [innerTab, setInnerTab] = useState("assigned");
  const [selected, setSelected] = useState(null);
  const [attendDate, setAttendDate] = useState(new Date().toISOString().split("T")[0]);

  const leader = auth.cellLeader;

  const doLogin = () => {
    const found = (db.cellLeaders || []).find((l) => l.phone === login.phone);
    if (!found) return setErr("Phone number not found. Contact your admin.");
    if (login.pin !== found.phone.slice(-4)) return setErr("Incorrect PIN. (Default = last 4 digits of your phone)");
    setAuth((a) => ({ ...a, cellLeader: found }));
    setErr("");
    logAction("cellleader_login", found.name, found.name);
  };

  if (!leader) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div style={{ textAlign: "center", marginBottom: 20, fontSize: 26 }}>✝️</div>
          <div className="login-title">Cell Leader Login</div>
          <div className="login-sub">Enter your registered phone number and PIN</div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Phone Number</label>
            <input className="form-input" placeholder="08012345678" inputMode="tel" value={login.phone} onChange={(e) => setLogin((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">PIN (4 digits)</label>
            <input className="form-input" type="password" placeholder="••••" maxLength={4} inputMode="numeric" value={login.pin}
              onChange={(e) => setLogin((f) => ({ ...f, pin: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && doLogin()} />
          </div>
          {err && <div className="notice notice-danger" style={{ marginBottom: 14 }}>{err}</div>}
          <button className="btn-primary" onClick={doLogin}>Login to Dashboard</button>
          <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", marginTop: 14 }}>Default PIN = last 4 digits of your phone number</p>
        </div>
      </div>
    );
  }

  // Match by id OR phone — phone is the stable key that survives cloud sync
  // (CSV-imported leaders get a cloud UUID that differs from their local id).
  const sameLeader = (nc) => {
    const al = nc.assignedLeader;
    const lp = (leader.phone || "").replace(/\D/g, "").slice(-10);
    if (al?.id && leader.id && al.id === leader.id) return true;
    // match by the leader phone on the snapshot OR stored on the newcomer row
    const snapPhone = (al?.phone || nc.assignedLeaderPhone || "").replace(/\D/g, "").slice(-10);
    return lp && snapPhone && lp === snapPhone;
  };
  const mine = (db.newcomers || []).filter(sameLeader);
  const pending = mine.filter((nc) => nc.status === "new");
  const active = mine.filter((nc) => nc.status === "active");
  const members = mine.filter((nc) => nc.status === "member");
  const overdue = mine.filter((nc) => followupOverdue(nc));

  const markAttendance = (id, date) => {
    const curr = getDB();
    const nc = curr.newcomers.find((n) => n.id === id);
    if (!nc) return;
    nc.attendance = nc.attendance || [];
    if (nc.attendance.includes(date)) nc.attendance = nc.attendance.filter((d) => d !== date);
    else nc.attendance.push(date);
    if (!nc.contactedAt) nc.contactedAt = new Date().toISOString();
    nc.status = computeStatus(nc);
    saveDB(curr);
    logAction("attendance_marked", `${nc.name} on ${date} (now ${nc.attendance.length})`, leader.name);
    if (supabaseEnabled) updatePersonInCloud(id, { ...nc });
    refreshDB();
    setSelected(nc);
  };

  const markContacted = (id) => {
    const curr = getDB();
    const nc = curr.newcomers.find((n) => n.id === id);
    if (nc) {
      nc.contactedAt = new Date().toISOString();
      saveDB(curr); logAction("contacted", nc.name, leader.name);
      if (supabaseEnabled) updatePersonInCloud(id, { ...nc });
      refreshDB(); setSelected({ ...nc });
    }
  };

  const markWhatsApp = (id) => {
    const curr = getDB();
    const nc = curr.newcomers.find((n) => n.id === id);
    if (nc) {
      nc.whatsappAdded = true;
      saveDB(curr); logAction("whatsapp_added", nc.name, leader.name);
      if (supabaseEnabled) updatePersonInCloud(id, { ...nc });
      refreshDB(); setSelected({ ...nc });
    }
  };

  const displayed = innerTab === "assigned" ? mine : innerTab === "pending" ? pending : innerTab === "members" ? members : innerTab === "overdue" ? overdue : active;

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 className="section-title">Welcome, {leader.name.split(" ").slice(0, 2).join(" ")}</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{leader.zone} · {leader.phone}</p>
        </div>
        <button className="btn-secondary" onClick={() => setAuth((a) => ({ ...a, cellLeader: null }))}>Logout</button>
      </div>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={"tab-btn" + (mode === "people" ? " active" : "")} onClick={() => setMode("people")}>👥 My People</button>
        <button className={"tab-btn" + (mode === "report" ? " active" : "")} onClick={() => setMode("report")}>📋 Cell Reports</button>
      </div>

      {mode === "report" && <CellReportView leader={leader} db={db} mine={mine} refreshDB={refreshDB} />}

      {mode === "people" && <>
      {overdue.length > 0 && (
        <div className="notice notice-danger" style={{ marginBottom: 16 }}>
          ⏰ {overdue.length} {overdue.length === 1 ? "person has" : "people have"} not been contacted within {CHURCH.followupSLAHours}h. Please reach out today.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{mine.length}</div><div className="stat-label">Total Assigned</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--blue)" }}>{pending.length}</div><div className="stat-label">Pending Contact</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--blue)" }}>{active.length}</div><div className="stat-label">Active Visitors</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: "var(--green)" }}>{members.length}</div><div className="stat-label">Full Members</div></div>
      </div>

      <div className="tab-bar">
        {[["assigned", "All"], ["pending", "Pending"], ["active", "Active"], ["members", "Members"], ["overdue", `Overdue (${overdue.length})`]].map(([id, label]) => (
          <button key={id} className={"tab-btn" + (innerTab === id ? " active" : "")} onClick={() => setInnerTab(id)}>{label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div className="info-badge">Attendance date: <span>{attendDate}</span></div>
        <input type="date" className="form-input" style={{ width: "auto", fontSize: 13, padding: "8px 12px" }} value={attendDate} onChange={(e) => setAttendDate(e.target.value)} />
      </div>

      {displayed.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: 32 }}>No records in this category.</div>}

      {displayed.map((nc) => {
        const absent = sundaysAbsent(nc);
        const od = followupOverdue(nc);
        return (
          <div key={nc.id} className="newcomer-row" style={{ cursor: "pointer", borderColor: od ? "rgba(239,68,68,0.3)" : undefined }} onClick={() => setSelected(nc)}>
            <div style={{ flex: 1 }}>
              <div className="newcomer-name">{nc.name} {od && <span style={{ fontSize: 11, color: "var(--red)" }}>⏰ overdue</span>}</div>
              <div className="newcomer-meta">📍 {nc.area}{nc.sublocation ? ` › ${nc.sublocation}` : ""} · 📞 {nc.phone}</div>
              <div className="newcomer-meta">{nc.bornAgain === "yes" ? "✅ Born Again" : "⭕ Not yet saved"} · {nc.gender} · {nc.marital}</div>
              {absent !== null && absent >= 2 && <div className="newcomer-meta" style={{ color: "var(--gold)" }}>⚠️ Absent {absent} Sundays</div>}
              <div className="attend-dots">
                {Array.from({ length: CHURCH.membershipThreshold }).map((_, i) => (
                  <div key={i} className={"attend-dot " + (i < nc.attendance.length ? "dot-present" : "dot-absent")} />
                ))}
                <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 4 }}>{nc.attendance.length}/{CHURCH.membershipThreshold}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <span className={"status-pill " + (nc.status === "new" ? "pill-new" : nc.status === "member" ? "pill-member" : nc.status === "flagged" ? "pill-flagged" : "pill-active")}>{nc.status}</span>
              <button className="btn-secondary" style={{ fontSize: 11, padding: "5px 10px" }} onClick={(e) => { e.stopPropagation(); markAttendance(nc.id, attendDate); }}>
                {nc.attendance.includes(attendDate) ? "✅ Present" : "Mark Present"}
              </button>
            </div>
          </div>
        );
      })}
      </>}

      {selected && (
        <DetailPanel nc={selected} leader={leader} onClose={() => setSelected(null)} onAttend={markAttendance} onContact={markContacted} onWhatsApp={markWhatsApp} />
      )}
    </div>
  );
}

function DetailPanel({ nc, leader, onClose, onAttend, onContact, onWhatsApp }) {
  const today = new Date().toISOString().split("T")[0];
  const welcomeMsgLink = waLink(nc.phone, newcomerWelcomeMsg(nc, leader));
  const callLink = `tel:${nc.phone}`;

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose}>Close ✕</button>
        <h3 className="serif" style={{ color: "var(--navy)", fontSize: 18, marginBottom: 4 }}>{nc.name}</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          {nc.phone} · Added {new Date(nc.submittedAt).toLocaleDateString()} ({hoursSinceSubmit(nc)}h ago)
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <a className="btn-wa" href={welcomeMsgLink} target="_blank" rel="noreferrer">💬 WhatsApp</a>
          <a className="btn-wa" href={callLink} style={{ background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.4)", color: "var(--blue)" }}>📞 Call</a>
          {!nc.contactedAt && <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => onContact(nc.id)}>✓ Mark as Contacted</button>}
          {nc.contactedAt && <span className="info-badge">✓ Contacted {new Date(nc.contactedAt).toLocaleDateString()}</span>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            ["Area", `${nc.area}${nc.sublocation ? " › " + nc.sublocation : ""}`],
            ["Village", nc.village || "—"],
            ["Gender", nc.gender], ["Marital", nc.marital],
            ["Born Again", nc.bornAgain === "yes" ? "✅ Yes" : "⭕ Not yet"],
            ["Baptized HG", nc.baptizedHG === "yes" ? "✅ Yes" : "⭕ Not yet"],
            ["Baptized Water", nc.baptizedWater === "yes" ? "✅ Yes" : "⭕ Not yet"],
            ["How came", nc.howCame + (nc.inviterName ? ` (${nc.inviterName})` : "")],
            ["Birthday", nc.birthday || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>{v || "—"}</div>
            </div>
          ))}
        </div>

        {nc.prayerPoints?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>🙏 Prayer Requests</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {nc.prayerPoints.map((p) => <span key={p} style={{ background: "rgba(245,158,11,0.08)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--text-muted)" }}>{p}</span>)}
            </div>
            {nc.customPrayer && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>"{nc.customPrayer}"</p>}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>📅 Attendance ({nc.attendance?.length || 0}/{CHURCH.membershipThreshold})</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(nc.attendance || []).map((d) => <span key={d} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--green)" }}>{d}</span>)}
            {(!nc.attendance || nc.attendance.length === 0) && <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No attendance recorded yet</span>}
          </div>
        </div>

        {nc.departments?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>🏛 Interested Departments</div>
            {nc.departments.map((dId) => {
              const dept = DEPARTMENTS.find((d) => d.id === dId);
              return dept ? <div key={dId} style={{ fontSize: 12, color: "var(--text)", marginBottom: 3 }}>• {dept.name}</div> : null;
            })}
          </div>
        )}

        {nc.status === "member" && !nc.whatsappAdded && (
          <>
            <div className="notice notice-warn" style={{ marginBottom: 12 }}>
              🎉 <strong>{nc.name}</strong> has qualified for membership! Please add them to the church WhatsApp group and confirm below. Also guide them toward a department + {CHURCH.foundationClass}.
            </div>
            <button className="btn-primary" style={{ marginBottom: 8 }} onClick={() => onWhatsApp(nc.id)}>✅ Confirm Added to WhatsApp Group</button>
          </>
        )}
        {nc.whatsappAdded && <div className="notice">✅ Added to church WhatsApp group</div>}

        <button className="btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => onAttend(nc.id, today)}>
          {(nc.attendance || []).includes(today) ? "✅ Marked Present Today" : "📋 Mark Present Today"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  CELL REPORT VIEW (cell leader's own interface)
//  Submit weekly report + see history + offering owed.
// ============================================================
function CellReportView({ leader, db, mine, refreshDB }) {
  const [tab, setTab] = useState("submit");
  const blank = {
    report_date: new Date().toISOString().split("T")[0],
    topic: "", adults: 0, children: 0,
    mvps: [], offering: 0, dca: 0, dli: 0, soulsWon: 0, soulsVisited: 0, cellMvp: 0, comment: "",
  };
  const [f, setF] = useState(blank);
  const [done, setDone] = useState(false);

  useEffect(() => { if (supabaseEnabled) loadReports().then(() => refreshDB()); }, []);

  const myReports = (db.cellReports || []).filter((r) => r.leader_id === leader.id || r.leader_name === leader.name);

  const toggleMvp = (id) => setF((x) => ({ ...x, mvps: x.mvps.includes(id) ? x.mvps.filter((m) => m !== id) : [...x.mvps, id] }));

  const submit = async () => {
    if (!f.topic.trim()) return alert("Please enter the cell topic.");
    const weekSunday = currentWeekSunday();
    const mvpNames = f.mvps.map((id) => mine.find((m) => m.id === id)?.name).filter(Boolean);
    const report = {
      leader_id: leader.id, leader_name: leader.name,
      week_of: weekSunday, report_date: f.report_date,
      topic: f.topic,
      adults: Number(f.adults) || 0, children: Number(f.children) || 0,
      mvps_present: f.mvps, mvps_present_names: mvpNames,
      offering: Number(f.offering) || 0,
      dca: Number(f.dca) || 0, dli: Number(f.dli) || 0,
      souls_won: Number(f.soulsWon) || 0, souls_visited: Number(f.soulsVisited) || 0,
      cell_mvp: Number(f.cellMvp) || 0,
      comment: f.comment, offering_remitted: false,
    };
    await submitReport(report);
    logAction("cell_report_submitted", `${leader.name} for week ${weekSunday}`, leader.name);
    refreshDB();
    setF(blank); setDone(true);
    setTimeout(() => setDone(false), 4000);
  };

  // Offering owed = sum of unremitted offerings
  const owed = myReports.filter((r) => !r.offering_remitted).reduce((s, r) => s + (Number(r.offering) || 0), 0);
  const totalGenerated = myReports.reduce((s, r) => s + (Number(r.offering) || 0), 0);
  const fmt = (n) => "₦" + Number(n || 0).toLocaleString();

  const alreadyThisWeek = myReports.some((r) => r.week_of === currentWeekSunday());

  return (
    <>
      <div className="tab-bar" style={{ marginBottom: 18 }}>
        <button className={"tab-btn" + (tab === "submit" ? " active" : "")} onClick={() => setTab("submit")}>✍️ Submit Report</button>
        <button className={"tab-btn" + (tab === "history" ? " active" : "")} onClick={() => setTab("history")}>📚 My Reports ({myReports.length})</button>
        <button className={"tab-btn" + (tab === "offering" ? " active" : "")} onClick={() => setTab("offering")}>💰 Offering</button>
      </div>

      {tab === "submit" && (
        <>
          {done && <div className="notice" style={{ marginBottom: 16 }}>✅ Report submitted — thank you! Your admin can now see it.</div>}
          {alreadyThisWeek && !done && <div className="notice notice-warn" style={{ marginBottom: 16 }}>📌 You've already submitted for this week. Submitting again adds another entry (e.g. if your cell met more than once).</div>}
          <div className="form-card">
            <div className="form-section-title">Weekly Home Cell Report</div>
            <div className="info-badge" style={{ marginBottom: 16 }}>Leader: <span>{leader.name}</span></div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Date Cell Held *</label>
                <input type="date" className="form-input" value={f.report_date} onChange={(e) => setF((x) => ({ ...x, report_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cell Topic *</label>
                <input className="form-input" placeholder="e.g. Walking in Faith" value={f.topic} onChange={(e) => setF((x) => ({ ...x, topic: e.target.value }))} />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Attendance</label>
              <div className="form-grid-2">
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Adults</div>
                  <input type="number" min="0" className="form-input" value={f.adults} onChange={(e) => setF((x) => ({ ...x, adults: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Children</div>
                  <input type="number" min="0" className="form-input" value={f.children} onChange={(e) => setF((x) => ({ ...x, children: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>Total present: {(Number(f.adults) || 0) + (Number(f.children) || 0)}</div>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">MVPs Present (newcomers assigned to you who attended)</label>
              {mine.length === 0 && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>No one is assigned to you yet.</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {mine.map((m) => (
                  <button key={m.id} className={"toggle-btn" + (f.mvps.includes(m.id) ? " selected" : "")} onClick={() => toggleMvp(m.id)} style={{ fontSize: 12, padding: "8px 14px" }}>
                    {f.mvps.includes(m.id) ? "✓ " : ""}{m.name}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>{f.mvps.length} selected</div>
            </div>

            <div className="form-grid-2" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Offering Generated (₦)</label>
                <input type="number" min="0" className="form-input" placeholder="0" value={f.offering} onChange={(e) => setF((x) => ({ ...x, offering: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">On DCA / On DLI</label>
                <div className="form-grid-2">
                  <input type="number" min="0" className="form-input" placeholder="DCA" value={f.dca} onChange={(e) => setF((x) => ({ ...x, dca: e.target.value }))} />
                  <input type="number" min="0" className="form-input" placeholder="DLI" value={f.dli} onChange={(e) => setF((x) => ({ ...x, dli: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Souls Won / Souls Visited</label>
                <div className="form-grid-2">
                  <input type="number" min="0" className="form-input" placeholder="Won" value={f.soulsWon} onChange={(e) => setF((x) => ({ ...x, soulsWon: e.target.value }))} />
                  <input type="number" min="0" className="form-input" placeholder="Visited" value={f.soulsVisited} onChange={(e) => setF((x) => ({ ...x, soulsVisited: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cell MVP <span style={{ textTransform: "none", color: "var(--text-dim)" }}>(new members in your cell)</span></label>
                <input type="number" min="0" className="form-input" placeholder="0" value={f.cellMvp} onChange={(e) => setF((x) => ({ ...x, cellMvp: e.target.value }))} />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Comments / Challenges / Testimonies (optional)</label>
              <textarea className="form-input" rows={3} value={f.comment} onChange={(e) => setF((x) => ({ ...x, comment: e.target.value }))} style={{ resize: "vertical" }} />
            </div>

            <button className="btn-primary" style={{ marginTop: 16 }} onClick={submit}>✓ Submit This Week's Report</button>
          </div>
        </>
      )}

      {tab === "history" && (
        <>
          {myReports.length === 0 && <div style={{ color: "var(--text-dim)", textAlign: "center", padding: 32 }}>No reports submitted yet.</div>}
          {myReports.map((r) => (
            <div key={r.id} className="form-card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="serif" style={{ fontSize: 14, color: "var(--navy)", fontWeight: 700 }}>{r.topic}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>📅 {r.report_date} · Week of {r.week_of}</div>
                </div>
                <span className={"status-pill " + (r.offering_remitted ? "pill-member" : "pill-flagged")}>{r.offering_remitted ? "Remitted" : "Owing"}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                <span className="info-badge">👥 <span>{(r.adults || 0) + (r.children || 0)}</span> present</span>
                <span className="info-badge">⭐ <span>{(r.mvps_present_names || []).length}</span> MVPs</span>
                <span className="info-badge">💰 <span>{fmt(r.offering)}</span></span>
                <span className="info-badge">DCA <span>{r.dca || 0}</span> · DLI <span>{r.dli || 0}</span></span>
                <span className="info-badge">Won <span>{r.souls_won || 0}</span> · Visited <span>{r.souls_visited || 0}</span></span>
                <span className="info-badge">Cell MVP <span>{r.cell_mvp || 0}</span></span>
              </div>
              {r.comment && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>"{r.comment}"</div>}
            </div>
          ))}
        </>
      )}

      {tab === "offering" && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-num">{fmt(totalGenerated)}</div><div className="stat-label">Total Generated</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: owed > 0 ? "var(--red)" : "var(--green)" }}>{fmt(owed)}</div><div className="stat-label">You Are Owing</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: "var(--green)" }}>{fmt(totalGenerated - owed)}</div><div className="stat-label">Remitted</div></div>
          </div>
          {owed > 0 && <div className="notice notice-warn" style={{ marginBottom: 16 }}>💰 You have {fmt(owed)} in unremitted offering. Please remit to the church account and your admin will mark it.</div>}
          {owed === 0 && myReports.length > 0 && <div className="notice" style={{ marginBottom: 16 }}>🎉 You're fully remitted — God bless you!</div>}
          <div className="form-section-title" style={{ marginBottom: 12 }}>Week-by-week</div>
          {myReports.map((r) => (
            <div key={r.id} className="newcomer-row">
              <div style={{ flex: 1 }}>
                <div className="newcomer-name">{fmt(r.offering)}</div>
                <div className="newcomer-meta">Week of {r.week_of} · {r.topic}</div>
              </div>
              <span className={"status-pill " + (r.offering_remitted ? "pill-member" : "pill-flagged")}>{r.offering_remitted ? "✓ Remitted" : "Owing"}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
