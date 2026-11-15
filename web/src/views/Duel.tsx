// Site Duel: two sites, identical date range, per-metric winners (no blended score).
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import { HorizonRing } from '../components/HorizonRing'
import type { Ephem, Site, SiteIndex } from '../lib/data'
import { fmtDur, fmtUTC, idxToDate } from '../lib/format'
import { metrics, type Metrics } from '../lib/metrics'
import { useSeries, useSite } from '../lib/useData'

interface Props {
  index: SiteIndex[]
  custom: Site | null
  ephem: Ephem
  a: string
  b: string
  setA: (id: string) => void
  setB: (id: string) => void
  mast: number
  start: number
  days: number
  setDays: (d: number) => void
  cursor: number
}

type Row = { key: keyof Metrics; label: string; better: 'high' | 'low'; fmt: (m: Metrics) => string }
const ROWS: Row[] = [
  { key: 'sunPct', label: 'Sunlit (any part of disc)', better: 'high', fmt: (m) => `${m.sunPct.toFixed(1)}%` },
  { key: 'sunEquivHours', label: 'Sun-disc hours (Σ visible fraction)', better: 'high', fmt: (m) => `${m.sunEquivHours.toFixed(0)} h` },
  { key: 'earthPct', label: 'Earth in view', better: 'high', fmt: (m) => `${m.earthPct.toFixed(1)}%` },
  { key: 'bothPct', label: 'Sun and Earth together', better: 'high', fmt: (m) => `${m.bothPct.toFixed(1)}%` },
  { key: 'dsnPct', label: 'Earth in view + DSN ≥10°', better: 'high', fmt: (m) => `${m.dsnPct.toFixed(1)}%` },
  { key: 'longestDark', label: 'Longest dark stretch', better: 'low', fmt: (m) => fmtDur(m.longestDark) },
  { key: 'longestNoEarth', label: 'Longest Earth outage', better: 'low', fmt: (m) => fmtDur(m.longestNoEarth) },
]

export function Duel({ index, custom, ephem, a, b, setA, setB, mast, start, days, setDays, cursor }: Props) {
  const sa = useSite(a, custom)
  const sb = useSite(b, custom)
  const A = useSeries(sa, ephem, mast)
  const B = useSeries(sb, ephem, mast)
  const st = Math.max(0, Math.min(ephem.count - days * 24, start - (start % 24)))
  const en = st + days * 24
  const ma = A ? metrics(A.series, st, en) : null
  const mb = B ? metrics(B.series, st, en) : null
  const opts = [...index, ...(custom ? [custom] : [])].map((s) => <option key={s.site_id} value={s.site_id}>{s.region_name.replace(' (Artemis III candidate region)', '')}</option>)
  const wins = { a: 0, b: 0 }

  return (
    <div className="duel">
      <section className="panel">
        <header className="panel-h">
          <h2>Site Duel</h2>
          <span className="muted">same dates for both: {fmtUTC(idxToDate(ephem.startMs, st), false)} → {fmtUTC(idxToDate(ephem.startMs, en), false)} · mast {mast} m</span>
        </header>
        <div className="duel-ctl">
          <label>Site A <select value={a} onChange={(e) => setA(e.target.value)}>{opts}</select></label>
          <label>Site B <select value={b} onChange={(e) => setB(e.target.value)}>{opts}</select></label>
          <label>Days <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d}</option>)}
          </select></label>
        </div>
        {ma && mb && (
          <table className="duel-t">
            <thead><tr><th>Metric</th><th>A · {sa?.region_name.replace(' (Artemis III candidate region)', '')}</th><th>B · {sb?.region_name.replace(' (Artemis III candidate region)', '')}</th></tr></thead>
            <tbody>
              {ROWS.map((r) => {
                const va = ma[r.key] as number, vb = mb[r.key] as number
                const eps = 1e-6
                const aw = r.better === 'high' ? va > vb + eps : va < vb - eps
                const bw = r.better === 'high' ? vb > va + eps : vb < va - eps
                if (aw) wins.a++
                if (bw) wins.b++
                return (
                  <tr key={r.key}>
                    <td>{r.label} <span className="muted">({r.better === 'high' ? 'higher' : 'lower'} is better)</span></td>
                    <td className={aw ? 'win' : ''}>{r.fmt(ma)} {aw && <span className="badge win-b">wins</span>}</td>
                    <td className={bw ? 'win' : ''}>{r.fmt(mb)} {bw && <span className="badge win-b">wins</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {ma && mb && <p className="caption">A leads on {wins.a} metric{wins.a === 1 ? '' : 's'}, B on {wins.b}. No overall score is computed — which metric matters depends on the mission (power vs. communications vs. battery size).</p>}
      </section>
      <div className="duel-rings">
        {A && sa && <section className="panel"><header className="panel-h"><h3>A · {sa.region_name.replace(' (Artemis III candidate region)', '')}</h3></header><HorizonRing H={A.H} series={A.series} cursor={cursor} size={360} compact /></section>}
        {B && sb && <section className="panel"><header className="panel-h"><h3>B · {sb.region_name.replace(' (Artemis III candidate region)', '')}</h3></header><HorizonRing H={B.H} series={B.series} cursor={cursor} size={360} compact /></section>}
      </div>
      {A && B && <DailyBars A={A.series.sunFrac} B={B.series.sunFrac} EA={A.series.earthVis} EB={B.series.earthVis} st={st} days={days} startMs={ephem.startMs} />}
    </div>
  )
}

function DailyBars({ A, B, EA, EB, st, days, startMs }: { A: Float32Array; B: Float32Array; EA: Uint8Array; EB: Uint8Array; st: number; days: number; startMs: number }) {
  const W = 1000, H = 200, pad = 30
  const bw = (W - pad) / days
  const day = (arr: ArrayLike<number>, d: number, pred: (v: number) => boolean) => {
    let c = 0
    for (let h = 0; h < 24; h++) if (pred(arr[st + d * 24 + h])) c++
    return c
  }
  const y = (h: number) => 10 + (1 - h / 24) * (H / 2 - 20)
  const y2 = (h: number) => H / 2 + 10 + (1 - h / 24) * (H / 2 - 20)
  const bars = []
  for (let d = 0; d < days; d++) {
    const x = pad + d * bw
    const sa = day(A, d, (v) => v > 0), sb = day(B, d, (v) => v > 0)
    const ea = day(EA, d, (v) => v === 1), eb = day(EB, d, (v) => v === 1)
    bars.push(
      <g key={d}>
        <rect x={x} y={y(sa)} width={bw * 0.45} height={y(0) - y(sa)} className="bar-a" />
        <rect x={x + bw * 0.47} y={y(sb)} width={bw * 0.45} height={y(0) - y(sb)} className="bar-b" />
        <rect x={x} y={y2(ea)} width={bw * 0.45} height={y2(0) - y2(ea)} className="bar-a e" />
        <rect x={x + bw * 0.47} y={y2(eb)} width={bw * 0.45} height={y2(0) - y2(eb)} className="bar-b e" />
      </g>,
    )
  }
  return (
    <section className="panel">
      <header className="panel-h"><h3>Daily hours — sunlit (top) and Earth in view (bottom)</h3><span className="muted"><span className="lg a" /> A <span className="lg b" /> B · from {fmtUTC(new Date(startMs + st * 3600_000), false)}</span></header>
      <svg viewBox={`0 0 ${W} ${H}`} className="bars" preserveAspectRatio="none">
        <text x={2} y={y(24) + 4} className="ax-lbl">24h</text><text x={2} y={y(0)} className="ax-lbl">0</text>
        <text x={2} y={y2(24) + 4} className="ax-lbl">24h</text><text x={2} y={y2(0)} className="ax-lbl">0</text>
        {bars}
      </svg>
    </section>
  )
}
