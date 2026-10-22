"""Turn the digitiser's JSON into packages/engine/src/data/charts.ts.

Usage: python3 -I emit_ts.py grids.json > ../../packages/engine/src/data/charts.ts
"""
import json, sys

d = json.load(open(sys.argv[1]))

def boundary(pts, xmax):
    # Keep the diagonal edge of the shaded area; drop the points on the plot frame.
    keep = [(x, z) for x, z in pts if not (x < 0.1007 and z > 4.0) and not (z > 199.0 and x < xmax * 0.99) and not (x > xmax * 0.99 and z > 122.0)]
    keep = sorted(set((round(x, 4), round(z, 3)) for x, z in keep))
    return [list(p) for p in keep]

def rows(m):
    return ",\n".join("    [" + ", ".join(f"{v:.3f}" for v in r) + "]" for r in m)

na7, na8 = d["NA7"], d["NA8"]
print('''import { src } from "./sources";

/*
 * Figures NA.7 and NA.8 of the NA to BS EN 1991-1-4:2005+A1:2010, digitised from the vector
 * contours in the PDF by tools/digitise/digitise.py (calc-spec §4.3, OQ-01). Each grid value is
 * interpolated between the two printed contours that bracket it on the same vertical, linearly in
 * log(z - hdis). Below the lowest printed contour the lowest contour value is held (conservative).
 * Generated file: rerun the digitiser rather than editing by hand.
 */
''')
print(f'''export const FIG_NA7 = {{
  source: src("NA", "Figure NA.7 Values of ce(z) (digitised, OQ-01)", 13),
  /** Distance upwind to shoreline, km (columns). */
  distanceKm: {json.dumps(na7["distanceKm"])},
  /** z - hdis, m (rows). */
  zMinusHdis: {json.dumps(na7["zMinusHdis"])},
  /** Printed contour values, for reference. */
  contours: {json.dumps(na7["contours"])},
  ce: [
{rows(na7["ce"])},
  ],
  /** Lower edge of the shaded zone A (Table NA.3), as [distance km, z - hdis m]; zone A lies above it. */
  zoneAEdge: {json.dumps(boundary(na7["zoneA"], 100))} as [number, number][],
}} as const;

export const FIG_NA8 = {{
  source: src("NA", "Figure NA.8 Values of exposure correction factor ce,T (digitised, OQ-01)", 14),
  /** Distance inside town terrain, km (columns). */
  distanceKm: {json.dumps(na8["distanceKm"])},
  zMinusHdis: {json.dumps(na8["zMinusHdis"])},
  contours: {json.dumps(na8["contours"])},
  ceT: [
{rows(na8["ceT"])},
  ],
  /** Edge of the shaded "use 1.0" area (zone A or B); zone C lies below it. */
  zoneCEdge: {json.dumps(boundary(na8["zoneAorB"], 20))} as [number, number][],
}} as const;''')
