import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { hasStoredSession, clearSession } from "../db/db";
import type { AppConfig, SeegPlanFile } from "../types";
import Mark from "../components/Mark";

export default function Home() {
  const navigate = useNavigate();
  const newPlan = useStore((s) => s.newPlan);
  const loadPlanFile = useStore((s) => s.loadPlanFile);
  const hydrateFromDB = useStore((s) => s.hydrateFromDB);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sessionFound, setSessionFound] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}app-config.json`)
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig(null));
    hasStoredSession().then(setSessionFound);
  }, []);

  const handleNewPlan = async () => {
    if (sessionFound) {
      const confirmed = window.confirm(
        "Starting a new plan will discard the previous session. Continue?"
      );
      if (!confirmed) return;
    }
    await newPlan();
    navigate("/planner");
  };

  const handleRestore = async () => {
    await hydrateFromDB();
    navigate("/planner");
  };

  const handleDiscard = async () => {
    await clearSession();
    setSessionFound(false);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SeegPlanFile;
      if (!Array.isArray(parsed.electrodes)) {
        throw new Error("File does not look like a valid sEEGmap (.seegmap) project.");
      }
      loadPlanFile(parsed);
      navigate("/planner");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasContact =
    config && (config.institution || config.contact || config.email || config.phone);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Mark size={52} />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          sEEGmap
        </h1>
        <p style={{ marginTop: 8, marginBottom: 0, color: "var(--muted)", fontSize: 15.5 }}>
          Interactive 2D stereoelectroencephalography planning
        </p>

        <div
          className="card"
          style={{
            marginTop: 26,
            padding: "12px 16px",
            fontSize: 12.5,
            color: "var(--danger)",
            background: "var(--danger-soft)",
            border: "1px solid rgba(180,67,47,0.2)",
            textAlign: "left",
            lineHeight: 1.45,
          }}
        >
          <strong>Planning aid only.</strong> Not intended to replace physician judgment.
        </div>

        {sessionFound && (
          <div
            className="card"
            style={{
              marginTop: 14,
              padding: "14px 16px",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13.5 }}>
              <strong>Previous session found.</strong>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>
                Restore it or discard to start clean.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-sm" onClick={handleDiscard}>
                Discard
              </button>
              <button className="btn btn-sm btn-primary" onClick={handleRestore}>
                Restore
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-primary" onClick={handleNewPlan} style={{ padding: "12px 16px" }}>
            New Plan
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={handleRestore}
              disabled={!sessionFound}
            >
              Restore Last Session
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={handleImportClick}>
              Import .seegmap
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".seegmap,.seegplan,application/json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {importError && (
            <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{importError}</div>
          )}
        </div>

        {hasContact && (
          <div
            style={{
              marginTop: 32,
              paddingTop: 20,
              borderTop: "1px solid var(--line)",
              fontSize: 12.5,
              color: "var(--muted)",
              lineHeight: 1.7,
            }}
          >
            {config?.institution && <div>{config.institution}</div>}
            {config?.contact && <div>{config.contact}</div>}
            {config?.email && <div>{config.email}</div>}
            {config?.phone && <div>{config.phone}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
