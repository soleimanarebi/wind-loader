import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runWind } from "@wind/engine";
import { describe, expect, it } from "vitest";
import { loadCases, lookup, runCase } from "../src/harness";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "cases");
const cases = loadCases(dir);

describe("validation cases", () => {
  it("has the worked-example cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(2);
  });
  for (const { file, data } of cases) {
    it(`${file}: ${data.name}`, () => {
      expect(runCase(file, data).mismatches).toEqual([]);
    });
  }
});

describe("Report A with the digitised charts (no overrides)", () => {
  const ra = cases.find((c) => c.file.startsWith("01"))!.data;
  const input = structuredClone(ra.input);
  for (const d of Object.values(input.directions)) delete d.overrides;
  const r = runWind(input);
  // Printed in RA §2.3 (N, E, S, W order here).
  const printed = { qp: [0.88, 0.55, 0.68, 0.92], A: [-1.59, -1.0, -1.23, -1.65], D: [0.91, 0.57, 0.7, 0.95] };
  it("agrees with the printed qp and net pressures within 2%", () => {
    if (!r.ok) throw new Error(r.errors.join());
    ["N", "E", "S", "W"].forEach((f, i) => {
      const side = { N: "E", E: "S", S: "W", W: "N" }[f]!;
      const qp = lookup(r, `directions.${i}.top.qp`) as number;
      const a = lookup(r, `case:${side}:A:${f}:net.sealed.suction`) as number;
      const d = lookup(r, `case:${f}:D:${f}:net.sealed.pressure`) as number;
      expect(Math.abs(qp / printed.qp[i]! - 1)).toBeLessThan(0.02);
      expect(Math.abs(a / printed.A[i]! - 1)).toBeLessThan(0.02);
      expect(Math.abs(d / printed.D[i]! - 1)).toBeLessThan(0.02);
    });
  });
});

describe("harness", () => {
  it("reports a mismatch when an expected value is wrong", () => {
    const { file, data } = cases[0]!;
    const broken = structuredClone(data);
    const key = Object.keys(broken.expected)[0]!;
    broken.expected[key]! *= 1.01;
    const o = runCase(file, broken);
    expect(o.ok).toBe(false);
    expect(o.mismatches[0]).toMatchObject({ key });
  });
});
