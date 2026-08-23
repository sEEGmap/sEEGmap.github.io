import { toPng } from "html-to-image";
import type { FreehandSketch } from "../../types";

export async function captureNode(node: HTMLElement, pixelRatio = 2): Promise<string> {
  return toPng(node, { pixelRatio, backgroundColor: "#ffffff", cacheBust: true });
}

/** Fetch a same-origin (public/) image and return it as a base64 data URL. */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Rasterize freehand sketches alone (transparent background) at the given reference size. */
export function rasterizeSketches(sketches: FreehandSketch[], width: number, height: number): string | null {
  if (sketches.length === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  sketches.forEach((sk) => {
    if (sk.points.length < 3) return;
    ctx.beginPath();
    sk.points.forEach((p, i) => {
      const x = p.x * width;
      const y = p.y * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.globalAlpha = sk.opacity;
    ctx.fillStyle = sk.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  return canvas.toDataURL("image/png");
}

/** Crop a data-URL image to a horizontal half (left or right). Returns a new data-URL. */
export async function cropHalf(dataUrl: string, side: "left" | "right"): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const halfW = img.width / 2;
  canvas.width = halfW;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  const sx = side === "left" ? 0 : halfW;
  ctx.drawImage(img, sx, 0, halfW, img.height, 0, 0, halfW, img.height);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return loadImage(dataUrl).then((img) => ({ width: img.width, height: img.height }));
}
