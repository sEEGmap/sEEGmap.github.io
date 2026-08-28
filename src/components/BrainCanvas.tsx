import { useCallback, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import type { Electrode, FreehandSketch, Point } from "../types";
import { REF_H, REF_W } from "../lib/constants";
import { darkenHex } from "../lib/color";
import { centroid, clampTranslation } from "../lib/geometry";

type DragTarget =
  | { kind: "electrode"; electrodeId: string; field: "entry" | "target" }
  | { kind: "electrode"; electrodeId: string; field: "lateralStart" | "lateralEnd" };

type SketchDrag = { sketchId: string; startX: number; startY: number; originalPoints: Point[] };

const MIN_POINT_SPACING = 5; // svg units, thins freehand path points

export default function BrainCanvas() {
  const electrodes = useStore((s) => s.electrodes);
  const sketches = useStore((s) => s.sketches);
  const selectedId = useStore((s) => s.selectedId);
  const hoveredId = useStore((s) => s.hoveredId);
  const setSelected = useStore((s) => s.setSelected);
  const setHovered = useStore((s) => s.setHovered);
  const updateElectrode = useStore((s) => s.updateElectrode);
  const beginHistoryBatch = useStore((s) => s.beginHistoryBatch);
  const endHistoryBatch = useStore((s) => s.endHistoryBatch);
  const showNames = useStore((s) => s.showNames);
  const drawMode = useStore((s) => s.drawMode);
  const addSketch = useStore((s) => s.addSketch);
  const selectedSketchId = useStore((s) => s.selectedSketchId);
  const setSelectedSketchId = useStore((s) => s.setSelectedSketchId);
  const updateSketch = useStore((s) => s.updateSketch);
  const sketchDraftColor = useStore((s) => s.sketchDraftColor);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragTarget | null>(null);
  const [currentPath, setCurrentPath] = useState<Point[] | null>(null);
  const drawingRef = useRef(false);
  const movedRef = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);
  const sketchDragRef = useRef<SketchDrag | null>(null);
  const sketchMovedRef = useRef(false);
  const prevSelectedSketchRef = useRef<string | null>(null);

  const clientToNormalized = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  const onMarkerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      movedRef.current = true;
      const point = clientToNormalized(e.clientX, e.clientY);
      const target = dragRef.current;
      updateElectrode(target.electrodeId, { [target.field]: point } as unknown as Partial<Electrode>);
    },
    [clientToNormalized, updateElectrode]
  );

  const startDrag = (e: React.PointerEvent, target: DragTarget) => {
    if (drawMode) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    movedRef.current = false;
    prevSelectedRef.current = selectedId;
    dragRef.current = target;
    beginHistoryBatch();
    setSelected(target.electrodeId);
  };

  const handleElectrodeClick = (electrodeId: string) => {
    // A plain click (no drag movement) on an already-selected electrode toggles it off.
    if (!movedRef.current && prevSelectedRef.current === electrodeId) {
      setSelected(null);
    }
    movedRef.current = false;
  };

  const startSketchDrag = (e: React.PointerEvent, sketch: FreehandSketch) => {
    if (drawMode) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const point = clientToNormalized(e.clientX, e.clientY);
    sketchMovedRef.current = false;
    prevSelectedSketchRef.current = selectedSketchId;
    sketchDragRef.current = {
      sketchId: sketch.id,
      startX: point.x,
      startY: point.y,
      originalPoints: sketch.points,
    };
    beginHistoryBatch();
    setSelectedSketchId(sketch.id);
  };

  const onSketchPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = sketchDragRef.current;
      if (!drag) return;
      const point = clientToNormalized(e.clientX, e.clientY);
      const rawDx = point.x - drag.startX;
      const rawDy = point.y - drag.startY;
      if (Math.abs(rawDx) > 0.001 || Math.abs(rawDy) > 0.001) sketchMovedRef.current = true;
      const { x: dx, y: dy } = clampTranslation(drag.originalPoints, rawDx, rawDy);
      const newPoints = drag.originalPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      updateSketch(drag.sketchId, { points: newPoints });
    },
    [clientToNormalized, updateSketch]
  );

  const handleSketchClick = (sketchId: string) => {
    if (drawMode) return;
    if (!sketchMovedRef.current && prevSelectedSketchRef.current === sketchId) {
      setSelectedSketchId(null);
    }
    sketchMovedRef.current = false;
  };

  const endDrag = () => {
    if (dragRef.current || sketchDragRef.current) endHistoryBatch();
    dragRef.current = null;
  };

  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (!drawMode) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const point = clientToNormalized(e.clientX, e.clientY);
    drawingRef.current = true;
    setCurrentPath([point]);
    setSelectedSketchId(null);
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) return onMarkerPointerMove(e);
    if (sketchDragRef.current) return onSketchPointerMove(e);
    if (!drawMode || !drawingRef.current) return;
    const point = clientToNormalized(e.clientX, e.clientY);
    setCurrentPath((prev) => {
      if (!prev) return [point];
      const last = prev[prev.length - 1];
      const dx = (last.x - point.x) * REF_W;
      const dy = (last.y - point.y) * REF_H;
      if (Math.sqrt(dx * dx + dy * dy) < MIN_POINT_SPACING) return prev;
      return [...prev, point];
    });
  };

  const onSvgPointerUp = () => {
    endDrag();
    sketchDragRef.current = null;
    if (drawMode && drawingRef.current) {
      drawingRef.current = false;
      setCurrentPath((prev) => {
        if (prev && prev.length >= 3) addSketch(prev);
        return null;
      });
    }
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
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerLeave={onSvgPointerUp}
        style={{
          display: "block",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid var(--line)",
          cursor: drawMode ? "crosshair" : "default",
        }}
      >
        <image href="./brain-template.png" x={0} y={0} width={REF_W} height={REF_H} />

        {/* quadrant labels */}
        <QuadLabel x={REF_W * 0.02} y={REF_H * 0.045} text="Left Lateral" />
        <QuadLabel x={REF_W * 0.98} y={REF_H * 0.045} text="Right Lateral" anchorEnd />
        <QuadLabel x={REF_W * 0.02} y={REF_H * 0.535} text="Left Medial" />
        <QuadLabel x={REF_W * 0.98} y={REF_H * 0.535} text="Right Medial" anchorEnd />

        {/* freehand sketches (semi-transparent regions), drawn above the template, below markers */}
        <g style={{ pointerEvents: drawMode ? "none" : "auto" }}>
          {sketches.map((sk) => (
            <SketchShape
              key={sk.id}
              sketch={sk}
              isSelected={sk.id === selectedSketchId}
              onPointerDown={(e) => startSketchDrag(e, sk)}
              onClick={() => handleSketchClick(sk.id)}
            />
          ))}
        </g>
        {currentPath && currentPath.length > 1 && (
          <polyline
            points={currentPath.map((p) => `${p.x * REF_W},${p.y * REF_H}`).join(" ")}
            fill="none"
            stroke={sketchDraftColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        <g style={{ pointerEvents: drawMode ? "none" : "auto" }}>
          {electrodes.map((e) => (
            <ElectrodeMarks
              key={e.id}
              electrode={e}
              isSelected={e.id === selectedId}
              isHighlighted={e.id === hoveredId || e.id === selectedId}
              showNames={showNames}
              onSelect={() => handleElectrodeClick(e.id)}
              onHover={(v) => setHovered(v ? e.id : null)}
              onStartDrag={startDrag}
            />
          ))}
        </g>
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

function SketchShape({
  sketch,
  isSelected,
  onPointerDown,
  onClick,
}: {
  sketch: FreehandSketch;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: () => void;
}) {
  const pts = sketch.points.map((p) => `${p.x * REF_W},${p.y * REF_H}`).join(" ");
  const c = centroid(sketch.points);
  return (
    <g onPointerDown={onPointerDown} onClick={onClick} style={{ cursor: "grab" }}>
      <polygon
        points={pts}
        fill={sketch.color}
        fillOpacity={sketch.opacity}
        stroke={isSelected ? darkenHex(sketch.color, 0.25) : sketch.color}
        strokeWidth={isSelected ? 3 : 1.5}
        strokeOpacity={0.9}
      />
      <text
        x={c.x * REF_W}
        y={c.y * REF_H}
        fontSize={15}
        fontFamily="IBM Plex Mono, ui-monospace, monospace"
        fontWeight={600}
        fill={darkenHex(sketch.color, 0.35)}
        stroke="#ffffff"
        strokeWidth={3.5}
        paintOrder="stroke"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {sketch.label}
      </text>
    </g>
  );
}

function ElectrodeMarks({
  electrode,
  isSelected,
  isHighlighted,
  showNames,
  onSelect,
  onHover,
  onStartDrag,
}: {
  electrode: Electrode;
  isSelected: boolean;
  isHighlighted: boolean;
  showNames: boolean;
  onSelect: () => void;
  onHover: (v: boolean) => void;
  onStartDrag: (e: React.PointerEvent, target: DragTarget) => void;
}) {
  const opacity = isHighlighted ? 1 : 0.85;
  const strokeW = isSelected ? 3 : isHighlighted ? 2.2 : 1.5;
  const color = isHighlighted ? darkenHex(electrode.color, 0.22) : electrode.color;
  const dotR = isHighlighted ? 13 : 10;
  const xR = isHighlighted ? 13 : 10; // Adjust these values to change the planner X-marker size.

  if (electrode.type === "lateral-medial") {
    return (
      <g opacity={opacity} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onClick={onSelect}>
        <EntryDot
          point={electrode.entry}
          color={color}
          strokeW={strokeW}
          r={dotR}
          onPointerDown={(e) => onStartDrag(e, { kind: "electrode", electrodeId: electrode.id, field: "entry" })}
        />
        <TargetX
          point={electrode.target}
          color={color}
          strokeW={strokeW}
          r={xR}
          onPointerDown={(e) => onStartDrag(e, { kind: "electrode", electrodeId: electrode.id, field: "target" })}
        />
        {showNames && (
          <>
            <NameLabel point={electrode.entry} text={electrode.name} color={color} dy={dotR + 16} />
            <NameLabel point={electrode.target} text={electrode.name} color={color} dy={xR + 16} />
          </>
        )}
      </g>
    );
  }

  return (
    <g opacity={opacity} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onClick={onSelect}>
      <TrajectoryLine a={electrode.lateralStart} b={electrode.lateralEnd} color={color} strokeW={strokeW} />
      <EntryDot
        point={electrode.lateralStart}
        color={color}
        strokeW={strokeW}
        r={dotR}
        onPointerDown={(e) => onStartDrag(e, { kind: "electrode", electrodeId: electrode.id, field: "lateralStart" })}
      />
      <TargetX
        point={electrode.lateralEnd}
        color={color}
        strokeW={strokeW}
        r={xR}
        onPointerDown={(e) => onStartDrag(e, { kind: "electrode", electrodeId: electrode.id, field: "lateralEnd" })}
      />
      {showNames && (
        <NameLabel point={electrode.lateralStart} text={electrode.name} color={color} dy={-(dotR + 10)} />
      )}
    </g>
  );
}

function NameLabel({ point, text, color, dy }: { point: Point; text: string; color: string; dy: number }) {
  return (
    <text
      x={point.x * REF_W}
      y={point.y * REF_H + dy}
      fontSize={15}
      fontFamily="IBM Plex Mono, ui-monospace, monospace"
      fontWeight={600}
      fill={color}
      stroke="#ffffff"
      strokeWidth={3.5}
      paintOrder="stroke"
      textAnchor="middle"
      style={{ userSelect: "none", pointerEvents: "none" }}
    >
      {text}
    </text>
  );
}

function EntryDot({
  point,
  color,
  strokeW,
  r,
  onPointerDown,
}: {
  point: Point;
  color: string;
  strokeW: number;
  r: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <circle
      cx={point.x * REF_W}
      cy={point.y * REF_H}
      r={r}
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
  r,
  onPointerDown,
}: {
  point: Point;
  color: string;
  strokeW: number;
  r: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cx = point.x * REF_W;
  const cy = point.y * REF_H;
  const armWidth = strokeW + 4.5; // bold, short arms
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: "grab" }}>
      <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
      <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} stroke={color} strokeWidth={armWidth} strokeLinecap="round" />
      <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} stroke={color} strokeWidth={armWidth} strokeLinecap="round" />
      <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
      <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
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
