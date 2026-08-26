import type { SeegPlanFile } from "../../types";

export function saveSeegmapFile(file: SeegPlanFile, filename: string) {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".seegmap") ? filename : `${filename}.seegmap`;
  link.click();
  URL.revokeObjectURL(url);
}
