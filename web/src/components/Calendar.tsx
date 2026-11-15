// Power & Comms Calendar: 30-day hourly strip. Each day row has 24 Sun cells
// (amber, brightness = visible disc fraction) over 24 Earth cells (cyan = Earth
// above terrain; bright = also a DSN complex sees the Moon >= 10 deg).
// Developed by Team Horvan, using Claude (Anthropic) as an AI coding assistant.
import type { Series } from '../lib/astro'
import { fmtUTC, idxToDate } from '../lib/format'

interface Props {
  series: Series
  startMs: number
  a: number // series index of first hour (00 UTC)
  days: number
  cursor: number
  onPick: (k: number) => void
}

export function Calendar({ series, startMs, a, days, cursor, onPick }: Props) {
  const cw = 26, ch = 9, gap = 3, labelW = 92, sumW = 150
  const rowH = ch * 2 + 1 + gap
  const W = labelW + 24 * cw + sumW
  const H = 18 + days * rowH
  const rows = []
  for (let d = 0; d < days; d++) {
    const y0 = 18 + d * rowH
    let sunH = 0, eH = 0
    const cells = []
    for (let h = 0; h < 24; h++) {
      const k = a + d * 24 + h
      if (k >= series.n) break
      const f = series.sunFrac[k]
      const ev = series.earthVis[k] === 1
      const dsn = ev && series.dsnUp[k] > 0
      if (f > 0) sunH++
      if (ev) eH++
      const x = labelW + h * cw
      const sel = k === cursor
      cells.push(
        <g key={h} onClick={() => onPick(k)} className="cal-cell">
          <title>{`${fmtUTC(idxToDate(startMs, series.i0 + k))}\nSun disc visible: ${(f * 100).toFixed(0)}%\nEarth: ${ev ? 'in view' : 'hidden'}${ev ? (dsn ? ' (DSN up)' : ' (no DSN ≥10°)') : ''}`}</title>
          <rect x={x} y={y0} width={cw - 2} height={ch} rx={1.5}
            className="cal-sun" style={{ opacity: f > 0 ? 0.25 + 0.75 * f : 1 }} data-off={f > 0 ? undefined : '1'} />
          <rect x={x} y={y0 + ch + 1} width={cw - 2} height={ch} rx={1.5}
            className={ev ? (dsn ? 'cal-earth dsn' : 'cal-earth') : 'cal-off'} />
          {sel && <rect x={x - 1.5} y={y0 - 1.5} width={cw + 1} height={ch * 2 + 4} className="cal-sel" rx={2} />}
        </g>,
      )
    }
    const date = idxToDate(startMs, series.i0 + a + d * 24)
    rows.push(
      <g key={d}>
        <text x={0} y={y0 + ch + 4} className="ax-lbl">{fmtUTC(date, false)}</text>
        {cells}
        <text x={labelW + 24 * cw + 8} y={y0 + ch + 4} className="ax-lbl">
          <tspan className="t-sun">☀ {sunH}h</tspan>  <tspan className="t-earth">⊕ {eH}h</tspan>
        </text>
      </g>,
    )
  }
  return (
    <div className="cal-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="cal" role="img" aria-label="Hourly calendar of sunlight and Earth visibility">
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={labelW + h * cw} y={11} className="ax-lbl">{String(h).padStart(2, '0')}h</text>
        ))}
        <text x={labelW + 24 * cw + 8} y={11} className="ax-lbl">per day</text>
        {rows}
      </svg>
    </div>
  )
}
