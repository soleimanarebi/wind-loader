import { DOCUMENTS } from "@wind/engine";
import { jsPDF } from "jspdf";
import type { Project } from "./project";
import {
  APPENDIX_HEAD,
  appendixRows,
  designNote,
  envelopeLabel,
  FUNNEL_HEAD,
  funnelRows,
  methodology,
  NO_FUNNEL,
  reportBlocks,
  SCOPE,
  siteBullets,
  summaryLines,
  SUMMARY_INTRO,
  type ReportBlock,
} from "./content";
import type { WindResult } from "@wind/engine";
import { elevationSvg, FACE_NAMES, fmt } from "./viz";

/**
 * The built-in PDF fonts only cover Latin-1, so Greek letters and maths symbols are spelled out.
 * Anything else outside Latin-1 becomes "?" rather than silently disappearing.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/θ/g, "theta"],
  [/ρ/g, "rho"],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/≈/g, "~"],
  [/−/g, "-"],
  [/[–—]/g, "-"],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/…/g, "..."],
  [/→/g, "->"],
  [/←/g, "<-"],
];

export function pdfText(s: string): string {
  let out = s;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  return out.replace(/[^\x00-\xff]/g, "?");
}

type Rgb = [number, number, number];
const BRAND: Rgb = [18, 59, 92];
const GREY: Rgb = [86, 102, 110];
const INK: Rgb = [20, 20, 20];
const PAGE = { w: 210, h: 297, margin: 16 };

interface Column {
  title: string;
  width: number;
  align?: "left" | "center" | "right";
}

/** Flowing A4 layout: headings, paragraphs, bullets, tables that break across pages, and images. */
class Writer {
  y = PAGE.margin;
  table = 0;
  constructor(
    readonly doc: jsPDF,
    readonly header: string,
    readonly footer: string,
  ) {}

  ensure(height: number) {
    if (this.y + height > PAGE.h - PAGE.margin - 12) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.y = PAGE.margin + 4;
  }

  heading(text: string, size = 14) {
    this.ensure(size > 12 ? 22 : 14);
    this.y += size > 12 ? 4 : 2;
    this.doc.setFont("helvetica", "bold").setFontSize(size).setTextColor(...BRAND);
    this.doc.text(pdfText(text), PAGE.margin, this.y);
    this.y += size * 0.5;
    this.doc.setTextColor(...INK);
  }

  paragraph(text: string, { size = 9.5, bold = false, italic = false, indent = 0, colour }: { size?: number; bold?: boolean; italic?: boolean; indent?: number; colour?: Rgb } = {}) {
    this.doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal").setFontSize(size);
    if (colour) this.doc.setTextColor(...colour);
    const lines = this.doc.splitTextToSize(pdfText(text), PAGE.w - 2 * PAGE.margin - indent) as string[];
    const lh = size * 0.42;
    for (const line of lines) {
      this.ensure(lh);
      this.doc.text(line, PAGE.margin + indent, this.y);
      this.y += lh;
    }
    this.y += 1.2;
    this.doc.setTextColor(...INK);
  }

  bullet(text: string) {
    this.doc.setFont("helvetica", "normal").setFontSize(9.5);
    this.ensure(4);
    this.doc.text("•", PAGE.margin + 1, this.y);
    this.paragraph(text, { indent: 5 });
  }

  /** A table with a shaded header row; rows break across pages with the header repeated. */
  grid(cols: Column[], rows: string[][], { size = 8.5, shade }: { size?: number; shade?: (row: number) => Rgb | undefined } = {}) {
    const total = cols.reduce((s, c) => s + c.width, 0);
    const widths = cols.map((c) => (c.width * (PAGE.w - 2 * PAGE.margin)) / total);
    const lh = size * 0.42;
    const pad = 1.4;
    const drawRow = (cells: string[][], h: number, header: boolean) => {
      let x = PAGE.margin;
      cells.forEach((c, i) => {
        const align = cols[i]!.align ?? "left";
        const tx = align === "right" ? x + widths[i]! - pad : align === "center" ? x + widths[i]! / 2 : x + pad;
        this.doc.text(c, tx, this.y + pad + lh * 0.8, { align });
        if (!header) this.doc.setDrawColor(184, 199, 206).setLineWidth(0.15).rect(x, this.y, widths[i]!, h);
        x += widths[i]!;
      });
    };
    const head = () => {
      this.doc.setFont("helvetica", "bold").setFontSize(size);
      const cells = cols.map((c, i) => this.doc.splitTextToSize(pdfText(c.title), widths[i]! - 2 * pad) as string[]);
      const h = Math.max(...cells.map((c) => c.length)) * lh + 2 * pad;
      this.ensure(h + lh * 3);
      this.doc.setFillColor(...BRAND).rect(PAGE.margin, this.y, PAGE.w - 2 * PAGE.margin, h, "F");
      this.doc.setTextColor(255, 255, 255);
      drawRow(cells, h, true);
      this.doc.setTextColor(...INK);
      this.y += h;
    };
    head();
    rows.forEach((r, ri) => {
      this.doc.setFont("helvetica", "normal").setFontSize(size);
      const cells = r.map((c, i) => this.doc.splitTextToSize(pdfText(c), widths[i]! - 2 * pad) as string[]);
      const h = Math.max(...cells.map((c) => c.length)) * lh + 2 * pad;
      if (this.y + h > PAGE.h - PAGE.margin - 12) {
        this.newPage();
        head();
        this.doc.setFont("helvetica", "normal").setFontSize(size);
      }
      const fill = shade?.(ri);
      if (fill) this.doc.setFillColor(...fill).rect(PAGE.margin, this.y, PAGE.w - 2 * PAGE.margin, h, "F");
      drawRow(cells, h, false);
      this.y += h;
    });
    this.y += 4;
  }

  image(dataUrl: string, aspect: number, maxH = 92) {
    const w = PAGE.w - 2 * PAGE.margin;
    const h = Math.min(w / aspect, maxH);
    this.ensure(h + 4);
    this.doc.addImage(dataUrl, "PNG", PAGE.margin + (w - h * aspect) / 2, this.y, h * aspect, h);
    this.y += h + 4;
  }

  /** Running header and page numbers on every page after the cover. */
  finish() {
    const n = this.doc.getNumberOfPages();
    for (let p = 2; p <= n; p++) {
      this.doc.setPage(p);
      this.doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GREY);
      this.doc.text(pdfText(this.header), PAGE.margin, PAGE.margin - 5);
      this.doc.setDrawColor(200, 210, 214).setLineWidth(0.2).line(PAGE.margin, PAGE.margin - 3.5, PAGE.w - PAGE.margin, PAGE.margin - 3.5);
      this.doc.text(pdfText(this.footer), PAGE.margin, PAGE.h - PAGE.margin + 4);
      this.doc.text(`Page ${p} of ${n}`, PAGE.w - PAGE.margin, PAGE.h - PAGE.margin + 4, { align: "right" });
    }
  }
}

export interface PdfOptions {
  disclaimer: string;
  /** SVG string to a PNG data URL. Absent in tests: the elevations are then listed as text. */
  rasterise?: (svg: string) => Promise<{ dataUrl: string; width: number; height: number }>;
  /** Compress page streams (default true; tests read the text). */
  compress?: boolean;
}

/** Builds the PDF report: the same sections as the Word report. */
export async function buildPdfReport(project: Project, blocks: ReportBlock[], opts: PdfOptions): Promise<jsPDF> {
  const m = project.meta;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: opts.compress ?? true });
  doc.setProperties({ title: pdfText(`Wind Load Calculation Report - ${m.project}`), creator: "Wind Loader", author: pdfText(m.preparedBy || "Wind Loader") });
  const w = new Writer(doc, `${m.project} · ${m.reference}`, "Wind Loader · Design aid only. Results must be checked by a qualified engineer.");

  // Cover
  doc.setFillColor(...BRAND).rect(0, 0, PAGE.w, 70, "F");
  doc.setFont("helvetica", "bold").setFontSize(24).setTextColor(255, 255, 255).text("Wind Load Calculation Report", PAGE.margin, 40);
  doc.setFont("helvetica", "normal").setFontSize(12).text(pdfText(m.project || "Untitled project"), PAGE.margin, 52);
  doc.setTextColor(...INK);
  w.y = 90;
  w.grid(
    [
      { title: "Project details", width: 35 },
      { title: "", width: 65 },
    ],
    [
      ["Project", m.project],
      ["Document no.", m.reference],
      ["Client", m.client],
      ["Prepared by", m.preparedBy],
      ["Date", m.date],
    ].map(([k, v]) => [k!, v || "-"]),
    { size: 10 },
  );
  w.y += 6;
  w.paragraph(opts.disclaimer, { italic: true, size: 8.5, colour: GREY });

  // Summary
  w.newPage();
  w.heading("Summary");
  w.paragraph(SUMMARY_INTRO);
  for (const b of blocks) {
    w.heading(b.name, 11);
    const r = b.result;
    const rows: string[][] = [];
    const tints: Rgb[] = [];
    for (const [env, tint] of [
      ["ventilated", [220, 235, 250]],
      ["sealed", [255, 244, 194]],
    ] as const) {
      summaryLines(r, env).forEach(([name, vals], i) => {
        rows.push([i === 0 ? envelopeLabel(r, env) : "", name, ...vals, "kN/m²"]);
        tints.push([...tint]);
      });
    }
    w.grid(
      [
        { title: "Envelope", width: 19 },
        { title: "Design value", width: 23 },
        ...r.elevations.map((e) => ({ title: FACE_NAMES[e.face], width: 11, align: "center" as const })),
        { title: "Unit", width: 9, align: "center" },
      ],
      rows,
      { shade: (i) => tints[i] },
    );
  }
  w.paragraph(designNote(project), { italic: true });

  // 1 Introduction
  w.heading("1. Introduction");
  w.heading("1.1 Site information", 11);
  siteBullets(project).forEach((t) => w.bullet(t));
  if (m.siteNotes) w.paragraph(m.siteNotes);
  w.heading("1.2 Building dimensions", 11);
  w.grid(
    [
      { title: "Block", width: 30 },
      { title: "N/S elevation width (m)", width: 25, align: "center" },
      { title: "E/W elevation width (m)", width: 25, align: "center" },
      { title: "Height (m)", width: 20, align: "center" },
    ],
    blocks.map((b) => [b.name, fmt(b.widthNS, 2), fmt(b.widthEW, 2), fmt(b.height, 2)]),
  );

  // 2 Design data
  w.heading("2. Design data");
  w.heading("2.1 Standards", 11);
  for (const k of ["EN", "NA", "PD", "CWCT"] as const) w.bullet(DOCUMENTS[k].title);
  w.heading("2.2 Scope", 11);
  SCOPE.forEach((t) => w.bullet(t));
  w.heading("2.3 Methodology", 11);
  methodology(project).forEach((t) => w.bullet(t));

  // 3 Results
  w.newPage();
  w.heading("3. Results (glazed areas, including internal pressure)");
  for (const [i, b] of blocks.entries()) {
    w.heading(`3.${i + 1} Wind load, ${b.name}`, 11);
    for (const el of b.result.elevations) {
      const svg = elevationSvg(el, "sealed", b.height, `${b.name} · ${FACE_NAMES[el.face]} elevation`);
      if (opts.rasterise) {
        const img = await opts.rasterise(svg);
        w.image(img.dataUrl, img.width / img.height);
      } else {
        const sm = el.summary.sealed;
        w.paragraph(`${FACE_NAMES[el.face]} elevation: Wp ${fmt(sm.wp.design)} kPa, corner Ws ${fmt(sm.wsA.design)} kPa over ${fmt(sm.cornerWidth, 2)} m, general Ws ${fmt(sm.ws.design)} kPa.`);
      }
    }
  }

  // Appendix
  w.newPage();
  w.heading("Appendix A: Calculation details");
  for (const b of blocks) {
    w.heading(b.name, 11);
    w.grid(
      APPENDIX_HEAD.map((t, i) => ({ title: t, width: [27, 10, 9.5, 9.5, 9.5, 9.5, 7.5, 17.5][i]!, align: i >= 1 && i < 7 ? ("center" as const) : ("left" as const) })),
      appendixRows(project, b),
      { size: 7.5, shade: (i) => (i % 2 ? [238, 244, 246] : undefined) },
    );
    w.paragraph("Funnelling check (NA.2.27 note d)", { bold: true });
    const fr = funnelRows(b);
    if (fr.length) w.grid(FUNNEL_HEAD.map((t, i) => ({ title: t, width: i === 0 ? 18 : i === 5 ? 22 : 12, align: i === 0 ? ("left" as const) : ("center" as const) })), fr);
    else w.paragraph(NO_FUNNEL, { italic: true });
    if (b.result.advisories.length) {
      w.paragraph("Advisories", { bold: true });
      b.result.advisories.forEach((a) => w.bullet(`${a.id}: ${a.message}`));
    }
  }

  w.finish();
  return doc;
}

/** Browser-only: SVG string to a PNG data URL at 2× for print. */
export async function rasteriseSvgDataUrl(svg: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Could not draw the elevation."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPdfReport(project: Project, run: (p: Project, i: number) => WindResult, disclaimer: string) {
  const doc = await buildPdfReport(project, reportBlocks(project, run), { disclaimer, rasterise: rasteriseSvgDataUrl });
  doc.save(`${(project.meta.reference || "wind-loads").replace(/[^\w.-]+/g, "_")} Wind Load Report.pdf`);
}
