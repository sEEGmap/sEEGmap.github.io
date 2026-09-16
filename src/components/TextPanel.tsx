import { useStore } from "../store/useStore";

/**
 * Side-panel list of free-standing text labels, mirroring SketchPanel: select one to
 * highlight it on the canvas, edit its content inline, and tune color / size / weight.
 */
export default function TextPanel() {
  const texts = useStore((s) => s.texts);
  const selectedTextId = useStore((s) => s.selectedTextId);
  const setSelectedTextId = useStore((s) => s.setSelectedTextId);
  const updateText = useStore((s) => s.updateText);
  const duplicateText = useStore((s) => s.duplicateText);
  const removeText = useStore((s) => s.removeText);
  const textMode = useStore((s) => s.textMode);

  if (texts.length === 0 && !textMode) return null;

  return (
    <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Text Labels</strong>
        <span className="badge">{texts.length}</span>
      </div>
      {texts.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Click the canvas to place a label. Drag it to reposition, or double-click it to edit.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {texts.map((t) => {
          const isActive = t.id === selectedTextId;
          return (
            <div
              key={t.id}
              className="card"
              onClick={() => setSelectedTextId(isActive ? null : t.id)}
              style={{
                padding: "8px 10px",
                cursor: "pointer",
                borderLeft: `${isActive ? 6 : 3}px solid ${t.color}`,
                background: isActive ? "var(--accent-soft)" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  value={t.content}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateText(t.id, { content: e.target.value })}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: "1px solid transparent",
                    borderRadius: 6,
                    padding: "3px 5px",
                    background: "transparent",
                  }}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateText(t.id);
                  }}
                  title="Duplicate this label"
                >
                  Duplicate
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeText(t.id);
                  }}
                >
                  Delete
                </button>
              </div>
              {isActive && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="color"
                    value={t.color}
                    onChange={(e) => updateText(t.id, { color: e.target.value })}
                    style={{ width: 30, height: 26, padding: 2, cursor: "pointer" }}
                    title="Text color"
                  />
                  <label
                    style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flex: 1 }}
                  >
                    Size
                    <input
                      type="range"
                      min={12}
                      max={72}
                      step={1}
                      value={t.fontSize}
                      onChange={(e) => updateText(t.id, { fontSize: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                  </label>
                  <button
                    className="btn btn-sm"
                    onClick={() => updateText(t.id, { bold: !t.bold })}
                    title="Toggle bold"
                    style={{
                      fontWeight: 800,
                      padding: "2px 8px",
                      color: t.bold ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    B
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
