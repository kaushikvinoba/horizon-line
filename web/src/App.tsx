// Horizon Line — Lunar Landing Site Navigator (Team Horvan, NASA Space Apps 2026).
// Written with AI assistance (Claude, Anthropic).
import { useEffect, useState } from 'react'
import { loadEphem, loadIndex, MASTS, type Ephem, type SiteIndex } from './lib/data'
import { dateToIdx, fromInputValue, idxToDate, toInputValue } from './lib/format'
import { useSeries, useSite } from './lib/useData'
import { Classroom } from './views/Classroom'
import { Duel } from './views/Duel'
import { Explore } from './views/Explore'
import { Finder } from './views/Finder'
import { Methods } from './views/Methods'

type Tab = 'explore' | 'duel' | 'finder' | 'classroom' | 'methods'
const TABS: { id: Tab; label: string }[] = [
  { id: 'explore', label: 'Horizon & Calendar' },
  { id: 'duel', label: 'Site Duel' },
  { id: 'finder', label: 'Window Finder' },
  { id: 'classroom', label: 'Classroom' },
  { id: 'methods', label: 'Methods & Data' },
]
const short = (n: string) => n.replace(' (Artemis III candidate region)', '')

export default function App() {
  const [index, setIndex] = useState<SiteIndex[] | null>(null)
  const [ephem, setEphem] = useState<Ephem | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || 'explore')
  const [siteId, setSiteId] = useState('nobile_rim_1')
  const [duelB, setDuelB] = useState('malapert_massif')
  const [duelDays, setDuelDays] = useState(30)
  const [mast, setMast] = useState(2)
  const [cursor, setCursor] = useState(0)
  const [calStart, setCalStart] = useState(0)

  useEffect(() => {
    Promise.all([loadIndex(), loadEphem()])
      .then(([i, e]) => {
        setIndex(i)
        setEphem(e)
        const now = Math.max(0, Math.min(e.count - 1, dateToIdx(e.startMs, new Date())))
        setCursor(now)
        setCalStart(now - (now % 24))
      })
      .catch((x) => setErr(String(x)))
  }, [])
  useEffect(() => { history.replaceState(null, '', '#' + tab) }, [tab])

  const site = useSite(siteId)
  const data = useSeries(site, ephem, mast)

  const setDate = (v: string) => {
    if (!ephem || !v) return
    const k = Math.max(0, Math.min(ephem.count - 1, dateToIdx(ephem.startMs, fromInputValue(v))))
    setCursor(k)
    setCalStart(k - (k % 24))
  }
  const jump = (k: number) => setCursor(k)

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 40 40" className="logo" aria-hidden>
            <circle cx="20" cy="20" r="17" className="logo-ring" />
            <path d="M3,24 L11,19 L16,22 L22,15 L29,21 L37,18 L37,24 Z" className="logo-terrain" />
            <circle cx="30" cy="12" r="3.2" className="logo-sun" />
          </svg>
          <div>
            <h1>Horizon Line</h1>
            <p className="tag">Lunar south pole landing-site navigator · Team Horvan · NASA Space Apps 2026</p>
          </div>
        </div>
        {index && ephem && (
          <div className="controls">
            <label>Site
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <optgroup label="Artemis III candidate regions (representative points)">
                  {index.filter((s) => s.kind === 'candidate').map((s) => <option key={s.site_id} value={s.site_id}>{short(s.region_name)}</option>)}
                </optgroup>
                <optgroup label="Reference">
                  {index.filter((s) => s.kind === 'reference').map((s) => <option key={s.site_id} value={s.site_id}>{s.region_name}</option>)}
                </optgroup>
              </select>
            </label>
            <label>Date &amp; time (UTC)
              <input type="datetime-local" value={toInputValue(idxToDate(ephem.startMs, cursor))} min="2026-01-01T00:00" max="2030-12-31T23:00"
                onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>Mast
              <select value={mast} onChange={(e) => setMast(Number(e.target.value))}>
                {MASTS.map((m) => <option key={m} value={m}>{m} m</option>)}
              </select>
            </label>
          </div>
        )}
      </header>
      <nav className="tabs">
        {TABS.map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>
      <main>
        {err && <div className="panel error">Could not load data: {err}</div>}
        {!err && (!index || !ephem) && <div className="panel loading">Loading NASA terrain horizons and SPICE ephemeris…</div>}
        {index && ephem && site && data && tab === 'explore' && (
          <Explore site={site} ephem={ephem} H={data.H} series={data.series} cursor={cursor} setCursor={jump} mast={mast} calStart={calStart} />
        )}
        {index && ephem && tab === 'duel' && (
          <Duel index={index} ephem={ephem} a={siteId} b={duelB} setA={setSiteId} setB={setDuelB} mast={mast} start={calStart} days={duelDays} setDays={setDuelDays} cursor={cursor} />
        )}
        {index && ephem && tab === 'finder' && (
          <Finder index={index} ephem={ephem} mast={mast} onOpen={(id, k) => { setSiteId(id); setCursor(k); setCalStart(k - (k % 24)); setTab('explore') }} />
        )}
        {index && ephem && site && tab === 'classroom' && <Classroom site={site} ephem={ephem} cursor={cursor} setCursor={jump} />}
        {index && tab === 'methods' && <Methods index={index} />}
      </main>
      <footer className="foot">
        Data: NASA LRO LOLA (PDS), NASA/JPL NAIF SPICE (DE440), JPL Horizons check, Mazarico et al. 2011 / PGDA 69. Geometric visibility only — not an operational planning product.
        Not affiliated with or endorsed by NASA. Built with AI assistance (Claude, Anthropic). <a href="https://github.com/kaushikvinoba/horizon-line" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </div>
  )
}
