import { useCallback, useRef } from "react";
import { useStore } from "../store/useStore";
import type { Electrode, Point } from "../types";

const REF_W = 1770;
const REF_H = 1281;

type DragTarget =
  | { electrodeId: string; field: "entry" | "target" }
  | { electrodeId: string; field: "lateralStart" | "lateralEnd" | "medialStart" | "medialEnd" };

export default function BrainCanvas() {
  const electrodes = useStore((s) => s.electrodes);
  const selectedId = useStore((s) => s.selectedId);
  const hoveredId = useStore((s) => s.hoveredId);
  const setSelected = useStore((s) => s.setSelected);
  const setHovered = useStore((s) => s.setHovered);
  const updateElectrode = useStore((s) => s.updateElectrode);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragTarget | null>(null);

  const clientToNormalized = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const point = clientToNormalized(e.clientX, e.clientY);
      const target = dragRef.current;
      updateElectrode(target.electrodeId, { [target.field]: point } as unknown as Partial<Electrode>);
    },
    [clientToNormalized, updateElectrode]
  );

  const startDrag = (e: React.PointerEvent, target: DragTarget) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = target;
    setSelected(target.electrodeId);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 980,
        margin: "0 auto",
        aspectRatio: `${REF_W} / ${REF_H}`,
        position: "relative",
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${REF_W} ${REF_H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ display: "block", background: "#fff", borderRadius: 14, border: "1px solid var(--line)" }}
      >
        <image href="./brain-template.png" x={0} y={0} width={REF_W} height={REF_H} />

        {/* quadrant labels */}
        <QuadLabel x={REF_W * 0.02} y={REF_H * 0.045} text="Left Lateral" />
        <QuadLabel x={REF_W * 0.98} y={REF_H * 0.045} text="Right Lateral" anchorEnd />
        <QuadLabel x={REF_W * 0.02} y={REF_H * 0.535} text="Left Medial" />
        <QuadLabel x={REF_W * 0.98} y={REF_H * 0.535} text="Right Medial" anchorEnd />

        {electrodes.map((e) => (
          <ElectrodeMarks
            key={e.id}
            electrode={e}
            isSelected={e.id === selectedId}
            isHighlighted={e.id === hoveredId || e.id === selectedId}
            onSelect={() => setSelected(e.id)}
            onHover={(v) => setHovered(v ? e.id : null)}
            onStartDrag={startDrag}
          />
        ))}
      </svg>
    </div>
  );
}

function QuadLabel({ x, y, text, anchorEnd }: { x: number; y: number; text: string; anchorEnd?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={16}
      fontFamily="Inter, sans-serif"
      fontWeight={600}
      fill="var(--muted, #647480)"
      textAnchor={anchorEnd ? "end" : "start"}
      style={{ userSelect: "none" }}
    >
      {text}
    </text>
  );
}

function ElectrodeMarks({
  electrode,
  isSelected,
  isHighlighted,
  onSelect,
  onHover,
  onStartDrag,
}: {
  electrode: Electrode;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onHover: (v: boolean) => void;
  onStartDrag: (e: React.PointerEvent, target: DragTarget) => void;
}) {
  const opacity = isHighlighted ? 1 : 0.85;
  const strokeW = isSelected ? 3 : isHighlighted ? 2.2 : 1.5;

  if (electrode.type === "lateral-medial") {
    return (
      <g opacity={opacity} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onClick={onSelect}>
        <EntryDot
          point={electrode.entry}
          color={electrode.color}
          strokeW={strokeW}
          onPointerDown={(e) => onStartDrag(e, { electrodeId: electrode.id, field: "entry" })}
        />
        <TargetX
          point={electrode.target}
          color={electrode.color}
          strokeW={strokeW}
          onPointerDown={(e) => onStartDrag(e, { electrodeId: electrode.id, field: "target" })}
        />
      </g>
    );
  }

  return (
    <g opacity={opacity} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onClick={onSelect}>
      <TrajectoryLine a={electrode.lateralStart} b={electrode.lateralEnd} color={electrode.color} strokeW={strokeW} />
      <EntryDot
        point={electrode.lateralStart}
        color={electrode.color}
        strokeW={strokeW}
        onPointerDown={(e) => onStartDrag(e, { electrodeId: electrode.id, field: "lateralStart" })}
      />
      <EntryDot
        point={electrode.lateralEnd}
        color={electrode.color}
        strokeW={strokeW}
        onPointerDown={(e) => onStartDrag(e, { electrodeId: electrode.id, field: "lateralEnd" })}
      />
      <TrajectoryLine a={electrode.medialStart} b={electrode.medialEnd} color={electrode.color} strokeW={strokeW} />
      <TargetX
        point={electrode.medialStart}
        color={electrode.color}
        strokeW={strokeW}
        onPointerDown={(e) => onStartDrag(e, { electrodeId: electrode.id, field: "medialStart" })}
      />
      <TargetX
        point={electrode.medialEnd}
        color={electrode.color}
        strokeW={strokeW}
        onPointerDown={(e) => onStartDrag(e, { electrodeId: electrode.id, field: "medialEnd" })}
      />
    </g>
  );
}

function EntryDot({
  point,
  color,
  strokeW,
  onPointerDown,
}: {
  point: Point;
  color: string;
  strokeW: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <circle
      cx={point.x * REF_W}
      cy={point.y * REF_H}
      r={10}
      fill={color}
      stroke="#fff"
      strokeWidth={strokeW}
      onPointerDown={onPointerDown}
      style={{ cursor: "grab" }}
    />
  );
}

function TargetX({
  point,
  color,
  strokeW,
  onPointerDown,
}: {
  point: Point;
  color: string;
  strokeW: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cx = point.x * REF_W;
  const cy = point.y * REF_H;
  const r = 15;
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "grab" }}>
      <circle cx={cx} cy={cy} r={r + 4} fill="transparent" />
      <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} stroke={color} strokeWidth={strokeW + 3} strokeLinecap="round" />
      <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} stroke={color} strokeWidth={strokeW + 3} strokeLinecap="round" />
      <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
      <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

function TrajectoryLine({ a, b, color, strokeW }: { a: Point; b: Point; color: string; strokeW: number }) {
  return (
    <line
      x1={a.x * REF_W}
      y1={a.y * REF_H}
      x2={b.x * REF_W}
      y2={b.y * REF_H}
      stroke={color}
      strokeWidth={strokeW}
      strokeDasharray="6 4"
    />
  );
}

export { REF_W, REF_H };
