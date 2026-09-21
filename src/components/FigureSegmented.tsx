import { FIGURES, FIGURE_ORDER } from "../lib/figures";
import type { FigureId } from "../types";

/** Small segmented control for choosing a brain figure. */
export default function FigureSegmented({
  value,
  onChange,
  full = false,
}: {
  value: FigureId;
  onChange: (id: FigureId) => void;
  /** Show the full figure name ("New figure") instead of the short one ("New"). */
  full?: boolean;
}) {
  return (
    <div style={{ display: "flex" }} role="group" aria-label="Brain figure">
      {FIGURE_ORDER.map((id, i) => {
        const active = id === value;
        const first = i === 0;
        const last = i === FIGURE_ORDER.length - 1;
        const left = first ? 8 : 0;
        const right = last ? 8 : 0;
        return (
          <button
            key={id}
            className="btn btn-sm"
            onClick={() => onChange(id)}
            aria-pressed={active}
            title={`${FIGURES[id].label} -- ${FIGURES[id].description}`}
            style={{
              borderRadius: `${left}px ${right}px ${right}px ${left}px`,
              marginLeft: first ? 0 : -1,
              background: active ? "var(--accent)" : "var(--surface)",
              borderColor: active ? "var(--accent)" : "var(--line-strong)",
              color: active ? "var(--accent-ink)" : "var(--ink)",
              position: "relative",
              zIndex: active ? 1 : 0,
            }}
          >
            {full ? FIGURES[id].label : FIGURES[id].shortLabel}
          </button>
        );
      })}
    </div>
  );
}
