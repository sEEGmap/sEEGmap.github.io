import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import type { Point, SIAnchor } from "../types";
import { REF_H, REF_W } from "../lib/constants";

type PickMode = "lateralStart" | "lateralEnd" | "medialStart" | "medialEnd";

type Draft = {
  electrodeName: string;
  entryName: string;
  targetName: string;
  comments: string;
  lateralStart: Point;
  lateralEnd: Point;
  medialStart: Point;
  medialEnd: Point;
};

const emptyDraft: Draft = {
  electrodeName: "",
  entryName: "",
  targetName: "",
  comments: "",
  lateralStart: { x: 0.5, y: 0.12 },
  lateralEnd: { x: 0.5, y: 0.28 },
  medialStart: { x: 0.5, y: 0.60 },
  medialEnd: { x: 0.5, y: 0.78 },
};

const STORAGE_KEY = "seegmap-superior-inferior-builder-changes";

export default function SuperiorInferiorBuilder() {
  const siRegions = useStore((s) => s.siRegions);
  const [lookup, setLookup] = useState("");
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pickMode, setPickMode] = useState<PickMode>("lateralStart");
  const [changedNames, setChangedNames] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [status, setStatus] = useState("");
  const [showMatches, setShowMatches] = useState(false);

  const names = useMemo(() => Object.keys(siRegions || {}).sort(), [siRegions]);
  const matches = useMemo(() => {
    const q = lookup.trim().toUpperCase();
    if (!q) return names.slice(0, 12);
    return names.filter((name) => name.includes(q)).slice(0, 12);
  }, [lookup, names]);

  const anchorToDraft = (name: string, anchor: SIAnchor): Draft => ({
    electrodeName: name,
    entryName: "",
    targetName: "",
    comments: "",
    lateralStart: { x: anchor.lateralStart[0] / REF_W, y: anchor.lateralStart[1] / REF_H },
    lateralEnd: { x: anchor.lateralEnd[0] / REF_W, y: anchor.lateralEnd[1] / REF_H },
    medialStart: { x: anchor.medialStart[0] / REF_W, y: anchor.medialStart[1] / REF_H },
    medialEnd: { x: anchor.medialEnd[0] / REF_W, y: anchor.medialEnd[1] / REF_H },
  });

  const loadName = (rawName = lookup) => {
    const name = rawName.trim().toUpperCase();
    if (!name) {
      setStatus("Enter an electrode name.");
      return;
    }

    const anchor = siRegions?.[name];
    if (anchor) {
      setLoadedName(name);
      setDraft(anchorToDraft(name, anchor));
      setLookup(name);
      setPickMode("lateralStart");
      setShowMatches(false);
      setStatus(`Loaded ${name}. Click any trajectory point to correct it, then save.`);
      return;
    }

    setLoadedName(null);
    setDraft({ ...emptyDraft, electrodeName: name });
    setLookup(name);
    setPickMode("lateralStart");
    setShowMatches(false);
    setStatus(`No default S→I record exists for ${name}. A new record has been started.`);
  };

  const startNew = () => {
    const name = lookup.trim().toUpperCase();
    setLoadedName(null);
    setDraft({ ...emptyDraft, electrodeName: name });
    setPickMode("lateralStart");
    setStatus("New S→I record. Click the four trajectory points, then export it.");
  };

  const markChanged = (name: string) => {
    setChangedNames((previous) => {
      const next = new Set(previous);
      next.add(name);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Best-effort persistence.
      }
      return next;
    });
  };

  const setPoint = (mode: PickMode, point: Point) => {
    setDraft((current) => ({ ...current, [mode]: point }));
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
    setPoint(pickMode, point);
    setStatus(`${labelFor(pickMode)} updated.`);
  };

  const save = () => {
    const name = draft.electrodeName.trim().toUpperCase();
    if (!name) {
      setStatus("Electrode name is required.");
      return;
    }

    const normalized: Draft = {
      ...draft,
      electrodeName: name,
      entryName: draft.entryName.trim(),
      targetName: draft.targetName.trim(),
      comments: draft.comments.trim(),
    };

    // The default SI JSON is intentionally not modified in the browser. Saving here
    // records the change in the local builder queue so it can be exported and manually
    // merged into public/superior-inferior-regions.json.
    setDraft(normalized);
    markChanged(name);
    setLoadedName(name);
    setStatus(`${name} saved to the export queue. Export JSON when you are ready to update the default set.`);
  };

  const exportChanges = () => {
    const records = [...changedNames]
      .map((name) => {
        if (name === draft.electrodeName.trim().toUpperCase()) return [name, draft] as const;
        const anchor = siRegions?.[name];
        return anchor ? [name, anchor] as const : null;
      })
      .filter((x): x is readonly [string, Draft | SIAnchor] => Boolean(x));

    if (!records.length) {
      setStatus("No S→I builder changes are queued for export yet.");
      return;
    }

    const output: Record<string, SIAnchor> = {};
    for (const [name, value] of records) {
      if ("lateralStart" in value && Array.isArray(value.lateralStart)) {
        output[name] = value;
      } else {
        const d = value as Draft;
        output[name] = {
          lateralStart: [Math.round(d.lateralStart.x * REF_W), Math.round(d.lateralStart.y * REF_H)],
          lateralEnd: [Math.round(d.lateralEnd.x * REF_W), Math.round(d.lateralEnd.y * REF_H)],
          medialStart: [Math.round(d.medialStart.x * REF_W), Math.round(d.medialStart.y * REF_H)],
          medialEnd: [Math.round(d.medialEnd.x * REF_W), Math.round(d.medialEnd.y * REF_H)],
        };
      }
    }

    downloadBlob(JSON.stringify(output, null, 2), "superior-inferior-regions.json", "application/json");
    setStatus(`Exported ${records.length} S→I record${records.length === 1 ? "" : "s"}. Merge these entries into the default superior-inferior-regions.json file.`);
  };

  const clearQueue = () => {
    setChangedNames(new Set());
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setStatus("Export queue cleared. The default configuration was not changed.");
  };

  const pointPixels = (point: Point) => ({
    x: point.x * REF_W,
    y: point.y * REF_H,
  });

  const modes: Array<[PickMode, string]> = [
    ["lateralStart", "Lateral superior"],
    ["lateralEnd", "Lateral inferior"],
    ["medialStart", "Medial superior"],
    ["medialEnd", "Medial inferior"],
  ];

  return (
    <div className="card" style={{ marginTop: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 14 }}>Superior → Inferior Trajectory Builder</strong>
          <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
            Build the two-segment S→I trajectory used by the planner. Load an existing default electrode to correct it,
            or enter a new name. The exported JSON is directly compatible with <span className="mono">superior-inferior-regions.json</span>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={exportChanges} disabled={!changedNames.size}>
            Export JSON ({changedNames.size})
          </button>
          <button className="btn btn-sm" onClick={clearQueue} disabled={!changedNames.size}>
            Clear queue
          </button>
          <button className="btn btn-sm" onClick={startNew}>New</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            className="mono"
            value={lookup}
            onChange={(e) => {
              setLookup(e.target.value.toUpperCase());
              setShowMatches(true);
            }}
            onFocus={() => setShowMatches(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                loadName();
              }
              if (e.key === "Escape") setShowMatches(false);
            }}
            placeholder="Enter electrode name, e.g. LAI"
            style={{ width: "100%" }}
          />
          {showMatches && matches.length > 0 && (
            <div className="card" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0, padding: 4, maxHeight: 260, overflow: "auto" }}>
              {matches.map((name) => (
                <button
                  key={name}
                  className="btn btn-ghost"
                  style={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
                  onClick={() => loadName(name)}
                >
                  <span className="mono">{name}</span>
                  <span style={{ color: "var(--muted)", marginLeft: "auto", fontSize: 11 }}>Default trajectory</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => loadName()}>Load</button>
      </div>

      {loadedName && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--accent)" }}>
          Editing {loadedName}. Saving adds it to the JSON export queue; the bundled default file is not changed automatically.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 210px", gap: 16, marginTop: 14 }}>
        <div>
          <div className="field">
            <label>Electrode name</label>
            <input className="mono" value={draft.electrodeName} onChange={(e) => setDraft({ ...draft, electrodeName: e.target.value.toUpperCase() })} placeholder="LAI" />
          </div>

          <div style={{ display: "flex", gap: 6, margin: "12px 0 10px", flexWrap: "wrap" }}>
            {modes.map(([mode, label]) => (
              <button
                key={mode}
                className={`btn btn-sm ${pickMode === mode ? "btn-primary" : ""}`}
                onClick={() => setPickMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {modes.map(([mode, label]) => (
              <CoordinateField
                key={mode}
                label={label}
                point={draft[mode]}
                onChange={(point) => setDraft({ ...draft, [mode]: point })}
              />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>Entry label (optional)</label>
              <input value={draft.entryName} onChange={(e) => setDraft({ ...draft, entryName: e.target.value })} />
            </div>
            <div className="field">
              <label>Target label (optional)</label>
              <input value={draft.targetName} onChange={(e) => setDraft({ ...draft, targetName: e.target.value })} />
            </div>
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <label>Comments (not exported to default JSON)</label>
            <textarea rows={2} value={draft.comments} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={save}>
              {loadedName ? "Save changes" : "Save to export queue"}
            </button>
            <button className="btn btn-sm" onClick={startNew}>Start new</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)", minHeight: 18 }}>{status}</div>
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--ink)" }}>How to build</strong>
          <ol style={{ paddingLeft: 18, marginTop: 7 }}>
            <li>Select a point button.</li>
            <li>Click the corresponding point on the brain.</li>
            <li>Repeat for all four points.</li>
            <li>Save, then export JSON.</li>
          </ol>
          <div style={{ marginTop: 12 }}>
            <strong style={{ color: "var(--ink)" }}>Trajectory segments</strong>
            <div style={{ marginTop: 5 }}>Lateral: superior → inferior</div>
            <div>Medial: superior → inferior</div>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 1000, margin: "20px auto 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Click to set <strong>{labelFor(pickMode)}</strong>
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {formatPoint(draft[pickMode])}
          </span>
        </div>
        <div style={{ border: "1px solid var(--line-strong)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <svg
            viewBox={`0 0 ${REF_W} ${REF_H}`}
            width="100%"
            style={{ display: "block", width: "100%", height: "auto", minHeight: 400, cursor: "crosshair" }}
            onClick={handleCanvasClick}
          >
            <image href={`${import.meta.env.BASE_URL}brain-template.png`} x={0} y={0} width={REF_W} height={REF_H} />
            <Trajectory a={draft.lateralStart} b={draft.lateralEnd} />
            <Trajectory a={draft.medialStart} b={draft.medialEnd} />
            <PointMarker point={draft.lateralStart} kind="dot" label="L-S" />
            <PointMarker point={draft.lateralEnd} kind="dot" label="L-I" />
            <PointMarker point={draft.medialStart} kind="x" label="M-S" />
            <PointMarker point={draft.medialEnd} kind="x" label="M-I" />
          </svg>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          <span>Reference: {REF_W} × {REF_H} px</span>
          <span>Solid dots = lateral segment · X markers = medial segment</span>
        </div>
      </div>
    </div>
  );
}

function labelFor(mode: PickMode) {
  return {
    lateralStart: "Lateral superior",
    lateralEnd: "Lateral inferior",
    medialStart: "Medial superior",
    medialEnd: "Medial inferior",
  }[mode];
}

function formatPoint(point: Point) {
  return `(${Math.round(point.x * REF_W)}, ${Math.round(point.y * REF_H)})`;
}

function CoordinateField({ label, point, onChange }: { label: string; point: Point; onChange: (point: Point) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="number"
          value={Math.round(point.x * REF_W)}
          onChange={(e) => onChange({ ...point, x: Number(e.target.value) / REF_W })}
        />
        <input
          type="number"
          value={Math.round(point.y * REF_H)}
          onChange={(e) => onChange({ ...point, y: Number(e.target.value) / REF_H })}
        />
      </div>
    </div>
  );
}

function Trajectory({ a, b }: { a: Point; b: Point }) {
  return (
    <line
      x1={a.x * REF_W}
      y1={a.y * REF_H}
      x2={b.x * REF_W}
      y2={b.y * REF_H}
      stroke="var(--accent)"
      strokeWidth={8}
      strokeDasharray="12 7"
      strokeLinecap="round"
      pointerEvents="none"
    />
  );
}

function PointMarker({ point, kind, label }: { point: Point; kind: "dot" | "x"; label: string }) {
  const x = point.x * REF_W;
  const y = point.y * REF_H;
  return (
    <g pointerEvents="none">
      {kind === "dot" ? (
        <circle cx={x} cy={y} r={13} fill="var(--accent)" stroke="#fff" strokeWidth={3} />
      ) : (
        <>
          <line x1={x - 13} y1={y - 13} x2={x + 13} y2={y + 13} stroke="var(--danger)" strokeWidth={6} />
          <line x1={x - 13} y1={y + 13} x2={x + 13} y2={y - 13} stroke="var(--danger)" strokeWidth={6} />
        </>
      )}
      <text x={x + 18} y={y - 13} fontSize={17} fontWeight={700} fill="var(--ink)" stroke="#fff" strokeWidth={4} paintOrder="stroke">{label}</text>
    </g>
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
