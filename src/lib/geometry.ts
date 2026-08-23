import type { Point } from "../types";

/** Simple average-of-vertices centroid -- good enough for label placement on freehand sketches. */
export function centroid(points: Point[]): Point {
  const n = points.length || 1;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}
