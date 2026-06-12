import { useState } from "react";
import { CHURCH } from "../data/church.config.js";
import { DEPARTMENTS } from "../data/seed.js";
import { getDB, saveDB, logAction, updatePersonInCloud, supabaseEnabled } from "../lib/storage.js";
import { computeStatus, followupOverdue, hoursSinceSubmit, sundaysAbsent } from "../lib/logic.js";
import { waLink, newcomerWelcomeMsg, membershipMsg } from "../lib/notifications.js";

export default function CellLeaderPage({ db, refreshDB, auth, setAuth }) {
  const [login, setLogin] = useState({ phone: "", pin: "" });
  const [err, setErr] = useState("");
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

  const mine = (db.newcomers || []).filter((nc) => nc.assignedLeader?.id === leader.id);
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
