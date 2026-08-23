import PptxGenJS from "pptxgenjs";
import { cropHalf, fetchImageAsDataUrl, getImageSize, rasterizeSketches } from "./capture";
import { REF_H, REF_W } from "../constants";
import { stripHash } from "../color";
import type { Electrode, FreehandSketch, Point } from "../../types";

interface PptxOptions {
  electrodes: Electrode[];
  sketches: FreehandSketch[];
  patientLabel: string;
  planNotes: string;
  institution?: string;
  showNames: boolean;
  filename: string;
}

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const DIAGRAM_TOP = 1.3;
const DIAGRAM_MAX_W = 12.3;
const DIAGRAM_MAX_H = 6.0;
const DOT_R = 0.055; // inches
const X_R = 0.075;

type SlideRect = { x: number; y: number; w: number; h: number };

function fitRect(aspect: number): SlideRect {
  let w = DIAGRAM_MAX_W;
  let h = w / aspect;
  if (h > DIAGRAM_MAX_H) {
    h = DIAGRAM_MAX_H;
    w = h * aspect;
  }
  return { x: (SLIDE_W - w) / 2, y: DIAGRAM_TOP, w, h };
}

function sideOfElectrode(e: Electrode): "L" | "R" {
  const n = e.name.trim().toUpperCase();
  if (n.startsWith("L")) return "L";
  if (n.startsWith("R")) return "R";
  const nx = e.type === "lateral-medial" ? (e.entry.x + e.target.x) / 2 : (e.lateralStart.x + e.medialStart.x) / 2;
  return nx < 0.5 ? "L" : "R";
}

export async function exportWorkspacePptx({
  electrodes,
  sketches,
  patientLabel,
  planNotes,
  institution,
  showNames,
  filename,
}: PptxOptions) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "SEEGPLAN_16x9", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "SEEGPLAN_16x9";

  const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
  const bgFull = await fetchImageAsDataUrl(`${base}brain-template.png`);
  const bgLeft = await cropHalf(bgFull, "left");
  const bgRight = await cropHalf(bgFull, "right");
  const fullSize = await getImageSize(bgFull);

  const sketchOverlayFull = rasterizeSketches(sketches, REF_W, REF_H);
  const sketchOverlayLeft = sketchOverlayFull ? await cropHalf(sketchOverlayFull, "left") : null;
  const sketchOverlayRight = sketchOverlayFull ? await cropHalf(sketchOverlayFull, "right") : null;

  const titleColor = "2F6F6B";
  const mutedColor = "647480";

  function addTitleSlide(title: string) {
    const slide = pptx.addSlide();
    slide.addText(title, { x: 0.5, y: 0.3, fontSize: 22, bold: true, color: titleColor, fontFace: "Arial" });
    if (patientLabel || institution) {
      slide.addText([patientLabel, institution].filter(Boolean).join("   ·   "), {
        x: 0.5,
        y: 0.85,
        fontSize: 11,
        color: mutedColor,
        fontFace: "Arial",
      });
    }
    return slide;
  }

  function addDot(slide: PptxGenJS.Slide, pt: { x: number; y: number }, colorHex: string) {
    slide.addShape("ellipse", {
      x: pt.x - DOT_R,
      y: pt.y - DOT_R,
      w: DOT_R * 2,
      h: DOT_R * 2,
      fill: { color: stripHash(colorHex) },
      line: { color: "FFFFFF", width: 1 },
    });
  }

  function addTargetX(slide: PptxGenJS.Slide, pt: { x: number; y: number }, colorHex: string) {
    slide.addShape("mathMultiply", {
      x: pt.x - X_R,
      y: pt.y - X_R,
      w: X_R * 2,
      h: X_R * 2,
      fill: { color: stripHash(colorHex) },
      line: { type: "none" },
    });
  }

  function addTrajectoryLine(slide: PptxGenJS.Slide, a: { x: number; y: number }, b: { x: number; y: number }, colorHex: string) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.max(Math.abs(b.x - a.x), 0.005);
    const h = Math.max(Math.abs(b.y - a.y), 0.005);
    const topLeftToBottomRight = (a.x <= b.x) === (a.y <= b.y);
    slide.addShape("line", {
      x,
      y,
      w,
      h,
      line: { color: stripHash(colorHex), width: 1.5, dashType: "dash" },
      flipV: !topLeftToBottomRight,
    });
  }

  function addNameLabel(slide: PptxGenJS.Slide, pt: { x: number; y: number }, text: string, colorHex: string, below: boolean) {
    const h = 0.22;
    slide.addText(text, {
      x: pt.x - 0.5,
      y: below ? pt.y + 0.1 : pt.y - 0.1 - h,
      w: 1.0,
      h,
      align: "center",
      fontSize: 8,
      bold: true,
      color: stripHash(colorHex),
      fontFace: "Courier New",
      fill: { color: "FFFFFF", transparency: 30 },
      margin: 0,
    });
  }

  function drawElectrodes(slide: PptxGenJS.Slide, list: Electrode[], toSlide: (p: Point) => { x: number; y: number }) {
    list.forEach((e) => {
      if (e.type === "lateral-medial") {
        const entry = toSlide(e.entry);
        const target = toSlide(e.target);
        addDot(slide, entry, e.color);
        addTargetX(slide, target, e.color);
        if (showNames) {
          addNameLabel(slide, entry, e.name, e.color, true);
          addNameLabel(slide, target, e.name, e.color, true);
        }
      } else {
        const ls = toSlide(e.lateralStart);
        const le = toSlide(e.lateralEnd);
        const ms = toSlide(e.medialStart);
        const me = toSlide(e.medialEnd);
        addTrajectoryLine(slide, ls, le, e.color);
        addDot(slide, ls, e.color);
        addDot(slide, le, e.color);
        addTrajectoryLine(slide, ms, me, e.color);
        addTargetX(slide, ms, e.color);
        addTargetX(slide, me, e.color);
        if (showNames) {
          addNameLabel(slide, ls, e.name, e.color, false);
          addNameLabel(slide, ms, e.name, e.color, false);
        }
      }
    });
  }

  function addDiagramSlide(
    title: string,
    bgDataUrl: string,
    sketchOverlay: string | null,
    aspect: number,
    list: Electrode[],
    localMap: (p: Point) => Point
  ) {
    const slide = addTitleSlide(title);
    const rect = fitRect(aspect);
    slide.addImage({ data: bgDataUrl, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    if (sketchOverlay) {
      slide.addImage({ data: sketchOverlay, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    }
    const toSlide = (p: Point) => {
      const local = localMap(p);
      return { x: rect.x + local.x * rect.w, y: rect.y + local.y * rect.h };
    };
    drawElectrodes(slide, list, toSlide);
    return slide;
  }

  // Slide 1: both hemispheres -- full diagram, native editable markers
  addDiagramSlide("Both Hemispheres", bgFull, sketchOverlayFull, fullSize.width / fullSize.height, electrodes, (p) => p);

  // Slide 2: left hemisphere only
  addDiagramSlide(
    "Left Hemisphere",
    bgLeft,
    sketchOverlayLeft,
    fullSize.width / 2 / fullSize.height,
    electrodes.filter((e) => sideOfElectrode(e) === "L"),
    (p) => ({ x: Math.min(1, Math.max(0, p.x * 2)), y: p.y })
  );

  // Slide 3: right hemisphere only
  addDiagramSlide(
    "Right Hemisphere",
    bgRight,
    sketchOverlayRight,
    fullSize.width / 2 / fullSize.height,
    electrodes.filter((e) => sideOfElectrode(e) === "R"),
    (p) => ({ x: Math.min(1, Math.max(0, (p.x - 0.5) * 2)), y: p.y })
  );

  // Slide 4: electrode summary table
  const summarySlide = addTitleSlide("Electrode Summary");
  const sorted = [...electrodes].sort((a, b) => a.order - b.order);
  const rows: PptxGenJS.TableRow[] = [
    [
      { text: "#", options: { bold: true } },
      { text: "Name", options: { bold: true } },
      { text: "Type", options: { bold: true } },
      { text: "Entry", options: { bold: true } },
      { text: "Target", options: { bold: true } },
    ],
    ...sorted.map((e, i) => [
      { text: String(i + 1) },
      { text: e.name },
      { text: e.type === "lateral-medial" ? "Lateral-Medial" : "Superior-Inferior" },
      { text: e.entryName || "--" },
      { text: e.targetName || "--" },
    ]),
  ];
  summarySlide.addTable(rows, {
    x: 0.5,
    y: 1.3,
    w: 12.3,
    fontSize: 11,
    fontFace: "Arial",
    border: { type: "solid", color: "E2E7EB", pt: 0.75 },
    autoPage: true,
  });

  // Slide 5: notes
  const notesSlide = addTitleSlide("Notes");
  const withNotes = sorted.filter((e) => e.notes.trim());
  const sketchLines = sketches.length
    ? ["", "Sketched areas:", ...sketches.map((sk) => `${sk.label}`)]
    : [];
  const bodyLines = [
    "Plan notes:",
    planNotes || "(none)",
    "",
    ...(withNotes.length ? ["Per-electrode notes:"] : []),
    ...withNotes.map((e) => `${e.name}: ${e.notes}`),
    ...sketchLines,
  ];
  notesSlide.addText(bodyLines.join("\n"), {
    x: 0.5,
    y: 1.3,
    w: 12.3,
    h: 5.6,
    fontSize: 12,
    fontFace: "Arial",
    valign: "top",
    color: "182430",
  });

  await pptx.writeFile({ fileName: filename.endsWith(".pptx") ? filename : `${filename}.pptx` });
}
