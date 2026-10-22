import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { DOCUMENTS, type WindResult } from "@wind/engine";
import { toWindInput, type Project } from "./project";
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
import { elevationSvg, FACE_NAMES, fmt, signed } from "./viz";

type Ok = Extract<WindResult, { ok: true }>;

export interface ReportOptions {
  disclaimer: string;
  /** Converts an SVG string to PNG bytes. Absent in tests: the elevations are then listed as tables only. */
  rasterise?: (svg: string) => Promise<{ data: Uint8Array; width: number; height: number }>;
}

const BRAND = "123B5C";
const LIGHT = "E8F0F4";

const p = (text: string, opts: { bold?: boolean; size?: number; italics?: boolean; color?: string } = {}) =>
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...opts })] });
const h1 = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, color: BRAND })] });
const h2 = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [new TextRun({ text, color: BRAND })] });
const bullet = (text: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(text)] });

function cell(text: string, o: { header?: boolean; shade?: string; bold?: boolean; align?: "left" | "center" | "right"; span?: number } = {}) {
  return new TableCell({
    columnSpan: o.span,
    shading: o.header || o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.header ? BRAND : o.shade! } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: o.align === "center" ? AlignmentType.CENTER : o.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text, bold: o.header || o.bold, color: o.header ? "FFFFFF" : undefined, size: 18 })],
      }),
    ],
  });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "B8C7CE" };
function table(rows: TableRow[], columnWidths?: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    ...(columnWidths ? { columnWidths, layout: TableLayoutType.FIXED } : {}),
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows,
  });
}

function summaryRows(r: Ok, env: "ventilated" | "sealed", shade: string): TableRow[] {
  return summaryLines(r, env).map(([name, vals], i) =>
    new TableRow({ children: [cell(i === 0 ? envelopeLabel(r, env) : "", { shade, bold: true }), cell(name), ...vals.map((v) => cell(v, { align: "center" })), cell("kN/m²", { align: "center" })] }),
  );
}

function summaryTable(r: Ok) {
  return table([
    new TableRow({
      tableHeader: true,
      children: [cell("Envelope", { header: true }), cell("Design value", { header: true }), ...r.elevations.map((e) => cell(`${FACE_NAMES[e.face]}`, { header: true, align: "center" })), cell("Unit", { header: true })],
    }),
    ...summaryRows(r, "ventilated", "DCEBFA"),
    ...summaryRows(r, "sealed", "FFF4C2"),
  ], [1900, 2300, 1100, 1100, 1100, 1100, 1200]);
}

function appendixTable(project: Project, b: ReportBlock) {
  return table(
    [
      new TableRow({ tableHeader: true, children: APPENDIX_HEAD.map((t, i) => cell(t, { header: true, align: i >= 2 && i < 6 ? "center" : "left" })) }),
      ...appendixRows(project, b).map((r) => new TableRow({ children: r.map((t, i) => cell(t, { align: i >= 1 && i < 7 ? "center" : "left" })) })),
    ],
    [2700, 1000, 950, 950, 950, 950, 750, 1650],
  );
}

function funnelTable(b: ReportBlock) {
  const rows = funnelRows(b);
  if (!rows.length) return p(NO_FUNNEL, { italics: true });
  return table([
    new TableRow({ tableHeader: true, children: FUNNEL_HEAD.map((t) => cell(t, { header: true, align: "center" })) }),
    ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, { align: i === 0 ? "left" : "center" })) })),
  ]);
}

/** Builds the Word report (layout modelled on façade wind load calculation reports). */
export async function buildReport(project: Project, blocks: ReportBlock[], opts: ReportOptions): Promise<Document> {
  const m = project.meta;
  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(new Paragraph({ spacing: { before: 1800, after: 400 }, children: [new TextRun({ text: "Wind Load Calculation Report", bold: true, size: 52, color: BRAND })] }));
  children.push(
    table(
      [
        ["Project", m.project],
        ["Document no.", m.reference],
        ["Client", m.client],
        ["Prepared by", m.preparedBy],
        ["Date", m.date],
      ].map(([k, v]) => new TableRow({ children: [cell(k!, { shade: LIGHT, bold: true }), cell(v || "—")] })),
    ),
  );
  children.push(p(""));
  children.push(p(opts.disclaimer, { italics: true, size: 18 }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Summary
  children.push(h1("Summary"));
  children.push(p(SUMMARY_INTRO));
  for (const b of blocks) {
    children.push(h2(b.name));
    children.push(summaryTable(b.result));
  }
  children.push(p(designNote(project), { italics: true }));

  // 1 Introduction
  children.push(h1("1. Introduction"));
  children.push(h2("1.1 Site information"));
  siteBullets(project).forEach((t) => children.push(bullet(t)));
  if (m.siteNotes) children.push(p(m.siteNotes));
  children.push(h2("1.2 Building dimensions"));
  children.push(
    table([
      new TableRow({ tableHeader: true, children: ["Block", "N/S elevation width (m)", "E/W elevation width (m)", "Height (m)"].map((t) => cell(t, { header: true, align: "center" })) }),
      ...blocks.map((b) => new TableRow({ children: [cell(b.name), cell(fmt(b.widthNS, 2), { align: "center" }), cell(fmt(b.widthEW, 2), { align: "center" }), cell(fmt(b.height, 2), { align: "center" })] })),
    ]),
  );

  // 2 Design data
  children.push(h1("2. Design data"));
  children.push(h2("2.1 Standards"));
  for (const k of ["EN", "NA", "PD", "CWCT"] as const) children.push(bullet(DOCUMENTS[k].title));
  children.push(h2("2.2 Scope"));
  SCOPE.forEach((t) => children.push(bullet(t)));
  children.push(h2("2.3 Methodology"));
  methodology(project).forEach((t) => children.push(bullet(t)));

  // 3 Results
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("3. Results (glazed areas, including internal pressure)"));
  for (const [i, b] of blocks.entries()) {
    children.push(h2(`3.${i + 1} Wind load, ${b.name}`));
    for (const el of b.result.elevations) {
      const svg = elevationSvg(el, "sealed", b.height, `${b.name} · ${FACE_NAMES[el.face]} elevation`);
      if (opts.rasterise) {
        const img = await opts.rasterise(svg);
        const w = 600;
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: img.data, transformation: { width: w, height: (w * img.height) / img.width } })] }));
      } else {
        const sm = el.summary.sealed;
        children.push(p(`${FACE_NAMES[el.face]} elevation: Wp ${signed(sm.wp.design)} kPa, corner Ws ${signed(sm.wsA.design)} kPa over ${fmt(sm.cornerWidth, 2)} m, general Ws ${signed(sm.ws.design)} kPa.`));
      }
    }
  }

  // Appendix
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("Appendix A: Calculation details"));
  for (const b of blocks) {
    children.push(h2(b.name));
    children.push(appendixTable(project, b));
    children.push(p(""));
    children.push(p("Funnelling check (NA.2.27 note d)", { bold: true }));
    children.push(funnelTable(b));
    if (b.result.advisories.length) {
      children.push(p("Advisories", { bold: true }));
      b.result.advisories.forEach((a) => children.push(bullet(`${a.id}: ${a.message}`)));
    }
  }

  return new Document({
    creator: m.preparedBy || "Wind Loader",
    title: `Wind Load Calculation Report — ${m.project}`,
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${m.project} · ${m.reference} · Wind Loader · page `, size: 16, color: "56666E" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "56666E" })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

/** Browser-only: SVG string to PNG bytes at 2× for print. */
export async function rasteriseSvg(svg: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Could not draw the elevation."));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const png = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
    return { data: new Uint8Array(await png.arrayBuffer()), width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportReport(project: Project, run: (p: Project, i: number) => WindResult, disclaimer: string) {
  const doc = await buildReport(project, reportBlocks(project, run), { disclaimer, rasterise: rasteriseSvg });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(project.meta.reference || "wind-loads").replace(/[^\w.-]+/g, "_")} Wind Load Report.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export { reportBlocks, toWindInput, type ReportBlock };
