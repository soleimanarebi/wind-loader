import { DOCUMENTS, ENVELOPES, SOURCES, type Envelope, type Source, type Step, type WindResult } from "@wind/engine";
import { FACE_NAMES, fmt, signed } from "../viz";

export const formatSource = (s: Source) => `${s.doc} ${s.ref}, p.${s.page}`;

function Src({ s }: { s?: Source }) {
  if (!s) return null;
  return (
    <span className="cite" title={DOCUMENTS[s.doc].title}>
      {formatSource(s)}
    </span>
  );
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ul className="working">
      {steps.map((s, i) => (
        <li key={s.symbol + i}>
          <strong>{s.symbol}</strong> = {s.expression ? <span>{s.expression} = </span> : null}
          <strong>{fmt(s.value, Math.abs(s.value) >= 100 ? 1 : 3)}</strong>
          {s.unit ? ` ${s.unit}` : ""} <Src s={s.source} />
        </li>
      ))}
    </ul>
  );
}

interface Props {
  result: WindResult;
  envelope: Envelope;
  onEnvelope: (e: Envelope) => void;
  blockName: string;
}

export function Results({ result, envelope, onEnvelope, blockName }: Props) {
  if (!result.ok) {
    return (
      <section className="results" aria-label="Results" aria-live="polite">
        <div className="verdict verdict-incomplete" role="status">
          <strong>Inputs incomplete</strong>
          <span>{result.errors.length} to fix</span>
        </div>
        <ul className="errors">
          {result.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>
    );
  }
  const maxP = Math.max(...result.elevations.map((e) => e.summary[envelope].wp.design));
  const maxS = Math.min(...result.elevations.map((e) => Math.min(e.summary[envelope].wsA.design, e.summary[envelope].ws.design)));
  return (
    <section className="results" aria-label="Results" aria-live="polite">
      <div className="verdict verdict-pass" role="status">
        <strong>
          {signed(maxP)} / {signed(maxS)} kPa
        </strong>
        <span>{blockName}: governing design pressure and suction (CWCT 2.2.4)</span>
      </div>

      <div className="field">
        <label htmlFor="env-select">Envelope</label>
        <select id="env-select" value={envelope} onChange={(e) => onEnvelope(e.target.value as Envelope)}>
          {ENVELOPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <table className="table summary">
        <caption className="sr-only">Design wind loads by elevation</caption>
        <thead>
          <tr>
            <th scope="col">Elev.</th>
            <th scope="col">Wp</th>
            <th scope="col">Ws corner</th>
            <th scope="col">Corner</th>
            <th scope="col">Ws general</th>
          </tr>
        </thead>
        <tbody>
          {result.elevations.map((el) => {
            const s = el.summary[envelope];
            return (
              <tr key={el.face}>
                <th scope="row">
                  {el.face}
                  {s.funnelling ? <sup title="Funnelling included">f</sup> : null}
                </th>
                <td>{signed(s.wp.design)}</td>
                <td className="neg">{signed(s.wsA.design)}</td>
                <td>{fmt(s.cornerWidth, 2)} m</td>
                <td>{signed(s.ws.design)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">
        Design values in kPa after the CWCT minimum or banding. Calculated values and every zone case are listed below. <Src s={SOURCES.design} />
      </p>

      <h3 className="sub">Elevations</h3>
      <ul className="checks">
        {result.elevations.map((el) => (
          <li key={el.face}>
            <details>
              <summary>
                <span className="check-id">{el.face}</span>
                <span className="check-title">
                  {FACE_NAMES[el.face]} elevation · {fmt(el.width, 2)} m
                </span>
                <span className="check-u">{signed(el.summary[envelope].wsA.value)}</span>
              </summary>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Zone</th>
                    <th scope="col">Wind onto</th>
                    <th scope="col">Extent (m)</th>
                    <th scope="col">cpe</th>
                    <th scope="col">qp</th>
                    <th scope="col">w+</th>
                    <th scope="col">w−</th>
                  </tr>
                </thead>
                <tbody>
                  {el.cases.map((c, i) => (
                    <tr key={i}>
                      <td>
                        {c.zone}
                        {c.funnel?.applies ? <sup title={`Funnelling: gap ${c.funnel.gap} m, ef ${fmt(c.funnel.ef)} m`}>f</sup> : null}
                        {c.zone === "D" && (c.zFrom > 0 || c.zTo < c.ze) ? ` (${fmt(c.zFrom, 1)}–${fmt(c.zTo, 1)} m)` : ""}
                      </td>
                      <td>{c.windOnto}</td>
                      <td>
                        {fmt(c.from, 2)}–{fmt(c.to, 2)}
                      </td>
                      <td>{fmt(c.cpe, 3)}</td>
                      <td>{fmt(c.qp, 3)}</td>
                      <td>{signed(c.net[envelope].pressure, 3)}</td>
                      <td>{signed(c.net[envelope].suction, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">
                Extents run from the left end as seen from outside. Wp {signed(el.summary[envelope].wp.value, 3)} (zone {el.summary[envelope].wp.zone}, wind onto{" "}
                {el.summary[envelope].wp.windOnto}); Ws,A {signed(el.summary[envelope].wsA.value, 3)}; Ws {signed(el.summary[envelope].ws.value, 3)} (zone{" "}
                {el.summary[envelope].ws.zone}). <Src s={SOURCES.zones} />{" "}
                {envelope === "sealed" ? (
                  <>
                    cpi +{result.cpi.positive} / {result.cpi.negative}. <Src s={SOURCES.cpi} />
                  </>
                ) : envelope === "ventilated" ? (
                  <Src s={SOURCES.rainscreenVentilated} />
                ) : (
                  <Src s={SOURCES.rainscreenPE} />
                )}
              </p>
            </details>
          </li>
        ))}
      </ul>

      <h3 className="sub">Peak velocity pressure by direction</h3>
      <ul className="checks">
        {result.directions.map((d) => (
          <li key={d.face}>
            <details>
              <summary>
                <span className="check-id">{d.face}</span>
                <span className="check-title">
                  Wind onto {FACE_NAMES[d.face]} · θ = {fmt(d.azimuth, 0)}°
                </span>
                <span className="check-u">qp {fmt(d.top.qp, 3)}</span>
              </summary>
              <StepList steps={[...d.steps.slice(0, 5), ...d.top.steps, ...d.steps.slice(5)]} />
              {d.parts.length > 1 ? (
                <p className="hint">
                  Zone D parts:{" "}
                  {d.parts.map((p) => `${fmt(p.from, 1)}–${fmt(p.to, 1)} m at ze ${fmt(p.ze, 1)} m: qp ${fmt(p.peak.qp, 3)}`).join("; ")}. <Src s={SOURCES.refHeight} />
                </p>
              ) : null}
            </details>
          </li>
        ))}
      </ul>

      {result.advisories.length ? (
        <div className="note">
          <h3>Advisories</h3>
          <ul>
            {result.advisories.map((a) => (
              <li key={a.id + a.message}>
                <strong>{a.id}</strong> {a.message} <Src s={a.source} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="note">
        <summary>
          <h3>Not covered in release 1</h3>
        </summary>
        <ul>
          {result.notCovered.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
