import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runWind, type WindInput, type WindResult } from "@wind/engine";

export interface ValidationCase {
  name: string;
  description: string;
  /** Printed values from the source document and why they differ from the exact working. */
  reference?: { source: string; printed: Record<string, number | string>; gap: string };
  input: WindInput;
  /**
   * Expected numbers. A key is either a dotted path into the result (e.g. "directions.0.top.qp")
   * or "case:<elevation>:<zone>:<wind onto>:<dotted path in the zone case>".
   */
  expected: Record<string, number>;
  tolerance: { relative: number };
}

export interface Mismatch {
  key: string;
  expected: number | string;
  actual: number | string | undefined;
}

export interface CaseOutcome {
  file: string;
  name: string;
  ok: boolean;
  mismatches: Mismatch[];
}

export function loadCases(dir: string): { file: string; data: ValidationCase }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({ file, data: JSON.parse(readFileSync(join(dir, file), "utf8")) as ValidationCase }));
}

const close = (a: number, b: number, rel: number) => Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-9);

function dig(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

/** Looks up an expected key in a result (see ValidationCase.expected). */
export function lookup(r: Extract<WindResult, { ok: true }>, key: string): unknown {
  if (!key.startsWith("case:")) return dig(r, key);
  const [, elev, zone, onto, ...rest] = key.split(":");
  const c = r.elevations.find((e) => e.face === elev)?.cases.find((x) => x.zone === zone && x.windOnto === onto);
  return dig(c, rest.join(":"));
}

/** Run one case through the engine and compare every expected number. */
export function runCase(file: string, c: ValidationCase): CaseOutcome {
  const mismatches: Mismatch[] = [];
  const r = runWind(c.input);
  if (!r.ok) {
    mismatches.push({ key: "errors", expected: "none", actual: r.errors.join("; ") });
    return { file, name: c.name, ok: false, mismatches };
  }
  for (const [key, want] of Object.entries(c.expected)) {
    const got = lookup(r, key);
    if (typeof got !== "number" || !close(got, want, c.tolerance.relative)) mismatches.push({ key, expected: want, actual: got as number | undefined });
  }
  return { file, name: c.name, ok: mismatches.length === 0, mismatches };
}
