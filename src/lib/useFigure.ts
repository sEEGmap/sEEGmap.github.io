import { useStore } from "../store/useStore";
import { FIGURES, canvasHeight, type FigureConfig } from "./figures";

/** Height of the canvas coordinate space for the active figure (width is always REF_W). */
export function useCanvasHeight(): number {
  return useStore((s) => canvasHeight(s.figure));
}

/** Config of the active figure. */
export function useFigureConfig(): FigureConfig {
  return useStore((s) => FIGURES[s.figure]);
}
