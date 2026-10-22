"""Independent hand calculations for the validation cases (no engine code).

Writes validation/cases/*.json. Run: python3 -I validation/scripts/expected.py
Follows the expressions as printed in BS EN 1991-1-4:2005+A1:2010 and its UK NA. ce and ce,T
are taken from the source documents' own chart readings (entered as overrides), so the cases
check the arithmetic chain; the digitised charts are compared separately in `reference`.
"""
import json, math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "cases")
RHO = 1.226
CDIR = [0.78, 0.73, 0.73, 0.74, 0.73, 0.80, 0.85, 0.93, 1.00, 0.99, 0.91, 0.82]
OFF = {"N": 0, "E": 90, "S": 180, "W": 270}
LEFT = {"N": "E", "E": "S", "S": "W", "W": "N"}
RIGHT = {"N": "W", "E": "N", "S": "E", "W": "S"}
OPP = {"N": "S", "E": "W", "S": "N", "W": "E"}


def cdir_at(t):
    t %= 360
    i = int(t // 30)
    a, b = CDIR[i % 12], CDIR[(i + 1) % 12]
    return a + (b - a) * (t - 30 * i) / 30


def cdir_orth(t):
    pts = [t - 45 + k * 0.01 for k in range(0, 9001)]  # 0.01° scan: independent of the engine's corner search
    return max(cdir_at(p) for p in pts)


def calt(A, z):
    return 1 + 0.001 * A if z <= 10 else 1 + 0.001 * A * (10 / z) ** 0.2


def cpe(hd):
    tab = {"A": (-1.2, -1.2, -1.2), "B": (-0.8, -0.8, -0.8), "C": (-0.5, -0.5, -0.5), "D": (0.7, 0.8, 0.8), "E": (-0.3, -0.5, -0.7)}
    out = {}
    for z, (v1, v2, v3) in tab.items():
        if hd <= 0.25: out[z] = v1
        elif hd <= 1: out[z] = v1 + (v2 - v1) * (hd - 0.25) / 0.75
        elif hd <= 5: out[z] = v2 + (v3 - v2) * (hd - 1) / 4
        else: out[z] = v3
    return out


def width(b, f):
    return b["widthNS"] if f in "NS" else b["widthEW"]


def direction(inp, f):
    s, b, d = inp["site"], inp["building"], inp["directions"][f]
    o = d.get("overrides", {})
    h = b["height"]
    t = (s["orientation"] + OFF[f]) % 360
    cd = o.get("cdir", cdir_orth(t))
    vb = cd * s["vbMap"] * calt(s["altitude"], h)
    qb = 0.5 * RHO * vb * vb / 1000
    qp = o["ce"] * o.get("ceT", 1.0) * qb
    bb = width(b, f)
    dd = width(b, LEFT[f])
    e = min(bb, 2 * h)
    return {"theta": t, "cdir": cd, "vb": vb, "qb": qb, "qp": qp, "b": bb, "d": dd, "e": e, "cpe": cpe(h / dd)}


def net_sealed(qp, c, cpi=(0.2, -0.3)):
    vals = [qp * c - qp * x for x in cpi]
    return max(vals), min(vals)


def write(name, case):
    with open(os.path.join(OUT, name), "w") as fh:
        json.dump(case, fh, indent=2)
        fh.write("\n")


# --- Case 1: Report A, main cladding (RA §2.3, p.10) -----------------------------
ra = {
    "site": {"vbMap": 21.6, "altitude": 48, "terrain": "town", "orientation": -41},
    "building": {"name": "Report A main block", "widthNS": 55, "widthEW": 60, "height": 28},
    "directions": {
        # Printed ce readings; dT = 0.1 km gives ce,T = 1.00; have = 0 so hdis = 0.
        "N": {"shorelineKm": 100, "townKm": 0.1, "have": 0, "x": 20, "gap": 28, "overrides": {"ce": 2.99, "ceT": 1.0}},
        "E": {"shorelineKm": 60, "townKm": 0.1, "have": 0, "x": 20, "gap": 27.5, "overrides": {"ce": 3.01, "ceT": 1.0}},
        "S": {"shorelineKm": 100, "townKm": 0.1, "have": 0, "x": 20, "gap": 28, "overrides": {"ce": 2.99, "ceT": 1.0}},
        "W": {"shorelineKm": 100, "townKm": 0.1, "have": 0, "x": 20, "gap": 27.5, "overrides": {"ce": 2.99, "ceT": 1.0}},
    },
    "options": {"funnelling": "conservative"},
}
exp = {}
printed = {}
for i, f in enumerate("NESW"):
    r = direction(ra, f)
    exp[f"directions.{i}.cdir"] = r["cdir"]
    exp[f"directions.{i}.top.vb"] = r["vb"]
    exp[f"directions.{i}.top.qp"] = r["qp"]
    exp[f"directions.{i}.cpe.D"] = r["cpe"]["D"]
    exp[f"directions.{i}.cpe.E"] = r["cpe"]["E"]
    # Wind onto f: D on f, E on the opposite face, funnelled A/B/C on both side faces.
    exp[f"case:{f}:D:{f}:net.sealed.pressure"] = net_sealed(r["qp"], r["cpe"]["D"])[0]
    exp[f"case:{OPP[f]}:E:{f}:net.sealed.suction"] = net_sealed(r["qp"], r["cpe"]["E"])[1]
    for side in (LEFT[f], RIGHT[f]):
        exp[f"case:{side}:A:{f}:net.sealed.suction"] = net_sealed(r["qp"], -1.6)[1]
        exp[f"case:{side}:B:{f}:net.sealed.suction"] = net_sealed(r["qp"], -0.9)[1]
printed = {
    "column order": "North, West, South, East (wind direction 319, 229, 139, 49)",
    "cdir": "0.98, 1.00, 0.86, 0.77",
    "vb (m/s)": "21.98, 22.41, 19.32, 17.36",
    "qp (kN/m²)": "0.88, 0.92, 0.68, 0.55",
    "cpe,D / cpe,E": "0.73 / -0.36 (N, S), 0.73 / -0.37 (W, E)",
    "wnet,A": "-1.59, -1.65, -1.23, -1.00",
    "wnet,B = wnet,C": "-0.97, -1.01, -0.75, -0.61",
    "wnet,D": "0.91, 0.95, 0.70, 0.57",
    "wnet,E": "-0.49, -0.52, -0.38, -0.32",
}
write("01-project-report-a.json", {
    "name": "Report A, main cladding (RA §2.3)",
    "description": "Town site, vb,map 21.6 m/s, A = 48 m, h = 28 m, 55 × 60 m plan rotated -41°, funnelling on all faces, cpi +0.2/-0.3. The report's ce readings are entered by hand; cdir, cpe and the net pressures are calculated.",
    "reference": {
        "source": "RA §2.3 table, p.10",
        "printed": printed,
        "gap": "All printed values agree to the second decimal, allowing for the report truncating rather than rounding some values (qp N 0.8856 printed 0.88). Without the overrides, the digitised Figure NA.7 gives ce = 2.991 (N, S, W) and 3.034 (E, 60 km) against the printed 2.99 and 3.01; the E reading differs by 0.8%, within chart reading tolerance (OQ-01).",
    },
    "input": ra,
    "expected": exp,
    "tolerance": {"relative": 1e-5},
})

# --- Case 2: Report B, Block A (Report B spreadsheet, sheet "Block A") ---------------------
rb = {
    "site": {"vbMap": 23.5, "altitude": 43, "terrain": "town", "orientation": -10},
    "building": {"name": "Report B Block A", "widthNS": 16.8, "widthEW": 35.32, "height": 17.66},
    "directions": {
        "N": {"shorelineKm": 55, "townKm": 5, "have": 17, "x": 27.1, "overrides": {"cdir": 0.91, "ce": 2.12, "ceT": 0.73, "hdis": 10.2}},
        "E": {"shorelineKm": 43, "townKm": 5, "have": 17, "x": 104, "overrides": {"cdir": 0.74, "ce": 2.8, "ceT": 0.82, "hdis": 0}},
        "S": {"shorelineKm": 25, "townKm": 5, "have": 17, "x": 122, "overrides": {"cdir": 0.93, "ce": 2.8, "ceT": 0.82, "hdis": 0}},
        "W": {"shorelineKm": 80, "townKm": 5, "have": 17, "x": 11.2, "overrides": {"cdir": 1.0, "ce": 2.1, "ceT": 0.73, "hdis": 10.2}},
    },
}
exp = {}
for i, f in enumerate("NESW"):
    r = direction(rb, f)
    exp[f"directions.{i}.top.qp"] = r["qp"]
    exp[f"directions.{i}.top.calt"] = calt(43, 17.66)
write("02-project-report-b.json", {
    "name": "Report B, Block A peak velocity pressures (Report B spreadsheet)",
    "description": "Town site, vb,map 23.5 m/s, A = 43 m, z = 17.66 m, orientation -10°. The spreadsheet's cdir, ce, ce,T and hdis are entered by hand; qp is compared.",
    "reference": {
        "source": "Report B spreadsheet, sheet Block A, rows 3-22",
        "printed": {"qp N, E, S, W (kN/m²)": "0.4769, 0.4679, 0.7390, 0.5705", "rho (kg/m³)": 1.25},
        "gap": "The spreadsheet uses ρ = 1.25 kg/m³ (EN recommended value); the UK NA.2.18 value is 1.226, so the engine's qp is 1.226/1.25 = 0.9808 of the spreadsheet's. The spreadsheet also takes hdis = 0.6·have = 10.2 m where A.15 gives min(0.8·have, 0.6·h) = 10.6 m, and reads cdir at the tabulated direction nearest the normal rather than the maximum within ±45° (e.g. N 0.91 against 0.895); both are entered as printed here. Its cpe values are fixed (E = -0.6) rather than interpolated in h/d, and are not compared.",
    },
    "input": rb,
    "expected": exp,
    "tolerance": {"relative": 1e-5},
})
print("cases written")
