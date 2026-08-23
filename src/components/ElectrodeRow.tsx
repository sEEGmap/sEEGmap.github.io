import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../store/useStore";
import type { Electrode } from "../types";

const GRIP = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    {[3, 7, 11].map((y) =>
      [4, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill="var(--faint)" />)
    )}
  </svg>
);

export default function ElectrodeRow({ electrode }: { electrode: Electrode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: electrode.id,
  });
  const selectedId = useStore((s) => s.selectedId);
  const hoveredId = useStore((s) => s.hoveredId);
  const setSelected = useStore((s) => s.setSelected);
  const setHovered = useStore((s) => s.setHovered);
  const renameElectrode = useStore((s) => s.renameElectrode);
  const updateElectrode = useStore((s) => s.updateElectrode);
  const removeElectrode = useStore((s) => s.removeElectrode);

  const [expanded, setExpanded] = useState(false);
  const [nameDraft, setNameDraft] = useState(electrode.name);
  const [nameError, setNameError] = useState<string | null>(null);

  const isActive = electrode.id === selectedId || electrode.id === hoveredId;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const commitName = () => {
    if (nameDraft.trim() === electrode.name) {
      setNameError(null);
      return;
    }
    const res = renameElectrode(electrode.id, nameDraft);
    if (!res.ok) {
      setNameError(res.message);
    } else {
      setNameError(null);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card"
      onMouseEnter={() => setHovered(electrode.id)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => setSelected(electrode.id)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 10px",
          borderLeft: `${isActive ? 6 : 3}px solid ${electrode.color}`,
          borderRadius: "var(--radius-lg)",
          background: isActive ? "var(--accent-soft)" : "transparent",
          boxShadow: isActive ? "inset 0 0 0 1px var(--accent)" : "none",
          transition: "border-left-width 0.1s ease, background 0.1s ease",
        }}
      >
        <span {...attributes} {...listeners} style={{ cursor: "grab", display: "flex", touchAction: "none" }}>
          {GRIP}
        </span>

        <input
          className="mono"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value.toUpperCase())}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 78,
            fontWeight: 700,
            fontSize: 13.5,
            border: "1px solid transparent",
            borderRadius: 6,
            padding: "4px 6px",
            background: "transparent",
          }}
        />

        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, color: isActive ? "var(--ink)" : "var(--muted)" }}>Entry: </span>
            {electrode.entryName || "—"}
          </div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, color: isActive ? "var(--ink)" : "var(--muted)" }}>Target: </span>
            {electrode.targetName || "—"}
          </div>
        </div>

        {electrode.notes && (
          <span title="Has notes" style={{ color: "var(--accent)", fontSize: 14 }}>
            &#9998;
          </span>
        )}

        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? "Hide" : "Edit"}
        </button>
        <button
          className="btn btn-ghost btn-sm btn-danger"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete electrode ${electrode.name}?`)) removeElectrode(electrode.id);
          }}
        >
          Delete
        </button>
      </div>

      {nameError && (
        <div style={{ color: "var(--danger)", fontSize: 11.5, padding: "0 14px 6px" }}>{nameError}</div>
      )}

      {expanded && (
        <div
          style={{ padding: "4px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Entry</label>
              <input
                value={electrode.entryName}
                onChange={(e) => updateElectrode(electrode.id, { entryName: e.target.value })}
                placeholder="e.g. Anterior MTG"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Target</label>
              <input
                value={electrode.targetName}
                onChange={(e) => updateElectrode(electrode.id, { targetName: e.target.value })}
                placeholder="e.g. Amygdala"
              />
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea
              value={electrode.notes}
              onChange={(e) => updateElectrode(electrode.id, { notes: e.target.value })}
              rows={2}
              placeholder="Optional notes"
            />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Color</label>
            <input
              type="color"
              value={electrode.color}
              onChange={(e) => updateElectrode(electrode.id, { color: e.target.value })}
              style={{ height: 34, padding: 3, cursor: "pointer" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
