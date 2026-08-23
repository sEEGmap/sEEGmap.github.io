import PptxGenJS from "pptxgenjs";
import { captureNode, cropHalf, getImageSize } from "./capture";
import type { Electrode } from "../../types";

interface PptxOptions {
  node: HTMLElement;
  electrodes: Electrode[];
  patientLabel: string;
  planNotes: string;
  institution?: string;
  filename: string;
}

export async function exportWorkspacePptx({
  node,
  electrodes,
  patientLabel,
  planNotes,
  institution,
  filename,
}: PptxOptions) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "SEEGPLAN_16x9", width: 13.33, height: 7.5 });
  pptx.layout = "SEEGPLAN_16x9";

  const full = await captureNode(node, 2);
  const left = await cropHalf(full, "left");
  const right = await cropHalf(full, "right");
  const fullSize = await getImageSize(full);

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

  function addImageCentered(slide: PptxGenJS.Slide, dataUrl: string, aspect: number) {
    const maxW = 12.3;
    const maxH = 6.0;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    slide.addImage({ data: dataUrl, x: (13.33 - w) / 2, y: 1.3, w, h });
  }

  // Slide 1: both hemispheres
  addImageCentered(addTitleSlide("Both Hemispheres"), full, fullSize.width / fullSize.height);

  // Slide 2: left hemisphere
  addImageCentered(addTitleSlide("Left Hemisphere"), left, fullSize.width / 2 / fullSize.height);

  // Slide 3: right hemisphere
  addImageCentered(addTitleSlide("Right Hemisphere"), right, fullSize.width / 2 / fullSize.height);

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
  const bodyLines = [
    "Plan notes:",
    planNotes || "(none)",
    "",
    ...(withNotes.length ? ["Per-electrode notes:"] : []),
    ...withNotes.map((e) => `${e.name}: ${e.notes}`),
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
