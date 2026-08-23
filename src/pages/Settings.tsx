import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { clearConfigOverride, loadEffectiveConfig, saveConfigOverride } from "../lib/config";
import { clearSession } from "../db/db";
import type { AppConfig } from "../types";

export default function Settings() {
  const navigate = useNavigate();
  const newPlan = useStore((s) => s.newPlan);
  const electrodeCount = useStore((s) => s.electrodes.length);
  const [config, setConfig] = useState<AppConfig>({ institution: "", contact: "", email: "", phone: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadEffectiveConfig().then(setConfig);
  }, []);

  const save = async () => {
    await saveConfigOverride(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const resetToDefaults = async () => {
    await clearConfigOverride();
    const fresh = await loadEffectiveConfig();
    setConfig(fresh);
  };

  const handleDiscardSession = async () => {
    if (!window.confirm("This clears the saved plan from this browser. Continue?")) return;
    await clearSession();
    await newPlan();
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px 60px", width: "100%" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0 }}>
        Everything here is stored locally in this browser. Nothing is sent to a server.
      </p>

      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Contact / institution</h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, marginBottom: 14 }}>
          Shown on the Home screen. To change the shipped default for everyone deploying this site, edit{" "}
          <span className="mono">public/app-config.json</span> instead.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>Institution</label>
            <input value={config.institution} onChange={(e) => setConfig({ ...config, institution: e.target.value })} />
          </div>
          <div className="field">
            <label>Contact name</label>
            <input value={config.contact} onChange={(e) => setConfig({ ...config, contact: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={config.phone} onChange={(e) => setConfig({ ...config, phone: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" onClick={save}>
              Save
            </button>
            <button className="btn btn-sm" onClick={resetToDefaults}>
              Reset to file default
            </button>
            {saved && <span style={{ fontSize: 12.5, color: "var(--accent)", alignSelf: "center" }}>Saved.</span>}
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Anatomical library</h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
          Manage the searchable target/entry list used by the "By Target" add workflow.
        </p>
        <Link to="/settings/anatomy" className="btn btn-sm">
          Open Anatomical Library →
        </Link>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Session</h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
          {electrodeCount} electrode{electrodeCount === 1 ? "" : "s"} currently saved in this browser's storage.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={() => navigate("/planner")}>
            Go to Planner
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleDiscardSession}>
            Discard Saved Plan
          </button>
        </div>
      </section>
    </div>
  );
}
