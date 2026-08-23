import Dexie, { type Table } from "dexie";
import type { AnatomyRecord, AppConfig, Electrode } from "../types";

export interface SessionMeta {
  key: string; // fixed key "current"
  patientLabel: string;
  planNotes: string;
  updatedAt: string;
}

export interface ConfigOverride {
  key: string; // fixed key "current"
  config: AppConfig;
}

class SeegPlanDB extends Dexie {
  electrodes!: Table<Electrode, string>;
  anatomy!: Table<AnatomyRecord, string>;
  session!: Table<SessionMeta, string>;
  configOverride!: Table<ConfigOverride, string>;

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
  }
}

export const db = new SeegPlanDB();

export async function hasStoredSession(): Promise<boolean> {
  const count = await db.electrodes.count();
  return count > 0;
}

export async function clearSession(): Promise<void> {
  await db.transaction("rw", db.electrodes, db.session, async () => {
    await db.electrodes.clear();
    await db.session.clear();
  });
}
