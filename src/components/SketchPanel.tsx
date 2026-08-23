import { useStore } from "../store/useStore";

export default function SketchPanel() {
  const sketches = useStore((s) => s.sketches);
  const selectedSketchId = useStore((s) => s.selectedSketchId);
  const setSelectedSketchId = useStore((s) => s.setSelectedSketchId);
  const updateSketch = useStore((s) => s.updateSketch);
  const removeSketch = useStore((s) => s.removeSketch);
  const drawMode = useStore((s) => s.drawMode);

  if (sketches.length === 0 && !drawMode) return null;

  return (
    <div style={{ marginTop: 4, paddingTop: 12, borderTop: sketches.length || drawMode ? "1px solid var(--line)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Sketched Areas</strong>
        <span className="badge">{sketches.length}</span>
      </div>
      {sketches.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Draw on the canvas to mark a lesion or region of interest.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sketches.map((sk) => {
          const isActive = sk.id === selectedSketchId;
          return (
            <div
              key={sk.id}
              className="card"
              onClick={() => setSelectedSketchId(sk.id)}
              style={{
                padding: "8px 10px",
                cursor: "pointer",
                borderLeft: `${isActive ? 6 : 3}px solid ${sk.color}`,
                background: isActive ? "var(--accent-soft)" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  value={sk.label}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateSketch(sk.id, { label: e.target.value })}
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: "1px solid transparent",
                    borderRadius: 6,
                    padding: "3px 5px",
                    background: "transparent",
                  }}
                />
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSketch(sk.id);
                  }}
                >
                  Delete
                </button>
              </div>
              {isActive && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="color"
                    value={sk.color}
                    onChange={(e) => updateSketch(sk.id, { color: e.target.value })}
                    style={{ width: 30, height: 26, padding: 2, cursor: "pointer" }}
                  />
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    Opacity
                    <input
                      type="range"
                      min={0.1}
                      max={0.8}
                      step={0.05}
                      value={sk.opacity}
                      onChange={(e) => updateSketch(sk.id, { opacity: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
