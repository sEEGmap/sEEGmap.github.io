import { jsPDF } from "jspdf";
import { captureNode, getImageSize } from "./capture";
import type { Electrode } from "../../types";

interface PdfOptions {
  node: HTMLElement;
  electrodes: Electrode[];
  patientLabel: string;
  planNotes: string;
  institution?: string;
  filename: string;
}

export async function exportWorkspacePdf({
  node,
  electrodes,
  patientLabel,
  planNotes,
  institution,
  filename,
}: PdfOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // ---------- Page 1: Overview ----------
  drawHeader(doc, "sEEGplan -- Overview", patientLabel, institution, pageW, margin);
  const dataUrl = await captureNode(node, 2);
  const { width: iw, height: ih } = await getImageSize(dataUrl);
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - 40;
  const scale = Math.min(availW / iw, availH / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  doc.addImage(dataUrl, "PNG", (pageW - drawW) / 2, margin + 40, drawW, drawH);

  // ---------- Page 2: Electrode Table ----------
  doc.addPage();
  drawHeader(doc, "sEEGplan -- Electrode Table", patientLabel, institution, pageW, margin);
  const sorted = [...electrodes].sort((a, b) => a.order - b.order);
  const cols = [
    { key: "order", label: "#", w: 26 },
    { key: "name", label: "Name", w: 70 },
    { key: "type", label: "Type", w: 100 },
    { key: "entry", label: "Entry", w: 190 },
    { key: "target", label: "Target", w: 190 },
    { key: "notes", label: "Notes", w: pageW - margin * 2 - (26 + 70 + 100 + 190 + 190) },
  ];
  let y = margin + 56;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  let x = margin;
  cols.forEach((c) => {
    doc.text(c.label, x, y);
    x += c.w;
  });
  y += 6;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  sorted.forEach((e, i) => {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin + 20;
    }
    x = margin;
    const row = [
      String(i + 1),
      e.name,
      e.type === "lateral-medial" ? "Lateral-Medial" : "Superior-Inferior",
      e.entryName || "--",
      e.targetName || "--",
      truncate(e.notes || "--", 60),
    ];
    row.forEach((val, ci) => {
      doc.text(val, x, y, { maxWidth: cols[ci].w - 6 });
      x += cols[ci].w;
    });
    y += 18;
  });

  // ---------- Page 3: Notes ----------
  doc.addPage();
  drawHeader(doc, "sEEGplan -- Notes", patientLabel, institution, pageW, margin);
  y = margin + 60;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Plan notes", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const planLines = doc.splitTextToSize(planNotes || "(none)", pageW - margin * 2);
  doc.text(planLines, margin, y);
  y += planLines.length * 13 + 20;

  const withNotes = sorted.filter((e) => e.notes.trim());
  if (withNotes.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Per-electrode notes", margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    withNotes.forEach((e) => {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin + 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(e.name, margin, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(e.notes, pageW - margin * 2 - 70);
      doc.text(lines, margin + 70, y);
      y += Math.max(16, lines.length * 13) + 6;
    });
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

function drawHeader(
  doc: jsPDF,
  title: string,
  patientLabel: string,
  institution: string | undefined,
  pageW: number,
  margin: number
) {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, margin);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const meta = [patientLabel, institution].filter(Boolean).join("  ·  ");
  if (meta) doc.text(meta, margin, margin + 16);
  doc.text(new Date().toLocaleDateString(), pageW - margin, margin, { align: "right" });
  doc.setTextColor(0);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
