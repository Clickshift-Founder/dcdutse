import { useState, useEffect } from "react";
import { CHURCH } from "./data/church.config.js";
import { initDB, getDB, flushSyncQueue, pullFromCloud, supabaseEnabled } from "./lib/storage.js";
import { seedDummyData } from "./lib/seedData.js";
import NewcomerPage from "./pages/NewcomerPage.jsx";
import CellLeaderPage from "./pages/CellLeaderPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import Logo from "./components/Logo.jsx";

export default function App() {
  const [tab, setTab] = useState("newcomer");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [db, setDB] = useState(() => {
    initDB();
    // Only seed dummy data when NOT using the cloud (cloud is the source of truth)
    return supabaseEnabled ? getDB() : seedDummyData();
  });
  const [auth, setAuth] = useState({ cellLeader: null, admin: false });
  const [loading, setLoading] = useState(supabaseEnabled);

  useEffect(() => {
    // On startup, if Supabase is configured, pull the shared data
    if (supabaseEnabled) {
      pullFromCloud().then((fresh) => { setDB({ ...fresh }); setLoading(false); });
    }
  }, []);

  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      await flushSyncQueue(); // push any offline records when back online
      refreshDB();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const refreshDB = () => {
    if (supabaseEnabled) {
      pullFromCloud().then((fresh) => setDB({ ...fresh }));
    } else {
      setDB({ ...getDB() });
    }
  };

  const tabs = [
    { id: "newcomer", label: "🙏 Welcome" },
    { id: "celleader", label: "👥 Cell Leader" },
    { id: "admin", label: "⚙️ Admin" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)" }}><Logo size={60} /></div>
        <div style={{ fontFamily: "'Cinzel', serif", color: "var(--navy)", fontSize: 16 }}>Loading {CHURCH.name} {CHURCH.branch}…</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Connecting to cloud database</div>
      </div>
    );
  }

  return (
    <div>
      <nav className="top-nav">
        <div className="nav-brand">
          <Logo className="nav-logo" />
          <div>
            <div className="nav-title">{CHURCH.name} {CHURCH.branch.replace("Branch", "").trim()}</div>
            <div className="nav-sub">Church Connect</div>
          </div>
        </div>
        <div className="nav-tabs">
          {tabs.map((t) => (
            <button key={t.id} className={"nav-tab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className={"offline-badge " + (isOnline ? "online" : "offline")}>
          {isOnline ? "● Online" : "● Offline"}
        </div>
      </nav>

      <div className="mobile-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: tab === t.id ? "var(--navy)" : "transparent",
              color: tab === t.id ? "#fff" : "var(--text-muted)",
              fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "newcomer" && <NewcomerPage refreshDB={refreshDB} isOnline={isOnline} />}
      {tab === "celleader" && <CellLeaderPage db={db} refreshDB={refreshDB} auth={auth} setAuth={setAuth} />}
      {tab === "admin" && <AdminPage db={db} refreshDB={refreshDB} auth={auth} setAuth={setAuth} />}
    </div>
  );
}
