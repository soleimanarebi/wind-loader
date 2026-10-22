import { FACES, ukna, type DirectionInput, type Face, type Overrides } from "@wind/engine";
import { useId, type ReactNode } from "react";
import { blankBlock, TEMPLATES, type Block, type Project } from "../project";
import { FACE_NAMES } from "../viz";
import { Cite, Group, NumberField, SelectField } from "./fields";
import { CompassThumb, PlanThumb, TemplateThumb } from "./Thumbs";

export type Update = (fn: (draft: Project) => void) => void;

interface Props {
  project: Project;
  blockIndex: number;
  onBlock: (i: number) => void;
  update: Update;
  onTemplate: (id: string) => void;
  templateId: string;
}

const optNum = (v: number) => (Number.isNaN(v) ? undefined : v);

function TextField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** A compact number cell for the per-direction tables. */
function Cell({ label, value, onChange, required }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; required?: boolean }) {
  return (
    <td>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        aria-label={label}
        value={value === undefined || Number.isNaN(value) ? "" : value}
        aria-invalid={required && (value === undefined || Number.isNaN(value)) ? true : undefined}
        onChange={(e) => onChange(e.target.value.trim() === "" ? (required ? NaN : undefined) : Number(e.target.value))}
      />
    </td>
  );
}

function DirTable({
  caption,
  columns,
  block,
  set,
}: {
  caption: ReactNode;
  columns: { key: string; label: string; unit?: string; get: (d: DirectionInput) => number | undefined; put: (d: DirectionInput, v: number | undefined) => void; required?: boolean }[];
  block: Block;
  set: (f: Face, fn: (d: DirectionInput) => void) => void;
}) {
  return (
    <div className="dir-table-wrap">
      <table className="dir-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Wind onto</th>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
                {c.unit ? <span className="unit"> ({c.unit})</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FACES.map((f) => (
            <tr key={f}>
              <th scope="row">{f}</th>
              {columns.map((c) => (
                <Cell
                  key={c.key}
                  label={`${FACE_NAMES[f]}: ${c.label}`}
                  value={c.get(block.directions[f])}
                  required={c.required}
                  onChange={(v) => set(f, (d) => c.put(d, v))}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Inputs({ project, blockIndex, onBlock, update, onTemplate, templateId }: Props) {
  const block = project.blocks[blockIndex]!;
  const { site, options } = project;
  const town = site.terrain === "town";
  const setBlock = (fn: (b: Block) => void) => update((p) => fn(p.blocks[blockIndex]!));
  const setDir = (f: Face, fn: (d: DirectionInput) => void) => setBlock((b) => fn(b.directions[f]));
  const ov = (k: keyof Overrides) => ({
    get: (d: DirectionInput) => d.overrides?.[k],
    put: (d: DirectionInput, v: number | undefined) => {
      d.overrides = { ...(d.overrides ?? {}), [k]: v };
      if (v === undefined) delete d.overrides[k];
    },
  });

  return (
    <div className="inputs">
      <Group title="Templates">
        <div className="templates" role="group" aria-label="Example projects">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="template-card" aria-pressed={templateId === t.id} onClick={() => onTemplate(t.id)} title={t.note}>
              <TemplateThumb id={t.id} />
              <span className="template-label">{t.name}</span>
            </button>
          ))}
        </div>
        <p className="hint template-note">{TEMPLATES.find((t) => t.id === templateId)?.note ?? "Edited. Template values are examples; replace them with your site's data."}</p>
      </Group>

      <Group title="Project" defaultOpen={false}>
        <TextField label="Project" value={project.meta.project} onChange={(v) => update((p) => void (p.meta.project = v))} />
        <div className="row">
          <TextField label="Document no." value={project.meta.reference} onChange={(v) => update((p) => void (p.meta.reference = v))} />
          <TextField label="Date" value={project.meta.date} onChange={(v) => update((p) => void (p.meta.date = v))} />
        </div>
        <TextField label="Client" value={project.meta.client} onChange={(v) => update((p) => void (p.meta.client = v))} />
        <TextField label="Prepared by" value={project.meta.preparedBy} onChange={(v) => update((p) => void (p.meta.preparedBy = v))} />
        <TextField label="Site notes (for the report)" multiline value={project.meta.siteNotes} onChange={(v) => update((p) => void (p.meta.siteNotes = v))} />
      </Group>

      <Group title="Site and wind">
        <div className="row">
          <NumberField label="vb,map" unit="m/s" required value={site.vbMap} onChange={(v) => update((p) => void (p.site.vbMap = v))} hint={<Cite>NA Figure NA.1</Cite>} />
          <NumberField label="Altitude A" unit="m AOD" required value={site.altitude} onChange={(v) => update((p) => void (p.site.altitude = v))} hint={<Cite>NA.2.5</Cite>} />
        </div>
        <SelectField
          label="Terrain"
          value={site.terrain}
          options={[
            { value: "country", label: "Country (categories I–II)" },
            { value: "town", label: "Town (categories III–IV)" },
          ]}
          onChange={(v) => update((p) => void (p.site.terrain = v))}
          hint={<Cite>NA.2.11</Cite>}
        />
        <div className="orientation">
          <NumberField
            label="Orientation of the North elevation"
            unit="°"
            required
            value={site.orientation}
            onChange={(v) => update((p) => void (p.site.orientation = v))}
            hint="Azimuth of its outward normal, clockwise from north (−10 = 350°)."
          />
          <CompassThumb orientation={Number.isFinite(site.orientation) ? site.orientation : 0} />
        </div>
        <label className="check">
          <input type="checkbox" checked={!!site.orographySignificant} onChange={(e) => update((p) => void (p.site.orographySignificant = e.target.checked))} />
          Orography is significant (NA Figure NA.2)
        </label>
        <SelectField
          label="Directional factor cdir"
          value={site.cdirMethod ?? "orthogonal"}
          options={[
            { value: "orthogonal", label: "Table NA.1, max within ±45° (Note 3)" },
            { value: "unity", label: "1.0 for all directions (Note 4)" },
          ]}
          onChange={(v) => update((p) => void (p.site.cdirMethod = v))}
        />
        <SelectField
          label="Altitude factor"
          value={site.altitudeMethod ?? "height"}
          options={[
            { value: "height", label: "NA.2b with height (NA.2a ≤ 10 m)" },
            { value: "conservative", label: "NA.2a for any height (conservative)" },
          ]}
          onChange={(v) => update((p) => void (p.site.altitudeMethod = v))}
        />
        <div className="row">
          <NumberField
            label="cseason"
            value={site.season ?? ukna.CSEASON.year.value}
            onChange={(v) => update((p) => void (p.site.season = v))}
            hint={<Cite>Table NA.2</Cite>}
          />
          <NumberField
            label="Probability p"
            value={site.probability ?? ukna.CPROB.pDefault}
            onChange={(v) => update((p) => void (p.site.probability = v))}
            hint={<Cite>EN (4.2)</Cite>}
          />
        </div>
      </Group>

      <Group title="Building">
        <div className="blocks" role="tablist" aria-label="Blocks">
          {project.blocks.map((b, i) => (
            <button key={b.id} type="button" role="tab" aria-selected={i === blockIndex} className="block-tab" onClick={() => onBlock(i)}>
              {b.name || `Block ${i + 1}`}
            </button>
          ))}
          <button
            type="button"
            className="block-tab add"
            onClick={() => {
              update((p) => void p.blocks.push(blankBlock(`Block ${p.blocks.length + 1}`, p.blocks[blockIndex])));
              onBlock(project.blocks.length);
            }}
          >
            + Copy block
          </button>
        </div>
        <div className="row">
          <TextField label="Block name" value={block.name} onChange={(v) => setBlock((b) => void (b.name = v))} />
          <div className="field">
            <span className="field-label">&nbsp;</span>
            <button
              type="button"
              className="btn-plain"
              disabled={project.blocks.length < 2}
              onClick={() => {
                update((p) => void p.blocks.splice(blockIndex, 1));
                onBlock(Math.max(0, blockIndex - 1));
              }}
            >
              Remove block
            </button>
          </div>
        </div>
        <div className="building">
          <PlanThumb widthNS={block.building.widthNS} widthEW={block.building.widthEW} orientation={site.orientation} />
          <div>
            <NumberField label="Width of N and S elevations" unit="m" required value={block.building.widthNS} onChange={(v) => setBlock((b) => void (b.building.widthNS = v))} />
            <NumberField label="Width of E and W elevations" unit="m" required value={block.building.widthEW} onChange={(v) => setBlock((b) => void (b.building.widthEW = v))} />
            <NumberField label="Height h" unit="m" required value={block.building.height} onChange={(v) => setBlock((b) => void (b.building.height = v))} hint={<Cite>EN 7.2.2, Figure 7.4</Cite>} />
          </div>
        </div>
      </Group>

      <Group title="Terrain by direction">
        <DirTable
          caption={
            <>
              Upwind distances and neighbours for the wind blowing onto each elevation. <Cite>NA.2.11, EN A.5</Cite>
            </>
          }
          block={block}
          set={setDir}
          columns={[
            { key: "ds", label: "Shore", unit: "km", required: true, get: (d) => d.shorelineKm, put: (d, v) => void (d.shorelineKm = v ?? NaN) },
            ...(town ? [{ key: "dt", label: "In town", unit: "km", required: true, get: (d: DirectionInput) => d.townKm, put: (d: DirectionInput, v: number | undefined) => void (d.townKm = v) }] : []),
            ...(town
              ? [
                  { key: "have", label: "have", unit: "m", get: (d: DirectionInput) => d.have, put: (d: DirectionInput, v: number | undefined) => void (d.have = v) },
                  { key: "x", label: "x", unit: "m", get: (d: DirectionInput) => d.x, put: (d: DirectionInput, v: number | undefined) => void (d.x = v) },
                ]
              : []),
          ]}
        />
        <p className="hint">have: average height of upwind buildings; x: spacing to them (EN Figure A.5). Town sites only.</p>
      </Group>

      <Group title="Funnelling">
        <DirTable
          caption={
            <>
              Gap from each elevation to a facing building. <Cite>NA.2.27 notes d, e</Cite>
            </>
          }
          block={block}
          set={setDir}
          columns={[
            { key: "gap", label: "Gap", unit: "m", get: (d) => d.gap, put: (d, v) => void (d.gap = v) },
            { key: "ne", label: "Its e", unit: "m", get: (d) => d.neighbourE, put: (d, v) => void (d.neighbourE = v) },
            { key: "nh", label: "Its h", unit: "m", get: (d) => d.neighbourHeight, put: (d, v) => void (d.neighbourHeight = v) },
          ]}
        />
        <SelectField
          label="Between e/4 and e"
          value={options.funnelling ?? "conservative"}
          options={[
            { value: "conservative", label: "Use funnelling values (conservative)" },
            { value: "interpolate", label: "Interpolate on the gap" },
          ]}
          onChange={(v) => update((p) => void (p.options.funnelling = v))}
        />
      </Group>

      <Group title="Pressures and design" defaultOpen={false}>
        <div className="row">
          <NumberField
            label="cpi+"
            value={options.cpi?.positive ?? ukna.CPI_DEFAULT.positive}
            onChange={(v) => update((p) => void (p.options.cpi = { positive: v, negative: p.options.cpi?.negative ?? ukna.CPI_DEFAULT.negative }))}
            hint={<Cite>EN 7.2.9(6) Note 2</Cite>}
          />
          <NumberField
            label="cpi−"
            value={options.cpi?.negative ?? ukna.CPI_DEFAULT.negative}
            onChange={(v) => update((p) => void (p.options.cpi = { positive: p.options.cpi?.positive ?? ukna.CPI_DEFAULT.positive, negative: v }))}
          />
        </div>
        <SelectField
          label="CWCT design pressure"
          value={options.designBasis ?? "custom"}
          options={[
            { value: "custom", label: "Custom envelope: not less than 800 Pa" },
            { value: "proprietary", label: "Proprietary system: banded" },
          ]}
          onChange={(v) => update((p) => void (p.options.designBasis = v))}
          hint={<Cite>CWCT Part 2 Table 2.1</Cite>}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={options.sizeFactorBPlusH !== undefined}
            onChange={(e) => update((p) => void (p.options.sizeFactorBPlusH = e.target.checked ? 5 : undefined))}
          />
          Apply size factor cs (Table NA.3)
        </label>
        {options.sizeFactorBPlusH !== undefined ? (
          <NumberField label="Element b + h" unit="m" value={options.sizeFactorBPlusH} onChange={(v) => update((p) => void (p.options.sizeFactorBPlusH = optNum(v)))} />
        ) : null}
        <label className="check">
          <input type="checkbox" checked={!!options.verticalZoning} onChange={(e) => update((p) => void (p.options.verticalZoning = e.target.checked))} />
          Vertical zoning of zone D (EN Figure 7.4)
        </label>
      </Group>

      <Group title="Hand overrides" defaultOpen={false}>
        <DirTable
          caption="Leave blank to calculate. Use to match a hand calculation or a chart reading."
          block={block}
          set={setDir}
          columns={[
            { key: "cdir", label: "cdir", ...ov("cdir") },
            { key: "ce", label: "ce", ...ov("ce") },
            { key: "ceT", label: "ce,T", ...ov("ceT") },
            { key: "hdis", label: "hdis", unit: "m", ...ov("hdis") },
          ]}
        />
      </Group>
    </div>
  );
}
