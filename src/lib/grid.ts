// Geometry helpers for grid / strip electrodes.
//
// A grid is a rotatable rectangle. Its center is stored in normalized (0..1) template
// coordinates, but width/height are stored in *isotropic* units -- fractions of REF_W for
// both axes -- so rotation never distorts the array and a square grid stays square on the
// non-square template image.
//
// Everything here works in canvas space (0..REF_W, 0..refH), which is exactly the SVG
// viewBox used by BrainCanvas, so results can be drawn directly. REF_W is the same for every
// figure but the canvas height (`refH`) follows the active figure's aspect ratio, so any
// function that converts between normalized and pixel coordinates takes it explicitly --
// get it from canvasHeight(figure) (lib/figures) or the useCanvasHeight() hook.

import type { GridElectrode, Point } from "../types";
import { REF_W } from "./constants";

/** Default center-to-center contact spacing, in REF pixels, for a newly created array. */
export const DEFAULT_CONTACT_SPACING_PX = 42;

/** Smallest allowed array side, in REF pixels -- keeps a drag-to-resize from collapsing it. */
export const MIN_SIDE_PX = 18;

export interface PixelPoint {
  x: number;
  y: number;
}

export interface GridContact {
  /** 1-based contact number, row-major from the array's local top-left. */
  number: number;
  row: number;
  col: number;
  /** Center in REF pixel space. */
  x: number;
  y: number;
}

export function toPixels(p: Point, refH: number): PixelPoint {
  return { x: p.x * REF_W, y: p.y * refH };
}

export function toNormalized(p: PixelPoint, refH: number): Point {
  return { x: p.x / REF_W, y: p.y / refH };
}

/** Array size in REF pixels. */
export function gridSizePx(grid: GridElectrode): { w: number; h: number } {
  return { w: grid.width * REF_W, h: grid.height * REF_W };
}

/** Rotate a vector (in pixels) by `degrees` clockwise. */
export function rotateVec(vx: number, vy: number, degrees: number): PixelPoint {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: vx * cos - vy * sin, y: vx * sin + vy * cos };
}

/** Map a point from the array's local frame (origin at center, pixels) into REF pixel space. */
export function localToPixels(grid: GridElectrode, lx: number, ly: number, refH: number): PixelPoint {
  const c = toPixels(grid.center, refH);
  const r = rotateVec(lx, ly, grid.rotation);
  return { x: c.x + r.x, y: c.y + r.y };
}

/** Map a REF-pixel point into the array's local frame (origin at center, pixels). */
export function pixelsToLocal(grid: GridElectrode, p: PixelPoint, refH: number): PixelPoint {
  const c = toPixels(grid.center, refH);
  return rotateVec(p.x - c.x, p.y - c.y, -grid.rotation);
}

/** Corners in REF pixel space, ordered TL, TR, BR, BL in the array's local frame. */
export function gridCorners(grid: GridElectrode, refH: number): PixelPoint[] {
  const { w, h } = gridSizePx(grid);
  const hw = w / 2;
  const hh = h / 2;
  return [
    localToPixels(grid, -hw, -hh, refH),
    localToPixels(grid, hw, -hh, refH),
    localToPixels(grid, hw, hh, refH),
    localToPixels(grid, -hw, hh, refH),
  ];
}

/** Local-frame sign of each corner, matching gridCorners() order. */
export const CORNER_SIGNS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** Contact centers in REF pixel space, numbered row-major from the local top-left. */
export function gridContacts(grid: GridElectrode, refH: number): GridContact[] {
  const { w, h } = gridSizePx(grid);
  const rows = Math.max(1, Math.round(grid.rows));
  const cols = Math.max(1, Math.round(grid.cols));
  const cellW = w / cols;
  const cellH = h / rows;
  const out: GridContact[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lx = -w / 2 + (col + 0.5) * cellW;
      const ly = -h / 2 + (row + 0.5) * cellH;
      const p = localToPixels(grid, lx, ly, refH);
      out.push({ number: row * cols + col + 1, row, col, x: p.x, y: p.y });
    }
  }
  return out;
}

/** Contact radius in REF pixels -- scales with cell size so dense arrays stay readable. */
export function contactRadiusPx(grid: GridElectrode): number {
  const { w, h } = gridSizePx(grid);
  const rows = Math.max(1, Math.round(grid.rows));
  const cols = Math.max(1, Math.round(grid.cols));
  const cell = Math.min(w / cols, h / rows);
  return Math.max(2.5, Math.min(cell * 0.34, 22));
}

/** Rotation handle position, in REF pixels: centered above the local top edge. */
export function rotationHandlePx(grid: GridElectrode, refH: number): PixelPoint {
  const { h } = gridSizePx(grid);
  return localToPixels(grid, 0, -h / 2 - 46, refH);
}

/**
 * Resize by dragging one corner: the diagonally opposite corner stays pinned while the
 * dragged corner follows the pointer, measured in the array's rotated frame.
 */
export function resizeFromCorner(
  grid: GridElectrode,
  cornerIndex: number,
  pointerPx: PixelPoint,
  refH: number,
  keepAspect = false
): { center: Point; width: number; height: number } {
  const { w, h } = gridSizePx(grid);
  const [sx, sy] = CORNER_SIGNS[cornerIndex] ?? CORNER_SIGNS[0];

  // Pinned corner (the opposite one), in REF pixels.
  const anchor = localToPixels(grid, (-sx * w) / 2, (-sy * h) / 2, refH);

  // Pointer relative to the anchor, expressed in the array's unrotated frame.
  const d = rotateVec(pointerPx.x - anchor.x, pointerPx.y - anchor.y, -grid.rotation);
  let newW = Math.max(MIN_SIDE_PX, Math.abs(d.x));
  let newH = Math.max(MIN_SIDE_PX, Math.abs(d.y));

  if (keepAspect && w > 0 && h > 0) {
    const scale = Math.max(newW / w, newH / h);
    newW = Math.max(MIN_SIDE_PX, w * scale);
    newH = Math.max(MIN_SIDE_PX, h * scale);
  }

  // The new center keeps the anchor corner exactly where it was.
  const rot = rotateVec((sx * newW) / 2, (sy * newH) / 2, grid.rotation);
  const centerPx = { x: anchor.x + rot.x, y: anchor.y + rot.y };

  return {
    center: clampNormalized(toNormalized(centerPx, refH)),
    width: newW / REF_W,
    height: newH / REF_W,
  };
}

/** Rotation (degrees) that points the array's local "up" axis at the pointer. */
export function rotationFromPointer(grid: GridElectrode, pointerPx: PixelPoint, refH: number, snap = false): number {
  const c = toPixels(grid.center, refH);
  const deg = (Math.atan2(pointerPx.y - c.y, pointerPx.x - c.x) * 180) / Math.PI + 90;
  const normalized = ((deg % 360) + 360) % 360;
  return snap ? Math.round(normalized / 15) * 15 : Math.round(normalized * 10) / 10;
}

export function clampNormalized(p: Point): Point {
  return { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
}

/** Default array size for a freshly created rows x cols array. */
export function defaultGridSize(rows: number, cols: number): { width: number; height: number } {
  return {
    width: (Math.max(1, cols) * DEFAULT_CONTACT_SPACING_PX) / REF_W,
    height: (Math.max(1, rows) * DEFAULT_CONTACT_SPACING_PX) / REF_W,
  };
}

/** SVG polygon "points" attribute for the array outline. */
export function cornersToPolygon(corners: PixelPoint[]): string {
  return corners.map((p) => `${p.x},${p.y}`).join(" ");
}
