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
import { DOCUMENTS, FACES, type DirectionResult, type Envelope, type WindResult } from "@wind/engine";
import { toWindInput, type Project } from "./project";
import { elevationSvg, FACE_NAMES, fmt, signed } from "./viz";

type Ok = Extract<WindResult, { ok: true }>;

export interface ReportBlock {
  name: string;
  height: number;
  widthNS: number;
  widthEW: number;
  result: Ok;
}

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

/** Summary rows for one envelope: Wp, Ws corner (width), Ws general per elevation. */
export function summaryLines(r: Ok, env: Envelope): [string, string[]][] {
  const s = (f: (typeof r.elevations)[number]) => f.summary[env];
  return [
    ["Wind pressure Wp", r.elevations.map((e) => signed(s(e).wp.design))],
    ["Corner suction Ws (zone A)", r.elevations.map((e) => signed(s(e).wsA.design))],
    ["Corner zone width", r.elevations.map((e) => `${fmt(s(e).cornerWidth, 2)} m`)],
    ["General suction Ws", r.elevations.map((e) => signed(s(e).ws.design))],
  ];
}

export const envelopeLabel = (r: Ok, env: "ventilated" | "sealed") => (env === "ventilated" ? "Solid / rainscreen (cpi = 0)" : `Glazed (cpi +${r.cpi.positive} / ${r.cpi.negative})`);

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

/** Appendix table in the layout of the calculation spreadsheet: one column per wind direction. */
export function appendixRows(project: Project, b: ReportBlock): string[][] {
  const r = b.result;
  const d = (f: (x: DirectionResult) => string) => r.directions.map(f);
  const dirIn = (f: (k: (typeof FACES)[number]) => string) => FACES.map(f);
  const block = project.blocks.find((x) => x.name === b.name);
  const row = (factor: string, sym: string, vals: string[], unit: string, ref: string) => [factor, sym, ...vals, unit, ref];
  const step = (x: DirectionResult, s: string) => x.top.steps.find((t) => t.symbol === s)?.value ?? NaN;
  return [
    row("Basic map wind velocity", "vb,map", FACES.map(() => fmt(project.site.vbMap, 1)), "m/s", "NA Fig. NA.1"),
    row("Site altitude", "A", FACES.map(() => fmt(project.site.altitude, 1)), "m", "NA.2.5"),
    row("Reference height", "ze", FACES.map(() => fmt(b.height, 2)), "m", "EN 7.2.2, NA.2.26"),
    row("Altitude factor", "calt", d((x) => fmt(x.top.calt, 3)), "", "NA.2.5"),
    row("Fundamental basic wind velocity", "vb,0", d((x) => fmt(x.top.vb0, 2)), "m/s", "NA.2.4"),
    row("Wind direction", "θ", d((x) => fmt(x.azimuth, 0)), "°", "Orientation"),
    row("Directional factor", "cdir", d((x) => fmt(x.cdir, 3)), "", "NA Table NA.1"),
    row("Season factor", "cseason", d((x) => fmt(x.cseason, 2)), "", "NA Table NA.2"),
    row("Probability factor", "cprob", d((x) => fmt(x.cprob, 3)), "", "EN (4.2), NA.2.8"),
    row("Basic wind velocity", "vb", d((x) => fmt(x.top.vb, 2)), "m/s", "EN (4.1)"),
    row("Basic velocity pressure", "qb", d((x) => fmt(x.top.qb, 3)), "kN/m²", "EN (4.10), ρ = 1.226"),
    row("Distance upwind to shoreline", "Ds", dirIn((k) => fmt(block?.directions[k].shorelineKm ?? NaN, 1)), "km", "NA.2.11"),
    ...(project.site.terrain === "town"
      ? [
          row("Distance inside town", "dT", dirIn((k) => fmt(block?.directions[k].townKm ?? NaN, 2)), "km", "NA Fig. NA.8"),
          row("Average height of neighbours", "have", dirIn((k) => fmt(block?.directions[k].have ?? 0, 1)), "m", "EN A.5"),
          row("Spacing to neighbours", "x", dirIn((k) => fmt(block?.directions[k].x ?? 0, 1)), "m", "EN A.5"),
        ]
      : []),
    row("Displacement height", "hdis", d((x) => fmt(x.hdis, 2)), "m", "EN A.5 (A.15)"),
    row("Effective height", "z − hdis", d((x) => fmt(x.top.zMinusHdis, 2)), "m", "NA.2.17"),
    row("Exposure factor", "ce(z)", d((x) => fmt(x.top.ce, 3)), "", "NA Fig. NA.7"),
    row("Exposure correction for town", "ce,T", d((x) => fmt(x.top.ceT, 3)), "", "NA Fig. NA.8"),
    ...(r.directions.some((x) => x.top.cs !== 1) ? [row("Size factor", "cs", d((x) => fmt(step(x, "cs"), 3)), "", "NA Table NA.3")] : []),
    row("Peak velocity pressure", "qp", d((x) => fmt(x.top.qp, 3)), "kN/m²", "NA (NA.3)"),
    row("Crosswind dimension", "b", d((x) => fmt(x.b, 2)), "m", "EN Fig. 7.5"),
    row("Depth along the wind", "d", d((x) => fmt(x.d, 2)), "m", "EN Fig. 7.5"),
    row("e = min(b, 2h)", "e", d((x) => fmt(x.e, 2)), "m", "EN Fig. 7.5"),
    row("Aspect ratio", "h/d", d((x) => fmt(x.hd, 3)), "", "NA Table NA.4"),
    ...(["A", "B", "C", "D", "E"] as const).map((z) => row(`External pressure coefficient, zone ${z}`, `cpe,${z}`, d((x) => fmt(x.cpe[z], 3)), "", "NA Table NA.4")),
    row("Zone A length", "e/5", d((x) => fmt(x.e / 5, 2)), "m", "EN Fig. 7.5"),
    row("Zone B length to", "e", d((x) => fmt(Math.min(x.e, x.d), 2)), "m", "EN Fig. 7.5"),
  ];
}

export const APPENDIX_HEAD = ["Factor", "Symbol", ...FACES.map((f) => `Wind onto ${f}`), "Unit", "Reference"];

function appendixTable(project: Project, b: ReportBlock) {
  return table(
    [
      new TableRow({ tableHeader: true, children: APPENDIX_HEAD.map((t, i) => cell(t, { header: true, align: i >= 2 && i < 6 ? "center" : "left" })) }),
      ...appendixRows(project, b).map((r) => new TableRow({ children: r.map((t, i) => cell(t, { align: i >= 1 && i < 7 ? "center" : "left" })) })),
    ],
    [2700, 1000, 950, 950, 950, 950, 750, 1650],
  );
}

export const FUNNEL_HEAD = ["Elevation", "Wind onto", "Gap (m)", "ef (m)", "ef/4 (m)", "Funnelling", "Factor"];

export function funnelRows(b: ReportBlock): string[][] {
  const rows: string[][] = [];
  for (const el of b.result.elevations) {
    const seen = new Set<string>();
    for (const c of el.cases) {
      if (!c.funnel || seen.has(c.windOnto)) continue;
      seen.add(c.windOnto);
      rows.push([
        FACE_NAMES[el.face],
        c.windOnto,
        fmt(c.funnel.gap, 2),
        fmt(c.funnel.ef, 2),
        fmt(c.funnel.ef / 4, 2),
        c.funnel.disregarded ? "Disregarded (sheltered)" : c.funnel.applies ? "Yes" : "No",
        fmt(c.funnel.factor, 2),
      ]);
    }
  }
  return rows;
}

export const NO_FUNNEL = "No gaps to facing buildings were entered; funnelling is not considered.";

function funnelTable(b: ReportBlock) {
  const rows = funnelRows(b);
  if (!rows.length) return p(NO_FUNNEL, { italics: true });
  return table([
    new TableRow({ tableHeader: true, children: FUNNEL_HEAD.map((t) => cell(t, { header: true, align: "center" })) }),
    ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, { align: i === 0 ? "left" : "center" })) })),
  ]);
}

/** Report text shared by the Word and PDF reports. */
export const SUMMARY_INTRO =
  "Design wind loads are summarised below for solid areas (for example brickwork and rainscreen, cpi = 0) and glazed areas (including internal pressure). Values are the design pressures after the CWCT minimum or banding.";

export function designNote(project: Project): string {
  return project.options.designBasis === "proprietary"
    ? "Calculated pressures up to 2400 Pa are banded to 800, 1200, 1600, 2000 or 2400 Pa for proprietary systems, as CWCT Standard for systemised building envelopes Part 2, clause 2.2.4, Table 2.1."
    : "For wind loads less than ±0.8 kN/m², the minimum design wind load on any element of the works is ±0.8 kN/m², as CWCT Standard for systemised building envelopes Part 2, clause 2.2.4, Table 2.1.";
}

export function siteBullets(project: Project): string[] {
  const s = project.site;
  return [
    `Site altitude: ${fmt(s.altitude, 1)} m above ordnance datum.`,
    `Terrain: ${s.terrain === "town" ? "Town (terrain categories III and IV)" : "Country (terrain categories I and II)"} as NA to BS EN 1991-1-4 NA.2.11.`,
    `Fundamental basic wind velocity before altitude correction vb,map = ${fmt(s.vbMap, 1)} m/s from Figure NA.1 of the UK NA to BS EN 1991-1-4 (10-minute mean at 10 m in Country terrain, annual probability of exceedance 0.02).`,
    `Orientation: the North elevation faces ${fmt(((s.orientation % 360) + 360) % 360, 0)}° from north.`,
    "Orography is not significant (NA Figure NA.2).",
  ];
}

export const SCOPE = [
  "The calculation gives the design wind loads on the façade of each block from BS EN 1991-1-4 with the UK National Annex, for the design of cladding, windows, doors, connections, brackets and fixings.",
  "Pressures are calculated for the four orthogonal wind directions; each elevation takes the most onerous of the windward (zone D), side (zones A, B, C) and leeward (zone E) cases.",
  "Thermal, movement, seismic and imposed loads are not part of this report.",
  "Roofs, parapets, canopies, balconies, inset storeys and dominant openings are not covered.",
];

export function methodology(project: Project): string[] {
  return [
    "Peak velocity pressure qp = ce(z)·ce,T·qb (NA.2.17), with qb = ½·ρ·vb² and ρ = 1.226 kg/m³ (NA.2.18). vb = cdir·cseason·cprob·vb,map·calt (EN 4.2, NA.2.4–NA.2.8).",
    project.site.cdirMethod === "unity"
      ? "The directional factor is taken as 1.0 for all directions (NA Table NA.1 Note 4)."
      : "The directional factor is the maximum of NA Table NA.1 within ±45° of the normal to each elevation (Table NA.1 Note 3).",
    "The displacement height hdis follows BS EN 1991-1-4 A.5 for Town terrain. ce(z) and ce,T are read from NA Figures NA.7 and NA.8 at z − hdis.",
    "External pressure coefficients for zones A to E follow NA Table NA.4, interpolated on h/d, with the zones of BS EN 1991-1-4 Figure 7.5 (e = min(b, 2h)).",
    "Where the walls of two buildings face each other with a gap between e/4 and e, funnelling coefficients of −1.6, −0.9 and −0.9 apply to zones A, B and C (NA.2.27 notes d and e).",
    `Internal pressure is taken as the more onerous of +${project.options.cpi?.positive ?? 0.2} and ${project.options.cpi?.negative ?? -0.3} for glazed areas (BS EN 1991-1-4 7.2.9(6) Note 2) and as zero for solid and rainscreen areas (CWCT Part 2, 2.2.5.1).`,
    project.options.verticalZoning
      ? "Zone D is divided vertically in accordance with BS EN 1991-1-4 Figure 7.4."
      : "In accordance with CWCT Part 2 clause 2.2.3 there is no horizontal zoning of wind pressure; the reference height is the building height for all zones (NA.2.26).",
  ];
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

export function reportBlocks(project: Project, run: (p: Project, i: number) => WindResult): ReportBlock[] {
  const out: ReportBlock[] = [];
  project.blocks.forEach((b, i) => {
    const r = run(project, i);
    if (r.ok) out.push({ name: b.name, height: b.building.height, widthNS: b.building.widthNS, widthEW: b.building.widthEW, result: r });
  });
  return out;
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

export { toWindInput };
