/** Small SVG pictures for the input cards. */

export function TemplateThumb({ id }: { id: string }) {
  return (
    <svg className="thumb" viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
      <path className="thumb-wind" d="M3 12h14M3 20h10M3 28h14" />
      {id === "town-tower" ? (
        <>
          <rect className="thumb-bldg" x="26" y="6" width="16" height="34" />
          <rect className="thumb-bldg back" x="44" y="14" width="14" height="26" />
          <rect className="thumb-zone" x="26" y="6" width="4" height="34" />
        </>
      ) : id === "low-rise" ? (
        <>
          <rect className="thumb-bldg" x="22" y="20" width="16" height="20" />
          <rect className="thumb-bldg back" x="42" y="22" width="18" height="18" />
          <rect className="thumb-zone" x="22" y="20" width="4" height="20" />
        </>
      ) : (
        <>
          <path className="thumb-bldg" d="M22 40V26l14-10 14 10v14z" />
          <path className="thumb-ground" d="M18 40h44" />
        </>
      )}
    </svg>
  );
}

export function CompassThumb({ orientation }: { orientation: number }) {
  return (
    <svg className="thumb compass" viewBox="-30 -30 60 60" width="60" height="60" role="img" aria-label={`North elevation faces ${((orientation % 360) + 360) % 360}°`}>
      <circle r="26" className="compass-ring" />
      <text y="-17" textAnchor="middle" className="compass-n">
        N
      </text>
      <g transform={`rotate(${orientation})`}>
        <rect x="-9" y="-6" width="18" height="12" className="thumb-bldg" />
        <path d="M0 -8 L0 -22 M-4 -17 L0 -22 L4 -17" className="compass-arrow" />
      </g>
    </svg>
  );
}

/** Plan of the block, rotated to its orientation, with the elevation names. */
export function PlanThumb({ widthNS, widthEW, orientation }: { widthNS: number; widthEW: number; orientation: number }) {
  const ok = widthNS > 0 && widthEW > 0;
  const s = ok ? 52 / Math.max(widthNS, widthEW) : 1;
  const w = ok ? widthNS * s : 40;
  const d = ok ? widthEW * s : 30;
  const rot = Number.isFinite(orientation) ? orientation : 0;
  return (
    <svg className="thumb plan" viewBox="-45 -45 90 90" width="96" height="96" role="img" aria-label="Plan of the block">
      <text x="-40" y="-34" className="compass-n">
        N↑
      </text>
      <g transform={`rotate(${rot})`}>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} className="thumb-bldg" />
        {(
          [
            ["N", 0, -d / 2 - 5],
            ["S", 0, d / 2 + 11],
            ["E", w / 2 + 7, 3],
            ["W", -w / 2 - 7, 3],
          ] as const
        ).map(([t, x, y]) => (
          <text key={t} x={x} y={y} textAnchor="middle" className="plan-label" transform={`rotate(${-rot} ${x} ${y - 3})`}>
            {t}
          </text>
        ))}
      </g>
    </svg>
  );
}
