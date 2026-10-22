import { FACES, type DirectionResult, type Envelope, type WindResult } from "@wind/engine";
import type { Project } from "./project";
import { FACE_NAMES, fmt, signed } from "./viz";

/** Report content shared by the PDF and Word reports: tables as rows of strings, and the text. */

type Ok = Extract<WindResult, { ok: true }>;

export interface ReportBlock {
  name: string;
  height: number;
  widthNS: number;
  widthEW: number;
  result: Ok;
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

export function reportBlocks(project: Project, run: (p: Project, i: number) => WindResult): ReportBlock[] {
  const out: ReportBlock[] = [];
  project.blocks.forEach((b, i) => {
    const r = run(project, i);
    if (r.ok) out.push({ name: b.name, height: b.building.height, widthNS: b.building.widthNS, widthEW: b.building.widthEW, result: r });
  });
  return out;
}

