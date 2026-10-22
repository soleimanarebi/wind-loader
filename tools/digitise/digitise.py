"""Digitise Figures NA.7 and NA.8 of the NA to BS EN 1991-1-4:2005+A1:2010 from the PDF's vector paths.

Usage: python3 -I digitise.py <path to NA PDF>  -> prints JSON grids to stdout.
Each contour is rebuilt from the stroked paths (line width 1.417 pt) and labelled by the
value printed in the white label box it passes through. Values on a grid of heights and
distances are then interpolated between neighbouring contours along each vertical,
linearly in log(z - hdis).
"""
import json, math, sys
import pdfplumber

def bez(p0, p1, p2, p3, n=24):
    out = []
    for i in range(n + 1):
        t = i / n
        a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t * t; d = t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out

def segments(pg):
    segs = []
    for l in pg.lines:
        if abs(l.get("linewidth", 0) - 1.417) < 0.01:
            segs.append([(l["x0"], l["top"]), (l["x1"], l["bottom"])] if l["y0"] == l["y1"] or True else None)
            # pdfplumber gives bbox; use the actual points
            segs[-1] = [(x, y) for x, y in l["pts"]]
    for c in pg.curves:
        if abs((c.get("linewidth") or 0) - 1.417) > 0.01:
            continue
        pts = []
        cur = None
        for cmd in c["path"]:
            if cmd[0] == "m":
                cur = cmd[1]; pts.append(cur)
            elif cmd[0] == "l":
                cur = cmd[1]; pts.append(cur)
            elif cmd[0] == "c":
                pts.extend(bez(cur, cmd[1], cmd[2], cmd[3])[1:]); cur = cmd[3]
        segs.append(pts)
    return segs

def chain(segs, tol=1.0):
    chains = [list(s) for s in segs]
    merged = True
    while merged:
        merged = False
        for i in range(len(chains)):
            for j in range(len(chains)):
                if i == j or not chains[i] or not chains[j]:
                    continue
                a, b = chains[i], chains[j]
                d = lambda p, q: math.hypot(p[0] - q[0], p[1] - q[1])
                if d(a[-1], b[0]) < tol: chains[i] = a + b[1:]
                elif d(a[-1], b[-1]) < tol: chains[i] = a + b[::-1][1:]
                elif d(a[0], b[-1]) < tol: chains[i] = b + a[1:]
                elif d(a[0], b[0]) < tol: chains[i] = b[::-1] + a[1:]
                else: continue
                chains[j] = []
                merged = True
    return [c for c in chains if len(c) > 1]

def y_at(chain, x):
    """All y where the polyline crosses the vertical at x."""
    ys = []
    for (x0, y0), (x1, y1) in zip(chain, chain[1:]):
        if (x0 - x) * (x1 - x) <= 0 and x0 != x1:
            ys.append(y0 + (y1 - y0) * (x - x0) / (x1 - x0))
    return ys

def digitise(pg, box, xr, yr, labels_px, boundary=None):
    x0, top, x1, bot = box
    X = lambda v: x0 + (math.log10(v) - math.log10(xr[0])) / (math.log10(xr[1]) - math.log10(xr[0])) * (x1 - x0)
    Y = lambda z: bot - (math.log10(z) - math.log10(yr[0])) / (math.log10(yr[1]) - math.log10(yr[0])) * (bot - top)
    Yinv = lambda py: 10 ** (math.log10(yr[0]) + (bot - py) / (bot - top) * (math.log10(yr[1]) - math.log10(yr[0])))
    chains = chain(segments(pg))
    if boundary:
        chains.append(boundary)
    labelled = []
    for value, (lx0, ltop, lx1, lbot) in labels_px:
        cx = (lx0 + lx1) / 2; cy = (ltop + lbot) / 2
        best = None
        for c in chains:
            for y in y_at(c, cx):
                if best is None or abs(y - cy) < best[0]:
                    best = (abs(y - cy), c)
        assert best and best[0] < 8, (value, best and best[0])
        labelled.append((value, best[1]))
    return labelled, X, Y, Yinv

def grid(labelled, X, Yinv, xs, zs, edge_value=None):
    """For each distance x and height z, interpolate between the contours bracketing z."""
    out = []
    for z in zs:
        row = []
        for x in xs:
            # Contours stop at the plot frame, so read the edge columns and rows just inside it.
            px = min(max(X(x), X(xs[0]) + 1.0), X(xs[-1]) - 1.0)
            pts = []
            for v, c in labelled:
                ys = y_at(c, min(max(px, c[0][0] if False else px), px))
                for y in ys:
                    pts.append((math.log10(Yinv(y)), v))
            pts.sort()
            lz = math.log10(min(max(z, zs[0] * 1.003), zs[-1] / 1.003))
            val = None
            for (za, va), (zb, vb) in zip(pts, pts[1:]):
                if za <= lz <= zb and zb > za:
                    val = va + (vb - va) * (lz - za) / (zb - za)
                    break
            if val is None and pts:
                # outside the contour range on this vertical: take the nearest contour (edge of chart)
                val = edge_value if edge_value is not None and lz > pts[-1][0] else (pts[0][1] if lz < pts[0][0] else pts[-1][1])
            row.append(None if val is None else round(val, 3))
        out.append(row)
    return out

def labels(pg, box):
    out = []
    words = [w for w in pg.extract_words() if box[0] < w["x0"] < box[2] and box[1] < w["top"] < box[3]]
    for w in words:
        if w["text"] == "1.0":  # "Use 1.0 in this area" note on Figure NA.8, not a contour label
            continue
        try: v = float(w["text"])
        except ValueError: continue
        out.append((v, (w["x0"], w["top"], w["x1"], w["bottom"])))
    return out

if __name__ == "__main__":
    pdf = pdfplumber.open(sys.argv[1])
    res = {}
    # Figure NA.7 (printed page 13): plot frame and axes read from the page's grid lines and tick labels.
    pg = pdf.pages[16]
    box7 = (137.0, 282.1, 482.1, 709.6)
    lab7 = labels(pg, box7)
    l7, X7, Y7, Yi7 = digitise(pg, box7, (0.1, 100), (2, 200), lab7)
    xs = [0.1, 0.2, 0.3, 0.5, 0.7, 1, 2, 3, 5, 7, 10, 20, 30, 50, 70, 100]
    zs = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 200]
    def to_axes(path, X, Yi, box, xr):
        x0, x1 = box[0], box[2]
        lx = lambda px: 10 ** (math.log10(xr[0]) + (px - x0) / (x1 - x0) * (math.log10(xr[1]) - math.log10(xr[0])))
        return [[round(lx(px), 4), round(Yi(py), 3)] for px, py in path]
    fill7 = max((c for c in pg.curves if not c.get("stroke")), key=lambda c: len(c["pts"]))
    edge7 = [cmd[1] if cmd[0] != "c" else cmd[3] for cmd in fill7["path"] if cmd[0] in ("m", "l", "c")]
    res["NA7"] = {"zoneA": to_axes(edge7, X7, Yi7, box7, (0.1, 100)),"distanceKm": xs, "zMinusHdis": zs, "ce": grid(l7, X7, Yi7, xs, zs), "contours": sorted(v for v, _ in l7)}
    # Figure NA.8 (printed page 14)
    pg = pdf.pages[17]
    box8 = tuple(json.loads(sys.argv[2])) if len(sys.argv) > 2 else None
    if box8:
        lab8 = labels(pg, box8)
        # The ce,T = 1.0 contour is the edge of the shaded "use 1.0" area, drawn as a filled path.
        fill = max((c for c in pg.curves if not c.get("stroke")), key=lambda c: len(c["pts"]))
        edge = [cmd[1] for cmd in fill["path"] if cmd[0] in ("m", "l")]
        l8, X8, Y8, Yi8 = digitise(pg, box8, (0.1, 20), (2, 200), lab8, boundary=edge)
        xs8 = [0.1, 0.2, 0.3, 0.5, 0.7, 1, 2, 3, 5, 7, 10, 15, 20]
        res["NA8"] = {"zoneAorB": to_axes(edge, X8, Yi8, box8, (0.1, 20)),"distanceKm": xs8, "zMinusHdis": zs, "ceT": grid(l8, X8, Yi8, xs8, zs, edge_value=1.0), "contours": sorted(v for v, _ in l8)}
    print(json.dumps(res))
