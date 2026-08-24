import { useState } from "react";
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
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pickMode, setPickMode] = useState<PickMode>("target");
  const [created, setCreated] = useState<Draft[]>([]);

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
      window.alert("Target name is required.");
      return;
    }
    if (
      record.electrodeName &&
      anatomy.some((a) => (a.electrodeName || "").trim().toUpperCase() === record.electrodeName)
    ) {
      window.alert(`${record.electrodeName} already exists in the anatomical library. Edit the existing record instead of creating a duplicate.`);
      return;
    }
    addAnatomyRecord(record);
    setCreated((items) => [...items, record]);
    setDraft(emptyDraft);
    setPickMode("target");
  };

  const exportCreated = () => {
    if (created.length === 0) {
      window.alert("Create at least one library entry first.");
      return;
    }
    const csv = Papa.unparse(
      created.map((a) => ({
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
    downloadBlob(csv, "anatomy-library-additions.csv", "text/csv");
  };

  const clear = () => {
    setDraft(emptyDraft);
    setPickMode("target");
  };

  return (
    <div className="card" style={{ marginTop: 18, padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.2fr)", gap: 18 }}>
        <div>
          <strong style={{ fontSize: 14 }}>Click-to-build anatomical library</strong>
          <p style={{ margin: "5px 0 14px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
            Choose Target or Entry, then click its location on the template. Coordinates are stored in the
            same reference-pixel system as the library. You can fine-tune every coordinate numerically before saving.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field">
              <label>Electrode name (optional)</label>
              <input
                className="mono"
                value={draft.electrodeName}
                onChange={(e) => setDraft({ ...draft, electrodeName: e.target.value.toUpperCase() })}
                placeholder="e.g. LTMM"
              />
            </div>
            <div className="field">
              <label>Target name</label>
              <input value={draft.targetName} onChange={(e) => setDraft({ ...draft, targetName: e.target.value })} placeholder="e.g. Hippocampus Body (Left)" />
            </div>
            <div className="field">
              <label>Preferred entry</label>
              <input value={draft.preferredEntry} onChange={(e) => setDraft({ ...draft, preferredEntry: e.target.value })} placeholder="e.g. L Mid MTG" />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Mesial Temporal" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, margin: "14px 0 10px" }}>
            <button
              className={`btn btn-sm ${pickMode === "target" ? "btn-primary" : ""}`}
              onClick={() => setPickMode("target")}
            >
              Set Target
            </button>
            <button
              className={`btn btn-sm ${pickMode === "entry" ? "btn-primary" : ""}`}
              onClick={() => setPickMode("entry")}
            >
              Set Entry
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <CoordinateField
              label="Target X / Y"
              x={draft.targetX}
              y={draft.targetY}
              onChange={(x, y) => setDraft({ ...draft, targetX: x, targetY: y })}
            />
            <CoordinateField
              label="Entry X / Y"
              x={draft.entryX}
              y={draft.entryY}
              onChange={(x, y) => setDraft({ ...draft, entryX: x, entryY: y })}
            />
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <label>Comments</label>
            <textarea rows={3} value={draft.comments} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={save}>Save to Library</button>
            <button className="btn btn-sm" onClick={clear}>Clear</button>
            <button className="btn btn-sm" disabled={created.length === 0} onClick={exportCreated}>
              Export {created.length ? `${created.length} New` : "New"} Records CSV
            </button>
          </div>

          {created.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)" }}>
              The exported CSV contains only entries created with this Builder, using the original library's column names.
              Append those rows to your seed <span className="mono">anatomy-library.csv</span>.
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Click to set <strong>{pickMode === "target" ? "TARGET" : "ENTRY"}</strong>
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {pickMode === "target"
                ? `(${Math.round(draft.targetX)}, ${Math.round(draft.targetY)})`
                : `(${Math.round(draft.entryX)}, ${Math.round(draft.entryY)})`}
            </span>
          </div>

          <div style={{ border: "1px solid var(--line-strong)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <svg
              viewBox={`0 0 ${REF_W} ${REF_H}`}
              width="100%"
              style={{ display: "block", cursor: "crosshair" }}
              onClick={handleCanvasClick}
            >
              <image href="./brain-template.png" x={0} y={0} width={REF_W} height={REF_H} />
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

function CoordinateField({
  label,
  x,
  y,
  onChange,
}: {
  label: string;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
}) {
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
  link.click();
  URL.revokeObjectURL(url);
}
