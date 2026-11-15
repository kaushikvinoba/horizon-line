// Window Finder: scan the hourly series of selected sites for date windows that
// meet a mission rule, ranked transparently (coverage, then mean Sun disc).
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import { useState } from 'react'
import { computeSeries, maskFor } from '../lib/astro'
import { loadSite, type Ephem, type SiteIndex } from '../lib/data'
import { dateToIdx, fmtUTC, fromInputValue, idxToDate } from '../lib/format'
import { findWindows, type FoundWindow, type WindowCriteria } from '../lib/metrics'

interface Props {
  index: SiteIndex[]
  ephem: Ephem
  mast: number
  onOpen: (siteId: string, idx: number) => void
}

interface Result extends FoundWindow { siteId: string; name: string }

const short = (n: string) => n.replace(' (Artemis III candidate region)', '')

export function Finder({ index, ephem, mast, onOpen }: Props) {
  const cands = index.filter((s) => s.kind === 'candidate')
  const [sel, setSel] = useState<string[]>(cands.map((s) => s.site_id))
  const [from, setFrom] = useState('2027-01-01')
  const [to, setTo] = useState('2028-12-31')
  const [crit, setCrit] = useState<WindowCriteria>({ days: 6, sunMin: 0.5, needEarth: true, needDsn: false, coverage: 1 })
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [span, setSpan] = useState('')

  async function run() {
    setBusy(true)
    const a = Math.max(0, dateToIdx(ephem.startMs, fromInputValue(from)))
    const b = Math.min(ephem.count, dateToIdx(ephem.startMs, fromInputValue(to)) + 24)
    setSpan(`${fmtUTC(idxToDate(ephem.startMs, a), false)} → ${fmtUTC(idxToDate(ephem.startMs, b), false)}`)
    const out: Result[] = []
    for (const id of sel) {
      const site = await loadSite(id)
      const H = maskFor(site, mast)
      const s = computeSeries(site, ephem, H, mast)
      for (const w of findWindows(s, crit, a, b, 5)) out.push({ ...w, siteId: id, name: short(site.region_name) })
    }
    out.sort((x, y) => y.coverage - x.coverage || y.meanSun - x.meanSun)
    setResults(out.slice(0, 25))
    setBusy(false)
  }

  const set = <K extends keyof WindowCriteria>(k: K, v: WindowCriteria[K]) => setCrit({ ...crit, [k]: v })

  return (
    <div className="finder">
      <section className="panel">
        <header className="panel-h"><h2>Window Finder</h2><span className="muted">ranked date windows that satisfy your rule · mast {mast} m · UTC</span></header>
        <div className="rule">
          Find <input type="number" min={1} max={30} step={0.25} value={crit.days} onChange={(e) => set('days', Number(e.target.value))} /> days where
          the Sun shows <select value={crit.sunMin} onChange={(e) => set('sunMin', Number(e.target.value))}>
            <option value={0}>any part of its disc</option><option value={0.5}>≥ 50% of its disc</option><option value={1}>its full disc</option>
          </select>
          <label className="chk"><input type="checkbox" checked={crit.needEarth} onChange={(e) => set('needEarth', e.target.checked)} /> and Earth is in view</label>
          <label className="chk"><input type="checkbox" checked={crit.needDsn} onChange={(e) => set('needDsn', e.target.checked)} /> with a DSN complex ≥10°</label>
          for at least <select value={crit.coverage} onChange={(e) => set('coverage', Number(e.target.value))}>
            <option value={1}>100% (continuous)</option><option value={0.95}>95%</option><option value={0.9}>90%</option><option value={0.8}>80%</option>
          </select> of the hours,
          between <input type="date" value={from} min="2026-01-01" max="2030-12-31" onChange={(e) => setFrom(e.target.value)} /> and <input type="date" value={to} min="2026-01-01" max="2030-12-31" onChange={(e) => setTo(e.target.value)} />.
        </div>
        <div className="site-chips">
          {cands.map((s) => (
            <label key={s.site_id} className={`chip ${sel.includes(s.site_id) ? 'on' : ''}`}>
              <input type="checkbox" checked={sel.includes(s.site_id)}
                onChange={(e) => setSel(e.target.checked ? [...sel, s.site_id] : sel.filter((x) => x !== s.site_id))} />
              {short(s.region_name)}
            </label>
          ))}
        </div>
        <button className="accent big-btn" disabled={busy || !sel.length} onClick={run}>{busy ? 'Scanning…' : 'Find windows'}</button>
        <p className="caption">Artemis III surface stays are ~5.75–6.25 days (George et al., LPSC 2026), hence the 6-day default.</p>
      </section>
      {results && (
        <section className="panel">
          <header className="panel-h"><h3>{results.length ? `${results.length} windows found` : 'No window meets this rule'}</h3><span className="muted">{span}</span></header>
          {results.length === 0 ? (
            <p>Nothing in the selected dates satisfies every condition. Try lowering the Sun requirement, the coverage, the number of days, or raising the mast.</p>
          ) : (
            <table className="duel-t">
              <thead><tr><th>#</th><th>Site</th><th>Start (UTC)</th><th>End (UTC)</th><th>Rule met</th><th>Mean Sun disc</th><th>Earth in view</th><th /></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.siteId + r.startIdx}>
                    <td>{i + 1}</td><td>{r.name}</td>
                    <td>{fmtUTC(idxToDate(ephem.startMs, r.startIdx))}</td>
                    <td>{fmtUTC(idxToDate(ephem.startMs, r.startIdx + r.hours))}</td>
                    <td>{(r.coverage * 100).toFixed(1)}%</td>
                    <td>{(r.meanSun * 100).toFixed(0)}%</td>
                    <td>{r.earthPct.toFixed(0)}%</td>
                    <td><button onClick={() => onOpen(r.siteId, r.startIdx)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="caption">Ranking: share of hours meeting the rule, then mean visible Sun-disc fraction. Up to 5 non-overlapping windows per site.</p>
        </section>
      )}
    </div>
  )
}
