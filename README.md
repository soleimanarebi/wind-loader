# Wind Loader

Façade wind loads to BS EN 1991-1-4 with the UK National Annex, PD 6688-1-4 and the CWCT Standard for systemised
building envelopes Part 2. Every value is traced to its document, clause and page.

| Path | What it is |
| --- | --- |
| `packages/engine` | The calculation engine (pure TypeScript), with the sourced data and the digitised NA charts |
| `validation` | Cases from real wind load reports, with expected values computed outside the engine |
| `apps/app` | The checker: inputs, the building in 3D, elevation mark-ups, results and the PDF report |
| `apps/site` | The landing site with the contact form |
| `docs/calc-spec.md` | The specification the engine implements |
| `docs/open-questions.md` | Choices the documents leave open |

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @wind/app dev    # http://localhost:5173
pnpm --filter @wind/site dev   # http://localhost:5174
```

See `DEPLOY.md` for Netlify. Results must be checked by a qualified engineer.
