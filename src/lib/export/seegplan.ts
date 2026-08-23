import type { SeegPlanFile } from "../../types";

export function saveSeegplanFile(file: SeegPlanFile, filename: string) {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".seegplan") ? filename : `${filename}.seegplan`;
  link.click();
  URL.revokeObjectURL(url);
}
