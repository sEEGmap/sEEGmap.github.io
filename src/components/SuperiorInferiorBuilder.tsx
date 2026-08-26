import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import type { Point, SIAnchor } from "../types";
import { REF_H, REF_W } from "../lib/constants";

type PickMode = "lateralStart" | "lateralEnd" | "medialStart" | "medialEnd";

const PICK_LABELS: Record<PickMode, string> = {
  lateralStart: "Lateral Start",
  lateralEnd: "Lateral End",
  medialStart: "Medial Start",
  medialEnd: "Medial End",
};

const emptyDraft: SIAnchor = {
  lateralStart: [REF_W * 0.2, REF_H * 0.1],
  lateralEnd: [REF_W * 0.2, REF_H * 0.25],
  medialStart: [REF_W * 0.18, REF_H * 0.65],
  medialEnd: [REF_W * 0.18, REF_H * 0.82],
};

const STORAGE_KEY = "seegmap-si-builder-changes";

export default function SuperiorInferiorBuilder() {
  const siRegions = useStore((s) => s.siRegions);

  const [name, setName] = useState("");
  const [draft, setDraft] = useState<SIAnchor>(emptyDraft);
  const [pickMode, setPickMode] = useState<PickMode>("lateralStart");
  const [isExisting, setIsExisting] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [status, setStatus] = useState("");
  const [queued, setQueued] = useState<Record<string, SIAnchor>>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, SIAnchor>) : {};
    } catch {
      return {};
    }
  });

  const persistQueue = (next: Record<string, SIAnchor>) => {
    setQueued(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Local persistence is best-effort; the current session still tracks the queue.
    }
  };

  const defaultKeys = useMemo(() => Object.keys(siRegions || {}).sort(), [siRegions]);

  const matches = useMemo(() => {
    const q = name.trim().toUpperCase();
    if (!q) return [];
    return defaultKeys.filter((k) => k.includes(q)).slice(0, 10);
  }, [defaultKeys, name]);

  const loadName = (raw: string) => {
    const q = raw.trim().toUpperCase();
    if (!q) {
      setStatus("Enter an electrode name.");
      return;
    }
    setName(q);
    setShowMatches(false);
    if (queued[q]) {
      setDraft(queued[q]);
      setIsExisting(true);
      setStatus(`Loaded ${q} from your builder queue. Adjust and save to update it.`);
      return;
    }
    if (siRegions && siRegions[q]) {
      setDraft(siRegions[q]);
      setIsExisting(true);
      setStatus(`Loaded ${q} from the default set. Adjust and save to queue an override.`);
      return;
    }
    setDraft(emptyDraft);
    setIsExisting(false);
    setPickMode("lateralStart");
    setStatus(`No existing entry for ${q}. Click the brain to place its 4 points, then save.`);
  };

  const startNew = () => {
    setName("");
    setDraft(emptyDraft);
    setIsExisting(false);
    setPickMode("lateralStart");
    setStatus("New builder entry. Enter a name, click the brain to place its 4 points, then save.");
  };

  const setPoint = (mode: PickMode, point: Point) => {
    const px = Math.round(point.x * REF_W);
    const py = Math.round(point.y * REF_H);
    setDraft((d) => ({ ...d, [mode]: [px, py] }));
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPoint(pickMode, {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    });
    // Step through the 4 points in order so a full trajectory can be placed with 4 clicks in a row.
    const order: PickMode[] = ["lateralStart", "lateralEnd", "medialStart", "medialEnd"];
    const next = order[(order.indexOf(pickMode) + 1) % order.length];
    setPickMode(next);
    setStatus(`${PICK_LABELS[pickMode]} updated. Now click to set ${PICK_LABELS[next]} (or pick a point above to edit any of the 4).`);
  };

  const save = () => {
    const q = name.trim().toUpperCase();
    if (!q) {
      setStatus("Enter an electrode name before saving.");
      return;
    }
    const next = { ...queued, [q]: draft };
    persistQueue(next);
    setName(q);
    setIsExisting(true);
    setStatus(`Queued ${q} for JSON export (${Object.keys(next).length} queued total).`);
  };

  const removeQueued = (key: string) => {
    const next = { ...queued };
    delete next[key];
    persistQueue(next);
    if (key === name.trim().toUpperCase()) setIsExisting(false);
  };

  const clearQueue = () => {
    persistQueue({});
    setStatus("Builder export queue cleared. The default set was not changed.");
  };

  const exportJson = () => {
    const keys = Object.keys(queued);
    if (!keys.length) {
      setStatus("No builder entries are queued for export yet.");
      return;
    }
    downloadBlob(JSON.stringify(queued, null, 2), "superior-inferior-regions-builder-updates.json", "application/json");
    setStatus(`Exported ${keys.length} entr${keys.length === 1 ? "y" : "ies"}. Merge these keys into public/superior-inferior-regions.json manually.`);
  };

  const imageHref = `${import.meta.env.BASE_URL}brain-template.png`;
  const queuedCount = Object.keys(queued).length;

  return (
    <div className="card" style={{ marginTop: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 14 }}>Superior–Inferior Trajectory Builder</strong>
          <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
            Click-to-build tool for superior-to-inferior electrodes (e.g. <span className="mono">LAI</span>,{" "}
            <span className="mono">RPF</span>). Place the lateral start/end (filled circles) and medial
            start/end (X marks) points, then export the queue as JSON to merge into{" "}
            <span className="mono">public/superior-inferior-regions.json</span> by hand.
          </p>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button className="btn btn-sm" onClick={exportJson} disabled={!queuedCount}>
            Export builder JSON ({queuedCount})
          </button>
          <button className="btn btn-sm" onClick={clearQueue} disabled={!queuedCount}>
            Clear queue
          </button>
          <button className="btn btn-sm" onClick={startNew}>New</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            className="mono"
            value={name}
            onChange={(e) => {
              setName(e.target.value.toUpperCase());
              setShowMatches(true);
            }}
            onFocus={() => setShowMatches(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                loadName(name);
              }
              if (e.key === "Escape") setShowMatches(false);
            }}
            placeholder="Enter electrode name, e.g. LAI"
            style={{ width: "100%" }}
          />
          {showMatches && matches.length > 0 && (
            <div className="card" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0, padding: 4, maxHeight: 220, overflow: "auto" }}>
              {matches.map((k) => (
                <button
                  key={k}
                  className="btn btn-ghost"
                  style={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
                  onClick={() => loadName(k)}
                >
                  <span className="mono" style={{ minWidth: 72 }}>{k}</span>
                  {queued[k] && <span className="badge" style={{ marginLeft: "auto", fontSize: 9.5 }}>Queued</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => loadName(name)}>Load</button>
      </div>

      {isExisting && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--accent)" }}>
          Editing {queued[name.trim().toUpperCase()] ? "a queued" : "an existing default-set"} entry. Saving updates the queue for this name.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 14 }}>
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 10px" }}>
            {(Object.keys(PICK_LABELS) as PickMode[]).map((mode) => (
              <button
                key={mode}
                className={`btn btn-sm ${pickMode === mode ? "btn-primary" : ""}`}
                onClick={() => setPickMode(mode)}
              >
                {PICK_LABELS[mode]}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <CoordinateField label="Lateral Start X / Y" point={draft.lateralStart} onChange={(p) => setDraft({ ...draft, lateralStart: p })} />
            <CoordinateField label="Lateral End X / Y" point={draft.lateralEnd} onChange={(p) => setDraft({ ...draft, lateralEnd: p })} />
            <CoordinateField label="Medial Start X / Y" point={draft.medialStart} onChange={(p) => setDraft({ ...draft, medialStart: p })} />
            <CoordinateField label="Medial End X / Y" point={draft.medialEnd} onChange={(p) => setDraft({ ...draft, medialEnd: p })} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={!name.trim()}>
              {isExisting ? "Update queued entry" : "Add to queue"}
            </button>
            <button className="btn btn-sm" onClick={startNew}>Start new</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)", minHeight: 18 }}>{status}</div>
        </div>

        <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Click to set <strong>{PICK_LABELS[pickMode].toUpperCase()}</strong>
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              ({Math.round(draft[pickMode][0])}, {Math.round(draft[pickMode][1])})
            </span>
          </div>
          <div style={{ border: "1px solid var(--line-strong)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <svg viewBox={`0 0 ${REF_W} ${REF_H}`} width="100%" style={{ display: "block", width: "100%", height: "auto", minHeight: 350, cursor: "crosshair" }} onClick={handleCanvasClick}>
              <image href={imageHref} x={0} y={0} width={REF_W} height={REF_H} />

              {/* Lateral trajectory: filled circles + connecting line */}
              <line
                x1={draft.lateralStart[0]} y1={draft.lateralStart[1]}
                x2={draft.lateralEnd[0]} y2={draft.lateralEnd[1]}
                stroke="var(--accent)" strokeWidth={4}
              />
              <circle cx={draft.lateralStart[0]} cy={draft.lateralStart[1]} r={11} fill="var(--accent)" stroke="#fff" strokeWidth={3} />
              <circle cx={draft.lateralEnd[0]} cy={draft.lateralEnd[1]} r={11} fill="var(--accent)" stroke="#fff" strokeWidth={3} />
              <text x={draft.lateralStart[0] + 15} y={draft.lateralStart[1] - 10} fontSize={16} fontWeight={700} fill="var(--accent)" stroke="#fff" strokeWidth={4} paintOrder="stroke">LAT START</text>
              <text x={draft.lateralEnd[0] + 15} y={draft.lateralEnd[1] - 10} fontSize={16} fontWeight={700} fill="var(--accent)" stroke="#fff" strokeWidth={4} paintOrder="stroke">LAT END</text>

              {/* Medial trajectory: X marks + connecting line */}
              <line
                x1={draft.medialStart[0]} y1={draft.medialStart[1]}
                x2={draft.medialEnd[0]} y2={draft.medialEnd[1]}
                stroke="var(--danger)" strokeWidth={4}
              />
              <XMark x={draft.medialStart[0]} y={draft.medialStart[1]} />
              <XMark x={draft.medialEnd[0]} y={draft.medialEnd[1]} />
              <text x={draft.medialStart[0] + 15} y={draft.medialStart[1] - 10} fontSize={16} fontWeight={700} fill="var(--danger)" stroke="#fff" strokeWidth={4} paintOrder="stroke">MED START</text>
              <text x={draft.medialEnd[0] + 15} y={draft.medialEnd[1] - 10} fontSize={16} fontWeight={700} fill="var(--danger)" stroke="#fff" strokeWidth={4} paintOrder="stroke">MED END</text>
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
            <span>Reference: {REF_W} × {REF_H} px</span>
            <span>Clicks advance through the 4 points in order -- pick a button above to jump to one</span>
          </div>
        </div>

        {queuedCount > 0 && (
          <div>
            <strong style={{ fontSize: 12.5 }}>Queued for export ({queuedCount})</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {Object.keys(queued).sort().map((k) => (
                <div key={k} className="card" style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{k}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)", flex: 1 }}>
                    lat ({queued[k].lateralStart[0]}, {queued[k].lateralStart[1]}) → ({queued[k].lateralEnd[0]}, {queued[k].lateralEnd[1]}) ·
                    {" "}med ({queued[k].medialStart[0]}, {queued[k].medialStart[1]}) → ({queued[k].medialEnd[0]}, {queued[k].medialEnd[1]})
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => loadName(k)}>Edit</button>
                  <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeQueued(k)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function XMark({ x, y }: { x: number; y: number }) {
  return (
    <>
      <line x1={x - 11} y1={y - 11} x2={x + 11} y2={y + 11} stroke="var(--danger)" strokeWidth={5} />
      <line x1={x - 11} y1={y + 11} x2={x + 11} y2={y - 11} stroke="var(--danger)" strokeWidth={5} />
    </>
  );
}

function CoordinateField({ label, point, onChange }: { label: string; point: [number, number]; onChange: (p: [number, number]) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="number" value={Math.round(point[0])} onChange={(e) => onChange([Number(e.target.value), point[1]])} />
        <input type="number" value={Math.round(point[1])} onChange={(e) => onChange([point[0], Number(e.target.value)])} />
      </div>
    </div>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
