// Brain figure registry.
//
// sEEGmap ships two figures. Each one has its own image, its own quadrant config, its own
// anatomical library (CSV) and its own superior-inferior config (JSON). All library
// coordinates are in the *native pixel* space of that figure's image.

import type { FigureId } from "../types";
import { REF_W } from "./constants";

export interface FigureConfig {
  id: FigureId;
  /** Full name shown in the UI. */
  label: string;
  /** Short name for compact toggles. */
  shortLabel: string;
  /** One-line description shown next to the picker. */
  description: string;
  /** Image file, relative to public/. */
  imageFile: string;
  /** Native pixel size of the image -- the space library coordinates are written in. */
  width: number;
  height: number;
  /** Quadrant bounding boxes used for first-pass auto-placement (public/). */
  regionsFile: string;
  /** Seed anatomical library (public/). */
  libraryFile: string;
  /** Named superior-inferior anchors (public/). */
  siRegionsFile: string;
}

export const FIGURES: Record<FigureId, FigureConfig> = {
  legacy: {
    id: "legacy",
    label: "Legacy figure",
    shortLabel: "Legacy",
    description: "The original line-art template.",
    imageFile: "brain-template.png",
    width: 1770,
    height: 1281,
    regionsFile: "brain-regions.json",
    libraryFile: "anatomy-library.csv",
    siRegionsFile: "superior-inferior-regions.json",
  },
  v2: {
    id: "v2",
    label: "New figure",
    shortLabel: "New",
    description: "The newer, more detailed sulcal template.",
    imageFile: "brain-template-v2.png",
    width: 3147,
    height: 1903,
    regionsFile: "brain-regions-v2.json",
    libraryFile: "anatomy-library-v2.csv",
    siRegionsFile: "superior-inferior-regions-v2.json",
  },
};

/** Order figures are listed in pickers. */
export const FIGURE_ORDER: FigureId[] = ["v2", "legacy"];

/** Figure used when nothing else says otherwise (fresh browser, no saved preference). */
export const DEFAULT_FIGURE: FigureId = "v2";

export function isFigureId(v: unknown): v is FigureId {
  return v === "legacy" || v === "v2";
}

/** Height of the canvas coordinate space for a figure (its width is always REF_W). */
export function canvasHeight(id: FigureId): number {
  const f = FIGURES[id];
  return (REF_W * f.height) / f.width;
}

/** Native image pixels per canvas unit. Use it to size markers drawn in native-pixel SVGs. */
export function figureUnit(id: FigureId): number {
  return FIGURES[id].width / REF_W;
}

/** URL of a figure's image, resolved against the app's base path. */
export function figureImageUrl(id: FigureId): string {
  const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
  return `${base}${FIGURES[id].imageFile}`;
}

const PREF_KEY = "seegmap-figure";

/** The figure the user last chose (used for new plans). Best-effort; falls back to the default. */
export function loadFigurePref(): FigureId {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (isFigureId(raw)) return raw;
  } catch {
    // localStorage can be unavailable (private mode, blocked storage) -- ignore.
  }
  return DEFAULT_FIGURE;
}

export function saveFigurePref(id: FigureId): void {
  try {
    window.localStorage.setItem(PREF_KEY, id);
  } catch {
    // Best-effort only.
  }
}
