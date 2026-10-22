# Reference documents

The standards are licensed copies and are not committed. Put them here to rerun the digitiser.

| Id | File |
|---|---|
| EN | BS EN 1991-1-4-2005+A1-2010.pdf |
| NA | NA to BS EN 1991-1-4-2005+A1-2010.pdf (Figures NA.7 and NA.8 on printed pp.13–14) |
| PD | PD 6688-1-4-2015.pdf |
| CWCT | Part 2 - Loads, fixings and movement.pdf |
| BX | BXS-M2012-PRJ002-S-GFS-RP-20-001-XX (Brent Cross Plot 202 loads report) |
| ISCA | GFS - Wind Load Calcs.docx and Wind load Calc.xlsx (ISCA Place, Exeter) |

Regenerate `packages/engine/src/data/charts.ts`:

    python3 -I tools/digitise/digitise.py "docs/reference/NA to BS EN 1991-1-4-2005+A1-2010.pdf" "[127.9,115.8,480.5,550.4]" > /tmp/grids.json
    python3 -I tools/digitise/emit_ts.py /tmp/grids.json > packages/engine/src/data/charts.ts
