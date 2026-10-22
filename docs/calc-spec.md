# Wind Loader: calculation spec, release 1

The engine implements this spec and nothing else. Change the spec first and the code second.
Every clause reference points at the documents listed in §10. Open points are logged in
`open-questions.md` as OQ-xx.

## 1. Scope

Release 1 calculates wind pressures on the vertical walls of rectangular-plan buildings for
façade design, using BS EN 1991-1-4:2005+A1:2010 with the UK National Annex and the CWCT
Standard for systemised building envelopes, Part 2.

The calculation covers the following:
- Peak velocity pressure qp for the four orthogonal wind directions, for sites in Country or
  Town terrain where orography is not significant.
- External pressure coefficients for zones A to E of vertical walls (EN Figure 7.5, NA
  Table NA.4), including funnelling between facing buildings (NA.2.27 notes d and e).
- Net pressures for three envelope types: sealed or glazed (internal pressure acts), drained
  and ventilated rainscreen, and pressure-equalised rainscreen.
- The design wind pressure to CWCT Part 2, clause 2.2.4 (the 800 Pa minimum and the banding
  of proprietary systems).

These are out of scope for release 1, and the engine reports them as not covered:
- Sites where orography is significant (NA.2.13, NA Figure NA.2).
- Roofs, parapets, canopies, balconies, free-standing walls, and dynamic or tall buildings
  (h > 200 m, or z − hdis outside the 2–200 m range of Figure NA.7).
- Dominant openings (EN 7.2.9(3)–(5)).
- Inset storeys and irregular faces (PD 6688-1-4 3.3), which are logged as OQ-06.

## 2. Units

Inside the engine, lengths are in m and distances to the shoreline or the town edge in km.
Speeds are in m/s and pressures in kN/m² (equal to kPa). Angles are in degrees, measured
clockwise from north. The CWCT thresholds are given in Pa and are converted at the data
edge (1 kPa = 1000 Pa).

## 3. Inputs

### 3.1 Site
| Input | Symbol | Source |
|---|---|---|
| Fundamental basic wind velocity before altitude correction | vb,map | NA Figure NA.1, p.5 (read by the user) |
| Site altitude above mean sea level | A | NA.2.5, p.4 |
| Terrain | Country or Town | NA.2.11, p.7 |
| Orography significant | yes/no | NA.2.13 and Figure NA.2, pp.6, 10. If yes, release 1 reports not covered. |
| Orientation: azimuth of the outward normal of the "North" elevation | θN | user |
| Season factor | cseason | NA Table NA.2, p.6. Default 1.00 (the 12-month value). |
| Annual probability of exceedance | p | EN 4.2(2)P Note 4, Expression (4.2), pp.18–19. Default 0.02, giving cprob = 1.0. |
| cdir method | orthogonal / unity | NA Table NA.1 Notes 3 and 4, p.4. Default orthogonal. |
| Altitude factor method | by height / conservative | NA.2.5, p.4. Default by height. |

### 3.2 Per wind direction (one for each elevation, wind blowing onto that elevation)
| Input | Symbol | Source |
|---|---|---|
| Distance upwind to the shoreline | Ds (km) | NA.2.11, Figure NA.7 |
| Distance inside Town terrain (Town only) | dT (km) | NA.2.11, Figure NA.8 |
| Average height of upwind neighbouring buildings | have (m) | EN A.5, p.101 |
| Upwind spacing to those buildings | x (m) | EN A.5 |
| Gap from this elevation to a facing building (funnelling) | g (m) | NA.2.27 note d, p.19 |
| e of the facing building (optional) | e' (m) | NA.2.27 note d (the smaller e governs) |
| Height of the facing building (optional) | h' (m) | NA.2.27 note d 3) |

### 3.3 Building
| Input | Symbol |
|---|---|
| Width of the North and South elevations | W (m) |
| Width of the East and West elevations | D (m) |
| Height of the building (or of the part, EN 7.2.2(1)) | h (m) |

### 3.4 Options
| Option | Default | Source |
|---|---|---|
| Funnelling: conservative or linear interpolation | conservative | NA.2.27 note d 2), p.19 |
| Vertical zoning of zone D to Figure 7.4 | off | CWCT Part 2 2.2.3, p.10 says no horizontal zoning. Turning it on raises advisory ADV-ZONING. |
| Size factor cs from Table NA.3 for an element with b + h | off (cs = 1.0) | NA.2.20 and Table NA.3, pp.15–16 |
| Internal pressure coefficients, sealed envelope | cpi+ = +0.2, cpi− = −0.3 | EN 7.2.9(6) Note 2, p.53 |
| CWCT design pressure basis | custom envelope | CWCT Part 2 Table 2.1, p.11 |
| Manual overrides of cdir, ce, ce,T and hdis per direction | none | For checking against hand calculations. Raises advisory ADV-OVERRIDE. |

## 4. Peak velocity pressure, one wind direction

For the elevation F, the wind direction is θF = θN + {0, 90, 180, 270}° for N, E, S and W
(mod 360). The wind blows onto F from θF.

4.1 **Altitude factor** (NA.2.5, Equations NA.2a and NA.2b, p.4), with z = ze:
- By height: calt = 1 + 0.001·A for z ≤ 10 m, and calt = 1 + 0.001·A·(10/z)^0.2 for z > 10 m.
- Conservative: calt = 1 + 0.001·A (the Note to NA.2.5).

4.2 **Basic wind velocity.** vb,0 = vb,map·calt (NA.1, p.3). Then
vb = cdir·cseason·cprob·vb,0 (EN Expression 4.1, and 4.2(2)P Note 4).
- cdir uses NA Table NA.1 (p.4), interpolated linearly between the tabulated 30° directions
  (Note 1). The orthogonal method (Note 3) takes the maximum over θF ± 45°. The maximum is
  found by evaluating both end points and every tabulated direction inside the range. The
  unity method (Note 4) uses cdir = 1.0.
- cprob = ((1 − K·ln(−ln(1 − p))) / (1 − K·ln(−ln 0.98)))^n with K = 0.2 and n = 0.5
  (EN Expression 4.2 and NA.2.8, p.7).

4.3 **Displacement height** (EN A.5, Expression A.15, p.101). hdis = 0 in Country terrain
(NA.2.11 Note). In Town terrain:
- x ≤ 2·have: hdis = min(0.8·have, 0.6·h)
- 2·have < x < 6·have: hdis = min(1.2·have − 0.2·x, 0.6·h)
- x ≥ 6·have: hdis = 0

4.4 **Exposure factors** (NA.2.17, Figures NA.7 and NA.8, pp.12–14).
- ce(z) is read from the digitised Figure NA.7 at (Ds, z − hdis). Interpolation is bilinear
  in (log Ds, log(z − hdis)).
- Ds is clamped to 0.1–100 km. A site adjacent to the sea uses 0.1 km (NA.2.11). Beyond
  100 km, the ≥ 100 column applies.
- z − hdis below 2 m uses 2 m, which is conservative because ce rises with height.
  z − hdis above 200 m is not covered.
- In Town terrain, ce,T is read from the digitised Figure NA.8 at (dT, z − hdis) the same
  way. dT < 0.1 km is treated as Country terrain (NA Figure NA.8 Note 3), so ce,T = 1.0.
  dT > 20 km uses 20 km.
- In Country terrain, ce,T = 1.0.

4.5 **Peak velocity pressure.** qb = ½·ρ·vb² with ρ = 1.226 kg/m³ (EN Expression 4.10 and
NA.2.18, p.15). Then qp(z) = ce(z)·ce,T·qb (NA.3a and NA.3b), with the result divided by
1000 to give kN/m².

4.6 **Size factor** (optional; NA.2.20, Table NA.3, p.15).
- The zone is chosen from the figures. In Town terrain, zone C applies if the point lies
  below the edge of the shaded area of Figure NA.8. Otherwise zone A applies if the point
  lies on or above the edge of the shaded area of Figure NA.7, and zone B applies if it does
  not.
- cs is interpolated in Table NA.3, linearly in (b + h) and in z − hdis, and held at the
  ends of the table.
- The size factor multiplies qp for the cladding pressures. cd = 1.0 for cladding panels
  and elements (Figure NA.9 Note 4b, p.16).

## 5. Reference heights

5.1 By default, every zone uses ze = h. This follows NA.2.26 (p.18) for zones A, B, C and E,
and CWCT Part 2 clause 2.2.3 (p.10), which allows no horizontal zoning, for zone D.

5.2 With vertical zoning switched on, zone D follows EN 7.2.2(1) and Figure 7.4 (pp.34–35),
with b the crosswind width of the windward elevation:
- h ≤ b: one part, ze = h.
- b < h ≤ 2b: a lower part from 0 to b with ze = b, and an upper part from b to h with ze = h.
- h > 2b: a lower part from 0 to b with ze = b, and an upper part from h − b to h with ze = h.
  The middle region is treated as one strip with ze = h − b, which is the upper edge of the
  strip and therefore conservative.

5.3 The internal pressure uses zi = h, the largest ze (EN 7.2.9(7), p.53).

## 6. External pressure coefficients

6.1 For wind onto elevation F, b is the width of F (crosswind) and d is the depth along the
wind. Then e = min(b, 2h) (EN Figure 7.5, p.36). F carries zone D, the opposite elevation
carries zone E, and the two side elevations carry zones A, B and C, measured from the
upwind corner.
- e < d: A spans 0 to e/5, B spans e/5 to e, and C spans e to d.
- d ≤ e < 5d: A spans 0 to e/5, and B spans e/5 to d.
- e ≥ 5d: A spans the whole depth d.

6.2 cpe for zones A to E comes from NA Table NA.4 (p.18), at h/d. Interpolation is linear in
h/d between 0.25, 1 and 5 (EN Figure 7.5 Note 1). Values are held for h/d ≤ 0.25 and for
h/d ≥ 5 (Table NA.4 note b). cpe,10 = cpe,1 in Table NA.4, so the loaded area does not
change cpe (NA.2.25).

6.3 **Funnelling** (NA.2.27 notes d and e, p.19). A side elevation G with gap g to a facing
building takes A = −1.6, B = −0.9 and C = −0.9 in place of the isolated values when the
following hold:
- ef = min(e, e'), where e' is the facing building's e if it is given.
- Funnelling applies when ef/4 < g < ef. At or outside those limits, the isolated values
  apply.
- With the conservative method, the funnelling values are used in full.
- With the interpolation method, the coefficient varies linearly with g. It goes from the
  isolated value at g = ef/4, to the funnelling value at g = ef/2, and back to the isolated
  value at g = ef.
- Funnelling is disregarded when (ze − hdis) < 0.4·ze for the lower of the two buildings,
  where ze is that building's height (note d 3). The engine checks its own building, using
  hdis for this wind direction. If h' is given and h' < h, it checks the facing building
  instead, using h' and the same hdis. An advisory says the check assumes the same hdis
  for both buildings.

## 7. Net pressures

Positive values push onto the face, and negative values are suction.

| Envelope | Formula | Source |
|---|---|---|
| Sealed or glazed | w = qp(ze)·cpe − qp(zi)·cpi, for cpi = cpi+ and cpi = cpi− | EN 5.2(3) Expression (5.5), 7.2.9 |
| Drained and ventilated rainscreen | w = qp(ze)·cpe | CWCT Part 2 2.2.5.1 a), p.11 |
| Pressure-equalised rainscreen | w = ⅔·qp(ze)·cpe | CWCT Part 2 2.2.5.1 b), p.11 |

For each elevation and envelope type, the engine collects every zone that the elevation
carries across the four wind directions:
- D when the wind blows onto it.
- E when the wind blows onto the opposite elevation.
- A, B and C from each side, when the wind blows along it.

For each zone it records the zone extents and the governing pressure (maximum w) and
suction (minimum w). The elevation summary gives the following:
- Wp: the maximum pressure over all zones.
- Ws,A: the corner suction in zone A, with the corner width, which is the largest e/5 from
  the two side directions.
- Ws: the general suction, the most negative w outside zone A.
- The governing case for each value.

## 8. Design wind pressure (CWCT Part 2 2.2.4, Table 2.1, p.11)

- Custom envelope: |w_design| = max(|w|, 0.8 kPa).
- Proprietary system: |w| is rounded up to the next band of 0.8, 1.2, 1.6, 2.0 or 2.4 kPa.
  Above 2.4 kPa the calculated value is used.

The sign is kept. Pressure and suction are banded separately.

## 9. Advisories and errors

Errors block the result:
- Missing or non-positive inputs.
- Orography marked significant.
- z − hdis > 200 m.
- Terrain Town with no dT.

Advisories:
- ADV-CHART-CLAMP: an input outside a chart's range was clamped.
- ADV-HD5: h/d > 5. Table NA.4 note b; consider tests.
- ADV-CPI: the cpi values differ from +0.2 and −0.3.
- ADV-ZONING: vertical zoning is on (CWCT 2.2.3).
- ADV-OVERRIDE: one or more values were entered by hand.
- ADV-FUNNEL-HDIS: the funnelling disregard check assumes the same hdis for the facing
  building.
- ADV-CDIR-UNITY: cdir = 1.0 was used, which is conservative.
- ADV-SEASON: cseason < 1.0 (temporary works only).
- ADV-PROB: p ≠ 0.02.
- ADV-SIZE: the size factor reduced pressures.
- ADV-DIGITISED: ce and ce,T are read from digitised figures (always shown, OQ-01).

## 10. Documents

| Id | Document |
|---|---|
| EN | BS EN 1991-1-4:2005+A1:2010 Eurocode 1: Actions on structures, Part 1-4: Wind actions |
| NA | NA to BS EN 1991-1-4:2005+A1:2010 (UK National Annex) |
| PD | PD 6688-1-4:2015 Background information to the National Annex to BS EN 1991-1-4 |
| CWCT | CWCT Standard for systemised building envelopes, Part 2: Loads, fixings and movement |
| BX | Example report: Brent Cross Town Plot 202, Loads and load combinations, GFS, 24 June 2022 |
| ISCA | Example report and spreadsheet: ISCA Place, Exeter, Wind load calculation report, GFS, May 2026 |
