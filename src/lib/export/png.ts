import { captureNode } from "./capture";

export async function exportWorkspacePng(node: HTMLElement, filename: string) {
  const dataUrl = await captureNode(node, 3);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.click();
}
