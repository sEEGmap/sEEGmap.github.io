import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useStore } from "../store/useStore";
import ElectrodeRow, { ROW_GRID_COLUMNS } from "./ElectrodeRow";
import AddElectrodeDialog from "./AddElectrodeDialog";
import SketchPanel from "./SketchPanel";

export default function ElectrodePanel() {
  const electrodes = useStore((s) => s.electrodes);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const reorderElectrodes = useStore((s) => s.reorderElectrodes);
  const selectedId = useStore((s) => s.selectedId);
  const mirrorElectrode = useStore((s) => s.mirrorElectrode);
  const [showAdd, setShowAdd] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const sorted = useMemo(() => [...electrodes].sort((a, b) => a.order - b.order), [electrodes]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.entryName.toLowerCase().includes(q) ||
        e.targetName.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q)
    );
  }, [sorted, searchQuery]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sorted.map((e) => e.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const reordered = [...ids];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, String(active.id));
    reorderElectrodes(reordered);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong style={{ fontSize: 14 }}>Electrodes</strong>
          <span className="badge">{electrodes.length}</span>
        </div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, entry, target, notes"
          style={{
            padding: "8px 11px",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add Electrode
          </button>
          <button
            className="btn btn-sm"
            disabled={!selectedId}
            title="Mirror the selected electrode to the opposite hemisphere"
            onClick={() => {
              if (!selectedId) return;
              const result = mirrorElectrode(selectedId);
              if (!result.ok) window.alert(result.message);
            }}
          >
            Mirror to R/L
          </button>
        </div>
      </div>

      {electrodes.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: ROW_GRID_COLUMNS,
            gap: 6,
            padding: "0 8px 6px",
            margin: "0 16px",
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--faint)",
            borderBottom: "1px solid var(--line-strong)",
          }}
        >
          <span />
          <span>Name</span>
          <span>Entry</span>
          <span>Target</span>
          <span />
        </div>
      )}

      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 16px 16px" }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--muted)", padding: "20px 4px", textAlign: "center" }}>
            {electrodes.length === 0 ? "No electrodes yet. Add your first one above." : "No matches."}
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            {filtered.map((e) => (
              <ElectrodeRow key={e.id} electrode={e} />
            ))}
          </SortableContext>
        </DndContext>
        <SketchPanel />
      </div>

      {showAdd && <AddElectrodeDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}
