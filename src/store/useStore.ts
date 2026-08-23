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

  showNames: true,
  toggleShowNames: () => set((s) => ({ showNames: !s.showNames })),
  drawMode: false,
  setDrawMode: (v) => set({ drawMode: v, selectedSketchId: v ? null : get().selectedSketchId }),
  sketchDraftColor: "#D68910",
  sketchDraftOpacity: 0.35,
  setSketchDraft: (patch) =>
    set((s) => ({
      sketchDraftColor: patch.color ?? s.sketchDraftColor,
      sketchDraftOpacity: patch.opacity ?? s.sketchDraftOpacity,
    })),
  selectedSketchId: null,
  setSelectedSketchId: (id) => set({ selectedSketchId: id }),

  loadConfigs: async () => {
    const base = import.meta.env.BASE_URL;
    const [regions, siRegions, anatomyCsvText] = await Promise.all([
      fetch(`${base}brain-regions.json`).then((r) => r.json()),
      fetch(`${base}superior-inferior-regions.json`).then((r) => r.json()),
      fetch(`${base}anatomy-library.csv`).then((r) => r.text()),
    ]);

    const anatomyFromDb = await db.anatomy.toArray();
    if (anatomyFromDb.length > 0) {
      set({ regions, siRegions, anatomy: anatomyFromDb });
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
    set({ electrodes: [...s.electrodes, electrode] });
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
    set({ electrodes: [...s.electrodes, electrode] });
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

    // Try superior-inferior config lookup first (exact-name match, e.g. LAI, RPF)
    if (s.siRegions && s.siRegions[name] && s.regions) {
      const anchor = s.siRegions[name];
      const { referenceWidth: rw, referenceHeight: rh } = s.regions;
      const toN = (p: [number, number]) => pixelToNormalized(p[0], p[1], s.regions!);
      s.addSuperiorInferior({
        name,
        lateralStart: toN(anchor.lateralStart),
        lateralEnd: toN(anchor.lateralEnd),
        medialStart: toN(anchor.medialStart),
        medialEnd: toN(anchor.medialEnd),
      });
      void rw; void rh;
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
      s.addLateralMedial({
        name: buildLateralMedialName(parsed.side, parsed.lobe, parsed.amp, parsed.smi),
        entry,
        target,
      });
      return {
        ok: true,
        message: `Placed ${name} using the approximate region grid -- verify placement before use.`,
      };
    }

    // Fallback: allow free-form names that don't fit the standard nomenclature
    // (e.g. an electrode named for a lesion it passes through). Placed manually.
    s.addLateralMedial({ name });
    return {
      ok: true,
      message: `Added "${name}" manually -- drag the entry (●) and target (✕) markers into place.`,
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
    s.addLateralMedial({
      name: suggested,
      entry,
      target,
      entryName: record.preferredEntry,
      targetName: record.targetName,
    });
  },

  updateElectrode: (id, patch) => {
    const s = get();
    set({
      electrodes: s.electrodes.map((e) =>
        e.id === id ? ({ ...e, ...patch, updatedAt: nowISO() } as Electrode) : e
      ),
    });
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
    const remaining = s.electrodes
      .filter((e) => e.id !== id)
      .map((e, i) => ({ ...e, order: i }));
    set({ electrodes: remaining, selectedId: s.selectedId === id ? null : s.selectedId });
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
    set({ electrodes: reordered });
    scheduleAutosave(get);
  },

  setSelected: (id) => set({ selectedId: id }),
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
    set({ sketches: [...s.sketches, sketch], selectedSketchId: sketch.id });
    scheduleAutosave(get);
  },

  updateSketch: (id, patch) => {
    const s = get();
    set({
      sketches: s.sketches.map((sk) => (sk.id === id ? { ...sk, ...patch, updatedAt: nowISO() } : sk)),
    });
    scheduleAutosave(get);
  },

  removeSketch: (id) => {
    const s = get();
    set({
      sketches: s.sketches.filter((sk) => sk.id !== id),
      selectedSketchId: s.selectedSketchId === id ? null : s.selectedSketchId,
    });
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
    set({ electrodes: [], sketches: [], patientLabel: "", planNotes: "", selectedId: null, selectedSketchId: null });
  },

  loadPlanFile: (file) => {
    set({
      electrodes: file.electrodes,
      sketches: file.sketches ?? [],
      patientLabel: file.patientLabel ?? "",
      planNotes: file.planNotes ?? "",
      selectedId: null,
      selectedSketchId: null,
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
