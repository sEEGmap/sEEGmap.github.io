import type { BrainRegionsConfig, Point, QuadrantConfig } from "../types";

/** Convert a reference-pixel coordinate (in the space described by regions.referenceWidth/Height)
 *  into a normalized 0..1 coordinate relative to the full brain-template image. */
export function pixelToNormalized(
  px: number,
  py: number,
  regions: BrainRegionsConfig
): Point {
  return {
    x: px / regions.referenceWidth,
    y: py / regions.referenceHeight,
  };
}

export function normalizedToRendered(
  point: Point,
  renderedWidth: number,
  renderedHeight: number
): { x: number; y: number } {
  return { x: point.x * renderedWidth, y: point.y * renderedHeight };
}

export function renderedToNormalized(
  px: number,
  py: number,
  renderedWidth: number,
  renderedHeight: number
): Point {
  return {
    x: clamp01(px / renderedWidth),
    y: clamp01(py / renderedHeight),
  };
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export type QuadrantKey = "leftLateral" | "rightLateral" | "leftMedial" | "rightMedial";

/** Approximate placement inside a quadrant's bbox using a generic
 *  Anterior/Middle/Posterior (columns) x Superior/Middle/Inferior (rows) grid.
 *  This is a fast first-pass estimate only -- always verify against real anatomy. */
export function gridPositionInQuadrant(
  quadrant: QuadrantConfig,
  col: 0 | 1 | 2, // 0=Anterior,1=Middle,2=Posterior (as drawn, before anteriorAtStart flip)
  row: 0 | 1 | 2, // 0=Superior,1=Middle,2=Inferior
  regions: BrainRegionsConfig
): Point {
  const [x0, y0, x1, y1] = quadrant.bbox;
  // fraction across the bbox for this column, centered within its third
  let colFrac = (col + 0.5) / 3;
  if (!quadrant.anteriorAtStart) colFrac = 1 - colFrac;
  const rowFrac = (row + 0.5) / 3;
  const px = x0 + colFrac * (x1 - x0);
  const py = y0 + rowFrac * (y1 - y0);
  return pixelToNormalized(px, py, regions);
}

export function quadrantForSide(
  side: "L" | "R",
  view: "lateral" | "medial"
): QuadrantKey {
  if (side === "L") return view === "lateral" ? "leftLateral" : "leftMedial";
  return view === "lateral" ? "rightLateral" : "rightMedial";
}
