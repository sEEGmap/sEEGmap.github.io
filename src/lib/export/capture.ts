import { toPng } from "html-to-image";

export async function captureNode(node: HTMLElement, pixelRatio = 2): Promise<string> {
  return toPng(node, { pixelRatio, backgroundColor: "#ffffff", cacheBust: true });
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
