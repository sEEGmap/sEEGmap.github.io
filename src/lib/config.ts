import { db } from "../db/db";
import type { AppConfig } from "../types";

export async function loadEffectiveConfig(): Promise<AppConfig> {
  const base = import.meta.env.BASE_URL;
  const [defaults, override] = await Promise.all([
    fetch(`${base}app-config.json`).then((r) => r.json() as Promise<AppConfig>).catch(() => ({
      institution: "",
      contact: "",
      email: "",
      phone: "",
    })),
    db.configOverride.get("current"),
  ]);
  return override ? override.config : defaults;
}

export async function saveConfigOverride(config: AppConfig): Promise<void> {
  await db.configOverride.put({ key: "current", config });
}

export async function clearConfigOverride(): Promise<void> {
  await db.configOverride.delete("current");
}
