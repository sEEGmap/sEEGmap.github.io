import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../store/useStore";
import type { Electrode } from "../types";

const GRIP = (
  <svg width="12" height="14" viewBox="0 0 14 14" fill="none">
    {[3, 7, 11].map((y) =>
      [4, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill="var(--faint)" />)
    )}
  </svg>
);

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  border: "1px solid var(--line)",
  borderRadius: 4,
  padding: "4px 6px",
  background: "var(--surface)",
};

export const ROW_GRID_COLUMNS = "14px 62px 1fr 1fr 22px";

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

  const [moreOpen, setMoreOpen] = useState(false);
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

  const toggleSelect = () => setSelected(selectedId === electrode.id ? null : electrode.id);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onMouseEnter={() => setHovered(electrode.id)}
        onMouseLeave={() => setHovered(null)}
        onClick={toggleSelect}
        style={{
          display: "grid",
          gridTemplateColumns: ROW_GRID_COLUMNS,
          gap: 6,
          alignItems: "center",
          padding: "6px 8px",
          borderLeft: `${isActive ? 5 : 2}px solid ${electrode.color}`,
          borderBottom: "1px solid var(--line)",
          background: isActive ? "var(--accent-soft)" : "transparent",
          cursor: "pointer",
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
          style={{ ...cellInputStyle, fontWeight: 700 }}
        />

        <input
          value={electrode.entryName}
          onChange={(e) => updateElectrode(electrode.id, { entryName: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Entry"
          style={cellInputStyle}
        />

        <input
          value={electrode.targetName}
          onChange={(e) => updateElectrode(electrode.id, { targetName: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Target"
          style={cellInputStyle}
        />

        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            setMoreOpen((v) => !v);
          }}
          title="Notes, color, delete"
          style={{ padding: "2px 4px", fontSize: 13, color: electrode.notes ? "var(--accent)" : "var(--muted)" }}
        >
          &#8942;
        </button>
      </div>

      {nameError && (
        <div style={{ color: "var(--danger)", fontSize: 11.5, padding: "2px 12px 4px" }}>{nameError}</div>
      )}

      {moreOpen && (
        <div
          style={{
            padding: "10px 12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderBottom: "1px solid var(--line)",
            background: "var(--surface-2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="field">
            <label>Notes</label>
            <textarea
              value={electrode.notes}
              onChange={(e) => updateElectrode(electrode.id, { notes: e.target.value })}
              rows={2}
              placeholder="Optional notes"
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={electrode.showTarget !== false}
              onChange={(e) => updateElectrode(electrode.id, { showTarget: e.target.checked })}
            />
            Show target X
          </label>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            <div className="field" style={{ maxWidth: 140 }}>
              <label>Color</label>
              <input
                type="color"
                value={electrode.color}
                onChange={(e) => updateElectrode(electrode.id, { color: e.target.value })}
                style={{ height: 32, padding: 3, cursor: "pointer" }}
              />
            </div>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (window.confirm(`Delete electrode ${electrode.name}?`)) removeElectrode(electrode.id);
              }}
            >
              Delete Electrode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
