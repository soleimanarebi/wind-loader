import type { ElevationResult, Envelope, Face, WindResult, Zone, ZoneCase } from "@wind/engine";

type Ok = Extract<WindResult, { ok: true }>;

export const FACE_NAMES: Record<Face, string> = { N: "North", E: "East", S: "South", W: "West" };

export const fmt = (v: number, d = 2) => (Object.is(Math.round(v * 10 ** d), -0) ? 0 : v).toFixed(d);
export const signed = (v: number, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v), d)}`;

/** A coloured strip on an elevation: a horizontal range with the net pressure that governs it. */
export interface Segment {
  from: number;
  to: number;
  zFrom: number;
  zTo: number;
  value: number;
  label: string;
  zone: Zone | "env";
}

/** Diverging colour for a net pressure: blue for pressure, red for suction, scaled to `max`. */
export function pressureColour(w: number, max: number): string {
  const t = Math.min(Math.abs(w) / Math.max(max, 1e-6), 1);
  const mix = (a: number[], b: number[]) => a.map((x, i) => Math.round(x + (b[i]! - x) * t));
  const neutral = [236, 240, 243];
  const c = w >= 0 ? mix(neutral, [30, 96, 170]) : mix(neutral, [196, 46, 40]);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Zones on one elevation for wind onto `onto` (the D/E/A–C layout for that direction). */
export function zoneSegments(el: ElevationResult, onto: Face, env: Envelope): Segment[] {
  return el.cases
    .filter((c) => c.windOnto === onto)
    .map((c) => {
      const w = Math.abs(c.net[env].suction) > Math.abs(c.net[env].pressure) ? c.net[env].suction : c.net[env].pressure;
      return { from: c.from, to: c.to, zFrom: c.zFrom, zTo: c.zTo, value: w, label: c.zone + (c.funnel?.applies ? "f" : ""), zone: c.zone };
    });
}

/** Envelope view: corner strips with the zone A suction, and the general area with the general suction. */
export function envelopeSegments(el: ElevationResult, env: Envelope, h: number): Segment[] {
  const s = el.summary[env];
  const cw = Math.min(s.cornerWidth, el.width / 2);
  const general = { from: cw, to: el.width - cw, zFrom: 0, zTo: h, value: s.ws.value, label: "general", zone: "env" as const };
  if (cw <= 0 || s.wsA.zone === null) return [{ ...general, from: 0, to: el.width }];
  return [
    { from: 0, to: cw, zFrom: 0, zTo: h, value: s.wsA.value, label: "A", zone: "A" },
    general,
    { from: el.width - cw, to: el.width, zFrom: 0, zTo: h, value: s.wsA.value, label: "A", zone: "A" },
  ];
}

export function maxMagnitude(r: Ok, env: Envelope): number {
  let m = 0;
  for (const el of r.elevations) for (const c of el.cases) m = Math.max(m, Math.abs(c.net[env].pressure), Math.abs(c.net[env].suction));
  return m;
}

/** Governing case for a zone on an elevation (most negative suction, else largest pressure). */
export function governingCase(el: ElevationResult, zone: Zone, env: Envelope): ZoneCase | undefined {
  const cs = el.cases.filter((c) => c.zone === zone);
  if (!cs.length) return undefined;
  return cs.reduce((g, c) => (Math.min(c.net[env].suction, -c.net[env].pressure) < Math.min(g.net[env].suction, -g.net[env].pressure) ? c : g));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * SVG mark-up of one elevation in the style of a façade wind load drawing: corner zones with their
 * width and suction, the general area, and the design values to CWCT. Standalone (fixed colours),
 * so the same string is used on screen and in the Word report.
 */
export function elevationSvg(el: ElevationResult, env: Envelope, h: number, title: string): string {
  const s = el.summary[env];
  const W = 640;
  const H = 360;
  const pad = { l: 40, r: 40, t: 78, b: 50 };
  const scale = Math.min((W - pad.l - pad.r) / el.width, (H - pad.t - pad.b) / h);
  const bw = el.width * scale;
  const bh = h * scale;
  const x0 = (W - bw) / 2;
  const y0 = pad.t + (H - pad.t - pad.b - bh);
  const cw = Math.min(s.cornerWidth, el.width / 2) * scale;
  const red = "#c42e28";
  const ink = "#172329";
  const muted = "#56666e";
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">`);
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(`<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#eef3f6" stroke="${ink}" stroke-width="1.5"/>`);
  // Storey-like guide lines every 3 m for scale.
  for (let z = 3; z < h; z += 3) {
    const y = y0 + bh - z * scale;
    parts.push(`<line x1="${x0}" y1="${y}" x2="${x0 + bw}" y2="${y}" stroke="#c9d6dc" stroke-dasharray="4 4"/>`);
  }
  const fmtKPa = (v: number) => `${signed(v, 2)} kPa`;
  if (cw > 0 && s.wsA.zone) {
    for (const x of [x0, x0 + bw - cw]) parts.push(`<rect x="${x}" y="${y0}" width="${cw}" height="${bh}" fill="${red}" fill-opacity="0.28" stroke="${red}"/>`);
    const wCorner = fmt(s.cornerWidth, 2);
    if (bw >= 360) {
      // Wide elevation: a label over each corner zone.
      for (const [x, anchor] of [
        [x0, "start"],
        [x0 + bw, "end"],
      ] as const) {
        parts.push(`<text x="${x}" y="${y0 - 27}" font-size="14" fill="${red}" text-anchor="${anchor}">Ws = ${fmtKPa(s.wsA.design)}</text>`);
        parts.push(`<text x="${x}" y="${y0 - 9}" font-size="13" font-weight="bold" fill="${red}" text-anchor="${anchor}">← ${wCorner} m →</text>`);
      }
    } else {
      // Narrow elevation: one line for both corners, below the general values.
      parts.push(`<text x="${W / 2}" y="${y0 - 9}" font-size="14" fill="${red}" text-anchor="middle">Corners: Ws = ${fmtKPa(s.wsA.design)} over ${wCorner} m</text>`);
    }
  }
  const narrow = bw < 360 && cw > 0 && s.wsA.zone !== null;
  parts.push(`<text x="${W / 2}" y="${y0 - (narrow ? 50 : 44)}" font-size="15" fill="${ink}" text-anchor="middle">Wp = ${fmtKPa(s.wp.design)}</text>`);
  parts.push(`<text x="${W / 2}" y="${y0 - (narrow ? 31 : 25)}" font-size="15" fill="${ink}" text-anchor="middle">Ws = ${fmtKPa(s.ws.design)}</text>`);
  parts.push(`<text x="${W / 2}" y="${y0 + bh + 18}" font-size="13" fill="${muted}" text-anchor="middle">${fmt(el.width, 2)} m wide × ${fmt(h, 2)} m high${s.funnelling ? " · funnelling included" : ""}</text>`);
  parts.push(`<text x="${W / 2}" y="${H - 10}" font-size="16" font-weight="bold" fill="${ink}" text-anchor="middle">${esc(title)}</text>`);
  parts.push(`</svg>`);
  return parts.join("");
}
