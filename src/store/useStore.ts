import { create } from "zustand";
import { v4 as uuid } from "uuid";
import Papa from "papaparse";
import { db } from "../db/db";
import type {
  AnatomyRecord,
  BrainRegionsConfig,
  Electrode,
  FreehandSketch,
  LateralMedialElectrode,
  Point,
  SIRegionsConfig,
  SeegPlanFile,
  SuperiorInferiorElectrode,
} from "../types";
import { CURRENT_FORMAT_VERSION } from "../types";
import {
  buildLateralMedialName,
  isNameTaken,
  parseLateralMedialName,
} from "../lib/nomenclature";
import { gridPositionInQuadrant, pixelToNormalized } from "../lib/coords";
import { clampTranslation } from "../lib/geometry";

const PALETTE = [
  "#2F6F6B", "#C0392B", "#8E5AC8", "#D68910", "#2E6DA4",
  "#16A085", "#A93472", "#5D6D7E", "#B7950B", "#1F618D",
];

function nextColor(existing: Electrode[]): string {
  return PALETTE[existing.length % PALETTE.length];
}

function nowISO() {
  return new Date().toISOString();
}

interface PlanSnapshot {
  electrodes: Electrode[];
  sketches: FreehandSketch[];
}

function cloneSnapshot(s: Pick<StoreState, "electrodes" | "sketches">): PlanSnapshot {
  return {
    electrodes: JSON.parse(JSON.stringify(s.electrodes)) as Electrode[],
    sketches: JSON.parse(JSON.stringify(s.sketches)) as FreehandSketch[],
  };
}

function snapshotsEqual(a: PlanSnapshot, b: PlanSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface HistoryBatch {
  before: PlanSnapshot;
}

interface StoreState {
  // config
  regions: BrainRegionsConfig | null;
  siRegions: SIRegionsConfig | null;
  anatomy: AnatomyRecord[];

  // plan
  electrodes: Electrode[];
  sketches: FreehandSketch[];
  patientLabel: string;
  planNotes: string;
  selectedId: string | null;
  hoveredId: string | null;
  searchQuery: string;
  hydrated: boolean;

  // undo / redo
  undoStack: PlanSnapshot[];
  redoStack: PlanSnapshot[];
  beginHistoryBatch: () => void;
  endHistoryBatch: () => void;
  undo: () => void;
  redo: () => void;
  nudgeSelection: (dx: number, dy: number) => void;

  // canvas ui state
  showNames: boolean;
  toggleShowNames: () => void;
  drawMode: boolean;
  setDrawMode: (v: boolean) => void;
  sketchDraftColor: string;
  sketchDraftOpacity: number;
  setSketchDraft: (patch: { color?: string; opacity?: number }) => void;
  selectedSketchId: string | null;
  setSelectedSketchId: (id: string | null) => void;

  // actions: bootstrap
  loadConfigs: () => Promise<void>;
  hydrateFromDB: () => Promise<void>;

  // actions: electrodes
  addLateralMedial: (partial?: Partial<LateralMedialElectrode>) => LateralMedialElectrode;
  addSuperiorInferior: (partial?: Partial<SuperiorInferiorElectrode>) => SuperiorInferiorElectrode;
  addByName: (name: string) => { ok: boolean; message: string };
  mirrorElectrode: (id: string) => { ok: boolean; message: string };
  addByAnatomy: (record: AnatomyRecord) => void;
  updateElectrode: (id: string, patch: Partial<Electrode>) => void;
  renameElectrode: (id: string, name: string) => { ok: boolean; message: string };
  removeElectrode: (id: string) => void;
  reorderElectrodes: (orderedIds: string[]) => void;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setSearchQuery: (q: string) => void;

  // actions: sketches
  addSketch: (points: Point[]) => void;
  duplicateSketch: (id: string) => void;
  updateSketch: (id: string, patch: Partial<FreehandSketch>) => void;
  removeSketch: (id: string) => void;

  // actions: anatomy library
  addAnatomyRecord: (rec: Omit<AnatomyRecord, "id">) => void;
  updateAnatomyRecord: (id: string, patch: Partial<AnatomyRecord>) => void;
  removeAnatomyRecord: (id: string) => void;
  replaceAnatomyLibrary: (records: Omit<AnatomyRecord, "id">[]) => void;

  // actions: session / files
  newPlan: () => Promise<void>;
  loadPlanFile: (file: SeegPlanFile) => void;
  exportPlanFile: () => SeegPlanFile;
  setPatientLabel: (v: string) => void;
  setPlanNotes: (v: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let historyBatch: HistoryBatch | null = null;

function pushHistory(set: any, get: () => StoreState, before: PlanSnapshot) {
  const current = cloneSnapshot(get());
  if (snapshotsEqual(before, current)) return;
  set((s: StoreState) => ({ undoStack: [...s.undoStack, before].slice(-100), redoStack: [] }));
}

function scheduleAutosave(get: () => StoreState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const s = get();
    await db.transaction("rw", db.electrodes, db.session, db.sketches, async () => {
      await db.electrodes.clear();
      await db.electrodes.bulkAdd(s.electrodes);
      await db.sketches.clear();
      await db.sketches.bulkAdd(s.sketches);
      await db.session.put({
        key: "current",
        patientLabel: s.patientLabel,
        planNotes: s.planNotes,
        updatedAt: nowISO(),
      });
    });
  }, 350);
}

export const useStore = create<StoreState>((set, get) => ({
  regions: null,
  siRegions: null,
  anatomy: [],
  electrodes: [],
  sketches: [],
  patientLabel: "",
  planNotes: "",
  selectedId: null,
  hoveredId: null,
  searchQuery: "",
  hydrated: false,

  undoStack: [],
  redoStack: [],

  showNames: true,
  toggleShowNames: () => set((s) => ({ showNames: !s.showNames })),
  drawMode: false,
  setDrawMode: (v) => set({ drawMode: v, selectedId: v ? null : get().selectedId, selectedSketchId: v ? null : get().selectedSketchId }),
  sketchDraftColor: "#D68910",
  sketchDraftOpacity: 0.35,
  setSketchDraft: (patch) =>
    set((s) => ({
      sketchDraftColor: patch.color ?? s.sketchDraftColor,
      sketchDraftOpacity: patch.opacity ?? s.sketchDraftOpacity,
    })),
  selectedSketchId: null,
  setSelectedSketchId: (id) => set({ selectedSketchId: id, selectedId: id ? null : get().selectedId }),

  beginHistoryBatch: () => {
    if (!historyBatch) historyBatch = { before: cloneSnapshot(get()) };
  },

  endHistoryBatch: () => {
    if (!historyBatch) return;
    const before = historyBatch.before;
    historyBatch = null;
    pushHistory(set, get, before);
  },

  nudgeSelection: (dx, dy) => {
    const s = get();
    if (s.selectedId) {
      const electrode = s.electrodes.find((e) => e.id === s.selectedId);
      if (!electrode) return;
      if (electrode.type === "lateral-medial") {
        s.updateElectrode(electrode.id, {
          entry: { x: Math.min(1, Math.max(0, electrode.entry.x + dx)), y: Math.min(1, Math.max(0, electrode.entry.y + dy)) },
          target: { x: Math.min(1, Math.max(0, electrode.target.x + dx)), y: Math.min(1, Math.max(0, electrode.target.y + dy)) },
        });
      } else {
        const move = (p: Point): Point => ({
          x: Math.min(1, Math.max(0, p.x + dx)),
          y: Math.min(1, Math.max(0, p.y + dy)),
        });
        s.updateElectrode(electrode.id, {
          lateralStart: move(electrode.lateralStart),
          lateralEnd: move(electrode.lateralEnd),
          medialStart: move(electrode.medialStart),
          medialEnd: move(electrode.medialEnd),
        });
      }
      return;
    }
    if (s.selectedSketchId) {
      const sketch = s.sketches.find((sk) => sk.id === s.selectedSketchId);
      if (!sketch) return;
      s.updateSketch(sketch.id, {
        points: sketch.points.map((p) => ({
          x: Math.min(1, Math.max(0, p.x + dx)),
          y: Math.min(1, Math.max(0, p.y + dy)),
        })),
      });
    }
  },

  undo: () => {
    const s = get();
    const before = s.undoStack[s.undoStack.length - 1];
    if (!before) return;
    const current = cloneSnapshot(s);
    set({
      electrodes: JSON.parse(JSON.stringify(before.electrodes)) as Electrode[],
      sketches: JSON.parse(JSON.stringify(before.sketches)) as FreehandSketch[],
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, current].slice(-100),
      selectedId: s.selectedId && before.electrodes.some((e) => e.id === s.selectedId) ? s.selectedId : null,
      selectedSketchId: s.selectedSketchId && before.sketches.some((sk) => sk.id === s.selectedSketchId) ? s.selectedSketchId : null,
    });
    scheduleAutosave(get);
  },

  redo: () => {
    const s = get();
    const next = s.redoStack[s.redoStack.length - 1];
    if (!next) return;
    const current = cloneSnapshot(s);
    set({
      electrodes: JSON.parse(JSON.stringify(next.electrodes)) as Electrode[],
      sketches: JSON.parse(JSON.stringify(next.sketches)) as FreehandSketch[],
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, current].slice(-100),
      selectedId: s.selectedId && next.electrodes.some((e) => e.id === s.selectedId) ? s.selectedId : null,
      selectedSketchId: s.selectedSketchId && next.sketches.some((sk) => sk.id === s.selectedSketchId) ? s.selectedSketchId : null,
    });
    scheduleAutosave(get);
  },

  loadConfigs: async () => {
    const base = import.meta.env.BASE_URL;
    const [regions, siRegions, anatomyCsvText] = await Promise.all([
      fetch(`${base}brain-regions.json`).then((r) => r.json()),
      fetch(`${base}superior-inferior-regions.json`).then((r) => r.json()),
      fetch(`${base}anatomy-library.csv`).then((r) => r.text()),
    ]);

    const anatomyFromDb = await db.anatomy.toArray();
    if (anatomyFromDb.length > 0) {
      // Backfill electrodeName for records saved before that field existed, so lookups
      // below never crash on `undefined.trim()`.
      const needsBackfill = anatomyFromDb.some((a) => a.electrodeName === undefined || a.electrodeName === null);
      const normalized = anatomyFromDb.map((a) => ({ ...a, electrodeName: a.electrodeName ?? "" }));
      if (needsBackfill) {
        await db.anatomy.bulkPut(normalized);
      }
      set({ regions, siRegions, anatomy: normalized });
      return;
    }

    // parse the seed CSV on first run and persist into IndexedDB
    const parsed = Papa.parse<Record<string, string>>(anatomyCsvText, {
      header: true,
      skipEmptyLines: true,
    });
    const records: AnatomyRecord[] = parsed.data.map((row) => ({
      id: uuid(),
      targetName: row.TargetName ?? "",
      preferredEntry: row.PreferredEntry ?? "",
      targetX: Number(row.TargetX) || 0,
      targetY: Number(row.TargetY) || 0,
      entryX: Number(row.EntryX) || 0,
      entryY: Number(row.EntryY) || 0,
      category: row.Category ?? "",
      comments: row.Comments ?? "",
      electrodeName: row.ElectrodeName ?? "",
    }));
    await db.anatomy.bulkAdd(records);
    set({ regions, siRegions, anatomy: records });
  },

  hydrateFromDB: async () => {
    const [electrodes, sketches, session] = await Promise.all([
      db.electrodes.orderBy("order").toArray(),
      db.sketches.toArray(),
      db.session.get("current"),
    ]);
    set({
      electrodes,
      sketches,
      patientLabel: session?.patientLabel ?? "",
      planNotes: session?.planNotes ?? "",
      hydrated: true,
    });
  },

  addLateralMedial: (partial) => {
    const s = get();
    const electrode: LateralMedialElectrode = {
      id: uuid(),
      name: partial?.name ?? "NEW1",
      type: "lateral-medial",
      color: partial?.color ?? nextColor(s.electrodes),
      entry: partial?.entry ?? { x: 0.25, y: 0.25 },
      target: partial?.target ?? { x: 0.25, y: 0.75 },
      entryName: partial?.entryName ?? "",
      targetName: partial?.targetName ?? "",
      notes: partial?.notes ?? "",
      order: s.electrodes.length,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    const before = cloneSnapshot(s);
    set({ electrodes: [...s.electrodes, electrode] });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
    return electrode;
  },

  addSuperiorInferior: (partial) => {
    const s = get();
    const electrode: SuperiorInferiorElectrode = {
      id: uuid(),
      name: partial?.name ?? "NEW1",
      type: "superior-inferior",
      color: partial?.color ?? nextColor(s.electrodes),
      lateralStart: partial?.lateralStart ?? { x: 0.5, y: 0.1 },
      lateralEnd: partial?.lateralEnd ?? { x: 0.5, y: 0.3 },
      medialStart: partial?.medialStart ?? { x: 0.5, y: 0.6 },
      medialEnd: partial?.medialEnd ?? { x: 0.5, y: 0.8 },
      entryName: partial?.entryName ?? "",
      targetName: partial?.targetName ?? "",
      notes: partial?.notes ?? "",
      order: s.electrodes.length,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    const before = cloneSnapshot(s);
    set({ electrodes: [...s.electrodes, electrode] });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
    return electrode;
  },

  addByName: (rawName) => {
    const s = get();
    const name = rawName.trim().toUpperCase();
    if (!name) return { ok: false, message: "Enter a name." };
    if (isNameTaken(name, s.electrodes)) {
      return { ok: false, message: `"${name}" is already in use.` };
    }

    // Try the anatomical library first (exact electrode-name match) -- gives a precise,
    // curated position plus entry/target labels, rather than a generic grid estimate.
    const libraryMatch = s.anatomy.find((a) => (a.electrodeName || "").trim().toUpperCase() === name);
    if (libraryMatch && s.regions) {
      const target = pixelToNormalized(libraryMatch.targetX, libraryMatch.targetY, s.regions);
      const entry = pixelToNormalized(libraryMatch.entryX, libraryMatch.entryY, s.regions);
      const created = s.addLateralMedial({
        name,
        entry,
        target,
        entryName: libraryMatch.preferredEntry,
        targetName: libraryMatch.targetName,
      });
      set({ selectedId: created.id });
      return { ok: true, message: `Placed ${name} from the anatomical library (${libraryMatch.targetName}).` };
    }

    // Try superior-inferior config lookup next (exact-name match, e.g. LAI, RPF)
    if (s.siRegions && s.siRegions[name] && s.regions) {
      const anchor = s.siRegions[name];
      const { referenceWidth: rw, referenceHeight: rh } = s.regions;
      const toN = (p: [number, number]) => pixelToNormalized(p[0], p[1], s.regions!);
      const created = s.addSuperiorInferior({
        name,
        lateralStart: toN(anchor.lateralStart),
        lateralEnd: toN(anchor.lateralEnd),
        medialStart: toN(anchor.medialStart),
        medialEnd: toN(anchor.medialEnd),
      });
      void rw; void rh;
      set({ selectedId: created.id });
      return { ok: true, message: `Placed ${name} from the superior-inferior config.` };
    }

    // Otherwise try lateral-medial 4-letter parsing
    const parsed = parseLateralMedialName(name);
    if (parsed && s.regions) {
      const quadKeyLateral = parsed.side === "L" ? "leftLateral" : "rightLateral";
      const quadKeyMedial = parsed.side === "L" ? "leftMedial" : "rightMedial";
      const col = parsed.amp === "A" ? 0 : parsed.amp === "M" ? 1 : 2;
      const row = parsed.smi === "S" ? 0 : parsed.smi === "M" ? 1 : 2;
      const entry = gridPositionInQuadrant(s.regions.quadrants[quadKeyLateral], col as 0 | 1 | 2, row as 0 | 1 | 2, s.regions);
      const target = gridPositionInQuadrant(s.regions.quadrants[quadKeyMedial], col as 0 | 1 | 2, row as 0 | 1 | 2, s.regions);
      const created = s.addLateralMedial({
        name: buildLateralMedialName(parsed.side, parsed.lobe, parsed.amp, parsed.smi),
        entry,
        target,
      });
      set({ selectedId: created.id });
      return {
        ok: true,
        message: `Placed ${name} using the approximate region grid -- verify placement before use.`,
      };
    }

    // Fallback: allow free-form names that don't fit the standard nomenclature
    // (e.g. an electrode named for a lesion it passes through). Placed manually.
    const created = s.addLateralMedial({ name });
    set({ selectedId: created.id });
    return {
      ok: true,
      message: `Added "${name}" manually -- drag the entry (●) and target (✕) markers into place.`,
    };
  },

  mirrorElectrode: (id) => {
    const s = get();
    const source = s.electrodes.find((e) => e.id === id);
    if (!source) return { ok: false, message: "Select an electrode first." };
    const name = source.name.trim().toUpperCase();
    if (!/^[LR]/.test(name)) {
      return { ok: false, message: `"${source.name}" does not have an L/R hemisphere prefix.` };
    }
    const mirroredName = `${name[0] === "L" ? "R" : "L"}${name.slice(1)}`;
    if (isNameTaken(mirroredName, s.electrodes)) {
      return { ok: false, message: `Cannot mirror ${name}: ${mirroredName} is already in the plan.` };
    }

    const libraryMatch = s.anatomy.find(
      (a) => (a.electrodeName || "").trim().toUpperCase() === mirroredName
    );

    const before = cloneSnapshot(s);
    let created: Electrode;
    historyBatch = { before };
    if (source.type === "lateral-medial") {
      if (libraryMatch && s.regions) {
        created = s.addLateralMedial({
          name: mirroredName,
          color: source.color,
          entry: pixelToNormalized(libraryMatch.entryX, libraryMatch.entryY, s.regions),
          target: pixelToNormalized(libraryMatch.targetX, libraryMatch.targetY, s.regions),
          entryName: libraryMatch.preferredEntry,
          targetName: libraryMatch.targetName,
          notes: source.notes,
        });
      } else {
        created = s.addLateralMedial({
          name: mirroredName,
          color: source.color,
          entry: { x: 1 - source.entry.x, y: source.entry.y },
          target: { x: 1 - source.target.x, y: source.target.y },
          entryName: source.entryName,
          targetName: source.targetName,
          notes: source.notes,
        });
      }
    } else {
      // Superior-inferior electrodes are mirrored geometrically unless a future
      // dedicated SI library record is added. All four trajectory points flip in X.
      created = s.addSuperiorInferior({
        name: mirroredName,
        color: source.color,
        lateralStart: { x: 1 - source.lateralStart.x, y: source.lateralStart.y },
        lateralEnd: { x: 1 - source.lateralEnd.x, y: source.lateralEnd.y },
        medialStart: { x: 1 - source.medialStart.x, y: source.medialStart.y },
        medialEnd: { x: 1 - source.medialEnd.x, y: source.medialEnd.y },
        entryName: source.entryName,
        targetName: source.targetName,
        notes: source.notes,
      });
    }
    historyBatch = null;
    pushHistory(set, get, before);
    set({ selectedId: created.id });
    return {
      ok: true,
      message: libraryMatch
        ? `Mirrored ${name} to ${mirroredName} using the contralateral anatomical-library coordinates.`
        : `Mirrored ${name} to ${mirroredName} using geometric reflection across the midline.`,
    };
  },

  addByAnatomy: (record) => {
    const s = get();
    if (!s.regions) return;
    const target = pixelToNormalized(record.targetX, record.targetY, s.regions);
    const entry = pixelToNormalized(record.entryX, record.entryY, s.regions);
    // suggest a name from the target's hemisphere, guessed from x position
    const side: "L" | "R" = record.targetX < s.regions.referenceWidth / 2 ? "L" : "R";
    let suggested = `${side}${record.targetName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}`;
    let n = 1;
    while (isNameTaken(suggested, s.electrodes)) {
      suggested = `${side}${record.targetName.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, "X")}${n}`;
      n++;
    }
    const created = s.addLateralMedial({
      name: suggested,
      entry,
      target,
      entryName: record.preferredEntry,
      targetName: record.targetName,
    });
    set({ selectedId: created.id });
  },

  updateElectrode: (id, patch) => {
    const s = get();
    const before = cloneSnapshot(s);
    set({
      electrodes: s.electrodes.map((e) =>
        e.id === id ? ({ ...e, ...patch, updatedAt: nowISO() } as Electrode) : e
      ),
    });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
  },

  renameElectrode: (id, name) => {
    const s = get();
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, message: "Name can't be empty." };
    if (isNameTaken(trimmed, s.electrodes, id)) {
      return { ok: false, message: `"${trimmed}" is already in use.` };
    }
    s.updateElectrode(id, { name: trimmed } as Partial<Electrode>);
    return { ok: true, message: "Renamed." };
  },

  removeElectrode: (id) => {
    const s = get();
    const before = cloneSnapshot(s);
    const remaining = s.electrodes
      .filter((e) => e.id !== id)
      .map((e, i) => ({ ...e, order: i }));
    set({ electrodes: remaining, selectedId: s.selectedId === id ? null : s.selectedId });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
  },

  reorderElectrodes: (orderedIds) => {
    const s = get();
    const byId = new Map(s.electrodes.map((e) => [e.id, e]));
    const reordered = orderedIds
      .map((id, i) => {
        const e = byId.get(id);
        return e ? { ...e, order: i } : null;
      })
      .filter(Boolean) as Electrode[];
    const before = cloneSnapshot(s);
    set({ electrodes: reordered });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
  },

  setSelected: (id) => set({ selectedId: id, selectedSketchId: id ? null : get().selectedSketchId }),
  setHovered: (id) => set({ hoveredId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  addSketch: (points) => {
    const s = get();
    if (points.length < 3) return;
    const sketch: FreehandSketch = {
      id: uuid(),
      label: `Area ${s.sketches.length + 1}`,
      points,
      color: s.sketchDraftColor,
      opacity: s.sketchDraftOpacity,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    const before = cloneSnapshot(s);
    set({ sketches: [...s.sketches, sketch], selectedSketchId: sketch.id });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
  },

  duplicateSketch: (id) => {
    const s = get();
    const original = s.sketches.find((sk) => sk.id === id);
    if (!original) return;
    // Offset slightly so the copy doesn't sit exactly on top of the original, clamped to
    // stay within the image bounds (same rigid-translate logic used for dragging).
    const { x: dx, y: dy } = clampTranslation(original.points, 0.025, 0.025);
    const copy: FreehandSketch = {
      ...original,
      id: uuid(),
      label: `${original.label} copy`,
      points: original.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    const before = cloneSnapshot(s);
    set({ sketches: [...s.sketches, copy], selectedSketchId: copy.id });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
  },

  updateSketch: (id, patch) => {
    const s = get();
    const before = cloneSnapshot(s);
    set({
      sketches: s.sketches.map((sk) => (sk.id === id ? { ...sk, ...patch, updatedAt: nowISO() } : sk)),
    });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
  },

  removeSketch: (id) => {
    const s = get();
    const before = cloneSnapshot(s);
    set({
      sketches: s.sketches.filter((sk) => sk.id !== id),
      selectedSketchId: s.selectedSketchId === id ? null : s.selectedSketchId,
    });
    if (!historyBatch) pushHistory(set, get, before);
    scheduleAutosave(get);
  },

  addAnatomyRecord: (rec) => {
    const s = get();
    const record: AnatomyRecord = { ...rec, id: uuid() };
    const updated = [...s.anatomy, record];
    set({ anatomy: updated });
    void db.anatomy.put(record);
  },

  updateAnatomyRecord: (id, patch) => {
    const s = get();
    const updated = s.anatomy.map((a) => (a.id === id ? { ...a, ...patch } : a));
    set({ anatomy: updated });
    const rec = updated.find((a) => a.id === id);
    if (rec) void db.anatomy.put(rec);
  },

  removeAnatomyRecord: (id) => {
    const s = get();
    set({ anatomy: s.anatomy.filter((a) => a.id !== id) });
    void db.anatomy.delete(id);
  },

  replaceAnatomyLibrary: (records) => {
    const withIds: AnatomyRecord[] = records.map((r) => ({ ...r, id: uuid() }));
    set({ anatomy: withIds });
    void db.anatomy.clear().then(() => db.anatomy.bulkAdd(withIds));
  },

  newPlan: async () => {
    await db.transaction("rw", db.electrodes, db.session, db.sketches, async () => {
      await db.electrodes.clear();
      await db.sketches.clear();
      await db.session.clear();
    });
    historyBatch = null;
    set({ electrodes: [], sketches: [], patientLabel: "", planNotes: "", selectedId: null, selectedSketchId: null, undoStack: [], redoStack: [] });
  },

  loadPlanFile: (file) => {
    historyBatch = null;
    set({
      electrodes: file.electrodes,
      sketches: file.sketches ?? [],
      patientLabel: file.patientLabel ?? "",
      planNotes: file.planNotes ?? "",
      selectedId: null,
      selectedSketchId: null,
      undoStack: [],
      redoStack: [],
    });
    scheduleAutosave(get);
  },

  exportPlanFile: () => {
    const s = get();
    const file: SeegPlanFile = {
      formatVersion: CURRENT_FORMAT_VERSION,
      appVersion: "1.0.0",
      createdAt: s.electrodes[0]?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
      patientLabel: s.patientLabel,
      planNotes: s.planNotes,
      electrodes: s.electrodes,
      sketches: s.sketches,
    };
    return file;
  },

  setPatientLabel: (v) => {
    set({ patientLabel: v });
    scheduleAutosave(get);
  },
  setPlanNotes: (v) => {
    set({ planNotes: v });
    scheduleAutosave(get);
  },
}));
