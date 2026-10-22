# Open questions

Every value or rule the documents leave open, and how release 1 handles it.

## OQ-01: digitised Figures NA.7 and NA.8
The NA gives ce(z) and ce,T only as charts (NA.2.17). PD 6688-1-4 2.7 confirms there are no closed
forms for static structures. `tools/digitise/digitise.py` rebuilds every printed contour from the
vector paths in the NA PDF, labels it from the printed value, and interpolates a grid between
contours (linear in log(z − hdis)). Below the lowest printed contour (ce 1.5, ce,T 0.66), the lowest
contour value is held, which is conservative. Checks: Brent Cross Plot 202 ce = 2.99 at 100 km /
28 m (engine 2.993); PD 6688-1-4 example ce ≈ 3.23 at 30 km / 33 m (engine 3.21); Brent Cross E
3.01 at 60 km / 28 m (engine 3.034, 0.8%). Users can override ce and ce,T per direction.

## OQ-02: cdir for orthogonal load cases
NA Table NA.1 Note 3 takes the maximum within ±45° of the normal. The engine evaluates the ends
of the range and every tabulated direction inside it (the maximum of a piecewise-linear function).
The ISCA spreadsheet reads the nearest tabulated value instead (N 0.91 vs 0.895; S 0.93 vs 0.942).
Brent Cross matches the engine.

## OQ-03: air density
NA.2.18 gives ρ = 1.226 kg/m³. The ISCA spreadsheet uses the EN recommended 1.25 (2% higher qp).
The engine uses 1.226 and does not offer an override.

## OQ-04: displacement height cap
EN A.15 gives min(0.8·have, 0.6·h) for x ≤ 2·have. The ISCA spreadsheet uses 0.6·have. The engine
follows A.15; hdis can be overridden.

## OQ-05: middle strip of Figure 7.4
With vertical zoning switched on and h > 2b, the middle region is one strip at ze = h − b
(conservative). Release 1 does not subdivide it. Vertical zoning is off by default (CWCT 2.2.3).

## OQ-06: inset storeys and irregular faces
PD 6688-1-4 3.3 gives reference heights and accelerated zone E suction at inset storeys, used in the
Brent Cross report (§2.4). Not in release 1; the engine lists it under "not covered".

## OQ-07: funnelling disregard for the facing building
NA.2.27 note d 3) applies the (ze − hdis) < 0.4ze test to the lower of the two buildings. The
engine uses the facing building's height when given, but this direction's hdis for both buildings.

## OQ-08: size factor zone near the chart edges
Table NA.3 zones are read from the shaded areas of Figures NA.7 and NA.8 (digitised edges). The
edge of zone A beyond 68 km is held at its last digitised point. The size factor is off by default.

## OQ-09: internal pressure from opening ratio
EN Figure 7.13 (cpi from μ and h/d) is not implemented; release 1 uses the Note 2 values +0.2/−0.3
as defaults, editable by the user.
