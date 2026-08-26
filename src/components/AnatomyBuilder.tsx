import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useStore } from "../store/useStore";
import type { AnatomyRecord, Point } from "../types";
import { REF_H, REF_W } from "../lib/constants";

type Draft = Omit<AnatomyRecord, "id">;
type PickMode = "target" | "entry";

const emptyDraft: Draft = {
  electrodeName: "",
  targetName: "",
  preferredEntry: "",
  targetX: REF_W * 0.5,
  targetY: REF_H * 0.5,
  entryX: REF_W * 0.5,
  entryY: REF_H * 0.25,
  category: "",
  comments: "",
};

export default function AnatomyBuilder() {
  const anatomy = useStore((s) => s.anatomy);
  const addAnatomyRecord = useStore((s) => s.addAnatomyRecord);
  const updateAnatomyRecord = useStore((s) => s.updateAnatomyRecord);

  const [lookup, setLookup] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pickMode, setPickMode] = useState<PickMode>("target");
  const [changedIds, setChangedIds] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem("seegmap-anatomy-builder-changes");
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [status, setStatus] = useState("");
  const [showMatches, setShowMatches] = useState(false);

  const markChanged = (id: string) => {
    setChangedIds((ids) => {
      const next = new Set(ids);
      next.add(id);
      try {
        window.localStorage.setItem("seegmap-anatomy-builder-changes", JSON.stringify([...next]));
      } catch {
        // Local persistence is best-effort; the current session still tracks the changes.
      }
      return next;
    });
  };

  const matches = useMemo(() => {
    const q = lookup.trim().toLowerCase();
    if (!q) return [];
    return anatomy
      .filter(
        (a) =>
          (a.electrodeName || "").toLowerCase().includes(q) ||
          a.targetName.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [anatomy, lookup]);

  const loadRecord = (record: AnatomyRecord) => {
    setLoadedId(record.id);
    setDraft({
      electrodeName: record.electrodeName || "",
      targetName: record.targetName,
      preferredEntry: record.preferredEntry,
      targetX: record.targetX,
      targetY: record.targetY,
      entryX: record.entryX,
      entryY: record.entryY,
      category: record.category,
      comments: record.comments,
    });
    setLookup(record.electrodeName || record.targetName);
    setPickMode("target");
    setShowMatches(false);
    setStatus(`Loaded ${record.electrodeName || record.targetName}. Change anything you need, then click Save changes.`);
  };

  const loadByName = () => {
    const q = lookup.trim().toUpperCase();
    if (!q) {
      setStatus("Enter an electrode name.");
      return;
    }
    const record = anatomy.find(
      (a) =>
        (a.electrodeName || "").trim().toUpperCase() === q ||
        a.targetName.trim().toUpperCase() === q
    );
    if (record) {
      loadRecord(record);
      return;
    }
    setLoadedId(null);
    setDraft({ ...emptyDraft, electrodeName: q });
    setPickMode("target");
    setShowMatches(false);
    setStatus(`No existing record for ${q}. A new builder record has been started.`);
  };

  const startNew = () => {
    setLoadedId(null);
    setDraft({ ...emptyDraft, electrodeName: lookup.trim().toUpperCase() });
    setPickMode("target");
    setStatus("New builder record. Click the brain or edit the fields, then save.");
  };

  const setPoint = (mode: PickMode, point: Point) => {
    if (mode === "target") {
      setDraft((d) => ({ ...d, targetX: point.x * REF_W, targetY: point.y * REF_H }));
    } else {
      setDraft((d) => ({ ...d, entryX: point.x * REF_W, entryY: point.y * REF_H }));
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPoint(pickMode, {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    });
    setStatus(`${pickMode === "target" ? "Target" : "Entry"} position updated. You can click again or edit the coordinates numerically.`);
  };

  const save = () => {
    const record: Draft = {
      ...draft,
      electrodeName: draft.electrodeName.trim().toUpperCase(),
      targetName: draft.targetName.trim(),
      preferredEntry: draft.preferredEntry.trim(),
      category: draft.category.trim(),
      comments: draft.comments.trim(),
      targetX: Number(draft.targetX),
      targetY: Number(draft.targetY),
      entryX: Number(draft.entryX),
      entryY: Number(draft.entryY),
    };

    if (!record.targetName) {
      setStatus("Target name is required.");
      return;
    }

    if (loadedId) {
      updateAnatomyRecord(loadedId, record);
      markChanged(loadedId);
      setDraft(record);
      setStatus(`Updated ${record.electrodeName || record.targetName}. This record is queued for builder export.`);
      return;
    }

    const beforeIds = new Set(anatomy.map((a) => a.id));
    addAnatomyRecord(record);
    const created = useStore.getState().anatomy.find((a) => !beforeIds.has(a.id));
    if (created) {
      setLoadedId(created.id);
      markChanged(created.id);
    }
    setDraft(record);
    setStatus(`Added ${record.electrodeName || record.targetName}. This record is queued for builder export.`);
  };

  const exportChanges = () => {
    const records = anatomy.filter((a) => changedIds.has(a.id));
    if (!records.length) {
      setStatus("No builder changes are queued for export yet.");
      return;
    }
    const csv = Papa.unparse(
      records.map((a) => ({
        ElectrodeName: a.electrodeName,
        TargetName: a.targetName,
        PreferredEntry: a.preferredEntry,
        TargetX: Math.round(a.targetX),
        TargetY: Math.round(a.targetY),
        EntryX: Math.round(a.entryX),
        EntryY: Math.round(a.entryY),
        Category: a.category,
        Comments: a.comments,
      }))
    );
    downloadBlob(csv, "anatomy-library-builder-updates.csv", "text/csv");
    setStatus(`Exported ${records.length} builder update${records.length === 1 ? "" : "s"}.`);
  };

  const imageHref = `${import.meta.env.BASE_URL}brain-template.png`;

  return (
    <div className="card" style={{ marginTop: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 14 }}>Anatomical Library Builder</strong>
          <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
            This is a calibration tool for maintaining your anatomical library. Enter an electrode already in the library to load its current record, correct it, and export every builder change together.
          </p>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button className="btn btn-sm" onClick={exportChanges} disabled={!changedIds.size}>
            Export builder updates ({changedIds.size})
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              setChangedIds(new Set());
              try { window.localStorage.removeItem("seegmap-anatomy-builder-changes"); } catch {}
              setStatus("Builder export queue cleared. Library records were not changed.");
            }}
            disabled={!changedIds.size}
          >
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
                loadByName();
              }
              if (e.key === "Escape") setShowMatches(false);
            }}
            placeholder="Enter electrode name, e.g. LTMM"
            style={{ width: "100%" }}
          />
          {showMatches && matches.length > 0 && (
            <div className="card" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0, padding: 4, maxHeight: 260, overflow: "auto" }}>
              {matches.map((a) => (
                <button
                  key={a.id}
                  className="btn btn-ghost"
                  style={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
                  onClick={() => loadRecord(a)}
                >
                  <span className="mono" style={{ minWidth: 72 }}>{a.electrodeName || "--"}</span>
                  <span>{a.targetName}</span>
                  <span style={{ color: "var(--muted)", marginLeft: "auto", fontSize: 11 }}>
                    ({Math.round(a.targetX)}, {Math.round(a.targetY)})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-sm btn-primary" onClick={loadByName}>Load</button>
      </div>

      {loadedId && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--accent)" }}>
          Editing an existing library record. Saving updates that record; it does not create a duplicate.
        </div>
      )}

      {/* Stacked Vertical Layout: Inputs on Top, Brain Canvas Below */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 14 }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field">
              <label>Electrode name</label>
              <input className="mono" value={draft.electrodeName} onChange={(e) => setDraft({ ...draft, electrodeName: e.target.value.toUpperCase() })} placeholder="e.g. LTMM" />
            </div>
            <div className="field">
              <label>Target name</label>
              <input value={draft.targetName} onChange={(e) => setDraft({ ...draft, targetName: e.target.value })} placeholder="e.g. Hippocampus Body (Left)" />
            </div>
            <div className="field">
              <label>Preferred entry</label>
              <input value={draft.preferredEntry} onChange={(e) => setDraft({ ...draft, preferredEntry: e.target.value })} />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, margin: "14px 0 10px" }}>
            <button className={`btn btn-sm ${pickMode === "target" ? "btn-primary" : ""}`} onClick={() => setPickMode("target")}>Set Target</button>
            <button className={`btn btn-sm ${pickMode === "entry" ? "btn-primary" : ""}`} onClick={() => setPickMode("entry")}>Set Entry</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <CoordinateField label="Target X / Y" x={draft.targetX} y={draft.targetY} onChange={(x, y) => setDraft({ ...draft, targetX: x, targetY: y })} />
            <CoordinateField label="Entry X / Y" x={draft.entryX} y={draft.entryY} onChange={(x, y) => setDraft({ ...draft, entryX: x, entryY: y })} />
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <label>Comments</label>
            <textarea rows={3} value={draft.comments} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={save}>{loadedId ? "Save changes" : "Add to library"}</button>
            <button className="btn btn-sm" onClick={startNew}>Start new</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)", minHeight: 18 }}>{status}</div>
        </div>

        {/* Brain Figure Container */}
        <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Click to set <strong>{pickMode === "target" ? "TARGET" : "ENTRY"}</strong></span>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {pickMode === "target" ? `(${Math.round(draft.targetX)}, ${Math.round(draft.targetY)})` : `(${Math.round(draft.entryX)}, ${Math.round(draft.entryY)})`}
            </span>
          </div>
          <div style={{ border: "1px solid var(--line-strong)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <svg viewBox={`0 0 ${REF_W} ${REF_H}`} width="100%" style={{ display: "block", width: "100%", height: "auto", minHeight: 350, cursor: "crosshair" }} onClick={handleCanvasClick}>
              <image href={imageHref} x={0} y={0} width={REF_W} height={REF_H} />
              <circle cx={draft.entryX} cy={draft.entryY} r={12} fill="var(--accent)" stroke="#fff" strokeWidth={3} />
              <line x1={draft.targetX - 12} y1={draft.targetY - 12} x2={draft.targetX + 12} y2={draft.targetY + 12} stroke="var(--danger)" strokeWidth={5} />
              <line x1={draft.targetX - 12} y1={draft.targetY + 12} x2={draft.targetX + 12} y2={draft.targetY - 12} stroke="var(--danger)" strokeWidth={5} />
              <text x={draft.entryX + 16} y={draft.entryY - 12} fontSize={18} fontWeight={700} fill="var(--accent)" stroke="#fff" strokeWidth={4} paintOrder="stroke">ENTRY</text>
              <text x={draft.targetX + 16} y={draft.targetY - 12} fontSize={18} fontWeight={700} fill="var(--danger)" stroke="#fff" strokeWidth={4} paintOrder="stroke">TARGET</text>
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
            <span>Reference: {REF_W} × {REF_H} px</span>
            <span>Click again to correct a point</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoordinateField({ label, x, y, onChange }: { label: string; x: number; y: number; onChange: (x: number, y: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="number" value={Math.round(x)} onChange={(e) => onChange(Number(e.target.value), y)} />
        <input type="number" value={Math.round(y)} onChange={(e) => onChange(x, Number(e.target.value))} />
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
