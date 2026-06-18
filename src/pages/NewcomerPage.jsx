import { useState } from "react";
import { CHURCH } from "../data/church.config.js";
import { LOCATION_DATA, mergeLocations } from "../data/locations.js";
import { PRAYER_POINTS, DEPARTMENTS } from "../data/seed.js";
import { getDB, saveDB, queueSync, logAction, pushPersonToCloud, supabaseEnabled } from "../lib/storage.js";
import { assignCellLeader, findDuplicate } from "../lib/logic.js";
import { waLink, newcomerWelcomeMsg, leaderAssignmentMsg, deptInterestMsg } from "../lib/notifications.js";
import Logo from "../components/Logo.jsx";

const EMPTY = {
  name: "", phone: "", bMonth: "", bDay: "", bYear: "", street: "",
  area: "", sublocation: "", village: "",
  bornAgain: "", baptizedHG: "", baptizedWater: "",
  howCame: "", inviterName: "", mission: "",
  marital: "", gender: "",
  prayerPoints: [], customPrayer: "",
  wantDept: "", departments: [],
};

export default function NewcomerPage({ refreshDB, isOnline }) {
  const [step, setStep] = useState("form");
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [dupWarning, setDupWarning] = useState(null);

  const db = getDB();
  const LOC = mergeLocations(LOCATION_DATA, db.customLocations || [], db.removedLocations || []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const areas = Object.keys(LOC);
  const subs = form.area ? Object.keys(LOC[form.area]?.subs || {}) : [];
  const villages = form.area && form.sublocation ? LOC[form.area]?.subs?.[form.sublocation] || [] : [];

  const togglePrayer = (p) =>
    set("prayerPoints", form.prayerPoints.includes(p) ? form.prayerPoints.filter((x) => x !== p) : [...form.prayerPoints, p]);
  const toggleDept = (id) =>
    set("departments", form.departments.includes(id) ? form.departments.filter((x) => x !== id) : [...form.departments, id]);

  const checkDup = (phone) => {
    const dup = findDuplicate(phone);
    setDupWarning(dup ? dup.name : null);
  };

  const isValid = form.name.trim() && form.phone.trim() && form.area;

  const handleSubmit = () => {
    const leader = assignCellLeader(form.area, form.sublocation, form.village, form.gender);
    // Compose birthday: "YYYY-MM-DD" if year given, else "MM-DD" (year-less).
    // Day/month must both be present for a birthday to be stored.
    let birthday = "";
    if (form.bMonth && form.bDay) {
      birthday = form.bYear ? `${form.bYear}-${form.bMonth}-${form.bDay}` : `${form.bMonth}-${form.bDay}`;
    }
    const record = {
      ...form,
      birthday,
      id: "nc_" + Date.now(),
      status: "new",
      assignedLeader: leader,
      attendance: [],
      contactedAt: null,
      whatsappAdded: false,
      submittedAt: new Date().toISOString(),
    };
    const curr = getDB();
    curr.newcomers.unshift(record);
    if (!isOnline) queueSync("newcomer", record);
    saveDB(curr);
    logAction("newcomer_registered", `${record.name} from ${record.area}, assigned to ${leader?.name}`, "newcomer-kiosk");

    // Push to cloud (Supabase) so all devices see this newcomer
    if (supabaseEnabled) {
      pushPersonToCloud({
        ...record,
        roles: ["newcomer"],
        assignedLeaderId: leader?.id || null,
      }).then(() => refreshDB());
    } else {
      refreshDB();
    }

    // Build notification links (zero-cost mode — leader/HOD taps to send)
    const interestedDepts = (form.departments || []).map((id) => DEPARTMENTS.find((d) => d.id === id)).filter(Boolean);
    setResult({
      ...record,
      leader,
      welcomeLink: leader ? waLink(record.phone, newcomerWelcomeMsg(record, leader)) : null,
      leaderLink: leader ? waLink(leader.phone, leaderAssignmentMsg(record, leader)) : null,
      deptLinks: interestedDepts.map((d) => ({ dept: d, link: waLink(d.leaderPhone, deptInterestMsg(record, d)) })),
    });
    setStep("success");
  };

  const reset = () => { setStep("form"); setForm(EMPTY); setDupWarning(null); setResult(null); };

  if (step === "success" && result) {
    return (
      <div className="page">
        <div className="success-wrap">
          <div className="success-icon">🎉</div>
          <h2 className="success-title">Welcome to the Family!</h2>
          <p className="success-body">
            We are so glad you walked through those doors today, <strong>{result.name.split(" ")[0]}</strong>.
            You've been connected with your HomeCell leader who will reach out to you soon!
          </p>

          <div className="assignment-card">
            <div className="assignment-label">Your HomeCell Leader</div>
            <div className="assignment-value">{result.leader?.name || "Will be assigned shortly"}</div>
            <div className="assignment-divider" />
            <div className="assignment-label">Phone Number</div>
            <div className="assignment-value">{result.leader?.phone || "—"}</div>
            <div className="assignment-divider" />
            <div className="assignment-label">Zone</div>
            <div className="assignment-value">{result.leader?.zone || "—"}</div>
            <div className="assignment-divider" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {CHURCH.services.map((s) => (
                <div key={s.name}>
                  <div className="assignment-label">{s.name}</div>
                  <div className="assignment-value" style={{ fontSize: 13 }}>{s.day} · {s.time}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Zero-cost notification: tap to send WhatsApp welcome */}
          <div style={{ maxWidth: 420, margin: "0 auto 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {result.welcomeLink && (
              <a className="btn-wa" href={result.welcomeLink} target="_blank" rel="noreferrer" style={{ justifyContent: "center" }}>
                💬 Send Welcome Message to {result.name.split(" ")[0]}
              </a>
            )}
            {result.leaderLink && (
              <a className="btn-wa" href={result.leaderLink} target="_blank" rel="noreferrer" style={{ justifyContent: "center" }}>
                📋 Notify Cell Leader ({result.leader.name.split(" ").slice(0, 2).join(" ")})
              </a>
            )}
            {result.deptLinks.map(({ dept, link }) => (
              <a key={dept.id} className="btn-wa" href={link} target="_blank" rel="noreferrer" style={{ justifyContent: "center" }}>
                🏛 Notify {dept.name} Head
              </a>
            ))}
          </div>

          {!isOnline && (
            <div className="notice notice-warn" style={{ maxWidth: 420, margin: "0 auto 16px" }}>
              📶 You're offline — this record is saved safely and will sync once you reconnect.
            </div>
          )}

          <button className="btn-primary" style={{ maxWidth: 280 }} onClick={reset}>
            Register Another Person
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="hero">
        <Logo className="hero-icon" />
        <h1 className="hero-title">Welcome to {CHURCH.name}</h1>
        <p className="hero-sub">We are glad you're here! Please fill in a few details so we can stay connected with you.</p>
        <p className="hero-address">📍 {CHURCH.address}</p>
        <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>{CHURCH.leadPastor} & {CHURCH.pastorWife}</p>
      </div>

      {!isOnline && (
        <div className="notice notice-warn" style={{ maxWidth: 600, margin: "0 auto 20px" }}>
          📶 You are offline — your information will be saved and sent when internet is available.
        </div>
      )}

      {/* PERSONAL */}
      <div className="form-card">
        <div className="form-section-title">👤 Personal Details</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="Enter your full name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input className="form-input" placeholder="08012345678" value={form.phone} inputMode="tel"
                onChange={(e) => { set("phone", e.target.value); checkDup(e.target.value); }} />
              {dupWarning && (
                <span style={{ fontSize: 11, color: "var(--gold)" }}>
                  ⚠️ A record for "{dupWarning}" already uses this number
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Birthday <span style={{ textTransform: "none", color: "var(--text-dim)" }}>(year optional)</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 8 }}>
                <select className="form-input form-select" value={form.bMonth} onChange={(e) => set("bMonth", e.target.value)}>
                  <option value="">Month</option>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                  ))}
                </select>
                <select className="form-input form-select" value={form.bDay} onChange={(e) => set("bDay", e.target.value)} disabled={!form.bMonth}>
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="form-input form-select" value={form.bYear} onChange={(e) => set("bYear", e.target.value)}>
                  <option value="">Year –</option>
                  {Array.from({ length: 90 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Gender</label>
              <div className="toggle-group">
                {["Male", "Female"].map((g) => (
                  <button key={g} className={"toggle-btn" + (form.gender === g ? " selected" : "")} onClick={() => set("gender", g)}>{g}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Marital Status</label>
              <div className="toggle-group">
                {["Single", "Married", "Widowed", "Divorced"].map((m) => (
                  <button key={m} className={"toggle-btn" + (form.marital === m ? " selected" : "")} onClick={() => set("marital", m)} style={{ fontSize: 12, padding: "8px 12px" }}>{m}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ADDRESS */}
      <div className="form-card">
        <div className="form-section-title">📍 Home Address</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Area / District *</label>
            <select className="form-input form-select" value={form.area} onChange={(e) => { set("area", e.target.value); set("sublocation", ""); set("village", ""); }}>
              <option value="">— Select your area —</option>
              {areas.map((a) => <option key={a} value={a}>{LOC[a].label}</option>)}
            </select>
          </div>
          {subs.length > 0 && (
            <div className="form-group">
              <label className="form-label">Neighbourhood / Ward</label>
              <select className="form-input form-select" value={form.sublocation} onChange={(e) => { set("sublocation", e.target.value); set("village", ""); }}>
                <option value="">— Select neighbourhood —</option>
                {subs.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {villages.length > 0 && (
            <div className="form-group">
              <label className="form-label">Village / Estate</label>
              <select className="form-input form-select" value={form.village} onChange={(e) => set("village", e.target.value)}>
                <option value="">— Select village / estate —</option>
                {villages.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Street / Specific Address (optional)</label>
            <input className="form-input" placeholder="e.g. 5 Freedom Avenue, flat 3" value={form.street} onChange={(e) => set("street", e.target.value)} />
          </div>
        </div>
      </div>

      {/* SPIRITUAL */}
      <div className="form-card">
        <div className="form-section-title">✝️ Spiritual Background</div>
        <div className="form-grid">
          {[
            ["Are you Born Again?", "bornAgain"],
            ["Are you Baptized in the Holy Ghost?", "baptizedHG"],
            ["Are you Baptized in Water?", "baptizedWater"],
          ].map(([label, key]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <div className="toggle-group">
                <button className={"toggle-btn" + (form[key] === "yes" ? " selected-green" : "")} onClick={() => set(key, "yes")}>✅ Yes</button>
                <button className={"toggle-btn" + (form[key] === "no" ? " selected-red" : "")} onClick={() => set(key, "no")}>Not yet</button>
              </div>
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">How did you come to church today?</label>
            <div className="toggle-group">
              {["A Member", "A Friend", "The Lord directed me", "Just Visiting", "Came on my own", "Pastor invited me", "On a Mission"].map((h) => (
                <button key={h} className={"toggle-btn" + (form.howCame === h ? " selected" : "")} onClick={() => set("howCame", h)} style={{ fontSize: 12, padding: "8px 14px" }}>{h}</button>
              ))}
            </div>
            {form.howCame === "A Member" && (
              <input className="form-input" style={{ marginTop: 8 }} placeholder="Which member invited you?" value={form.inviterName} onChange={(e) => set("inviterName", e.target.value)} />
            )}
            {form.howCame === "On a Mission" && (
              <input className="form-input" style={{ marginTop: 8 }} placeholder="What mission?" value={form.mission} onChange={(e) => set("mission", e.target.value)} />
            )}
          </div>
        </div>
      </div>

      {/* PRAYER */}
      <div className="form-card">
        <div className="form-section-title">🙏 Prayer Requests</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Select as many as apply — your cell leader will pray over these specifically.</p>
        <div className="prayer-grid">
          {PRAYER_POINTS.map((p) => (
            <div key={p} className={"prayer-item" + (form.prayerPoints.includes(p) ? " checked" : "")} onClick={() => togglePrayer(p)}>
              <div className={"prayer-check" + (form.prayerPoints.includes(p) ? " checked" : "")}>{form.prayerPoints.includes(p) && "✓"}</div>
              <div className="prayer-text">{p}</div>
            </div>
          ))}
        </div>
        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">Any other prayer request (optional)</label>
          <textarea className="form-input" rows={3} placeholder="Type your personal prayer request here..." value={form.customPrayer} onChange={(e) => set("customPrayer", e.target.value)} style={{ resize: "vertical" }} />
        </div>
      </div>

      {/* DEPARTMENT */}
      <div className="form-card">
        <div className="form-section-title">🏛 Join a Department</div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Would you like to serve in a department?</label>
          <div className="toggle-group">
            <button className={"toggle-btn" + (form.wantDept === "yes" ? " selected" : "")} onClick={() => set("wantDept", "yes")}>Yes, I'd love to serve!</button>
            <button className={"toggle-btn" + (form.wantDept === "no" ? " selected-red" : "")} onClick={() => set("wantDept", "no")}>Not right now</button>
          </div>
        </div>
        {form.wantDept === "yes" && (
          <>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Select department(s) you're interested in:</p>
            <div className="dept-grid">
              {DEPARTMENTS.map((d) => (
                <div key={d.id} className={"dept-card" + (form.departments.includes(d.id) ? " selected" : "")} onClick={() => toggleDept(d.id)}>
                  <div className="dept-name">{d.name}</div>
                  <div className="dept-desc">{d.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 32 }}>
        {!isValid && <p style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", marginBottom: 8 }}>Please fill in your name, phone number and area to continue</p>}
        <button className="btn-primary" disabled={!isValid} onClick={handleSubmit}>
          ✝️ Submit & Connect with {CHURCH.name}
        </button>
      </div>
    </div>
  );
}
