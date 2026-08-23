import Dexie, { type Table } from "dexie";
import type { AnatomyRecord, Electrode, FreehandSketch } from "../types";

export interface SessionMeta {
  key: string; // fixed key "current"
  patientLabel: string;
  planNotes: string;
  updatedAt: string;
}

class SeegPlanDB extends Dexie {
  electrodes!: Table<Electrode, string>;
  anatomy!: Table<AnatomyRecord, string>;
  session!: Table<SessionMeta, string>;
  sketches!: Table<FreehandSketch, string>;

  constructor() {
    super("seegplan-db");
    this.version(1).stores({
      electrodes: "id, order, type, name",
      anatomy: "id, targetName, category",
      session: "key",
    });
    this.version(2).stores({
      electrodes: "id, order, type, name",
      anatomy: "id, targetName, category",
      session: "key",
      configOverride: "key",
    });
    this.version(3)
      .stores({
        electrodes: "id, order, type, name",
        anatomy: "id, targetName, category",
        session: "key",
        configOverride: null,
        sketches: "id",
      });
  }
}

export const db = new SeegPlanDB();

export async function hasStoredSession(): Promise<boolean> {
  const [electrodeCount, sketchCount] = await Promise.all([db.electrodes.count(), db.sketches.count()]);
  return electrodeCount > 0 || sketchCount > 0;
}

export async function clearSession(): Promise<void> {
  await db.transaction("rw", db.electrodes, db.session, db.sketches, async () => {
    await db.electrodes.clear();
    await db.sketches.clear();
    await db.session.clear();
  });
}
