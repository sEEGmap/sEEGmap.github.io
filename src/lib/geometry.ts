import type { Point } from "../types";

/** Clamp a translation so every point in the set stays within the 0..1 image bounds,
 *  without distorting the shape (the whole set is shifted together, or not at all at the edge). */
export function clampTranslation(points: Point[], dx: number, dy: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const clampedDx = Math.min(1 - maxX, Math.max(-minX, dx));
  const clampedDy = Math.min(1 - maxY, Math.max(-minY, dy));
  return { x: clampedDx, y: clampedDy };
}

/** Simple average-of-vertices centroid -- good enough for label placement on freehand sketches. */
export function centroid(points: Point[]): Point {
  const n = points.length || 1;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}
