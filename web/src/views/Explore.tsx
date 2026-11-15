// Explore + Power & Comms Calendar for one site.
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import { Calendar } from '../components/Calendar'
import { HorizonRing } from '../components/HorizonRing'
import { Panorama } from '../components/Panorama'
import { DSN_STATIONS, type Ephem, type Site } from '../lib/data'
import { compass, fmtDeg, fmtDur, fmtUTC, idxToDate } from '../lib/format'
import { hoursUntilChange, metrics } from '../lib/metrics'
import type { Series } from '../lib/astro'

interface Props {
  site: Site
  ephem: Ephem
  H: Float64Array
  series: Series
  cursor: number
  setCursor: (k: number) => void
  mast: number
  calStart: number
}

export function Explore({ site, ephem, H, series, cursor, setCursor, mast, calStart }: Props) {
  const k = cursor
  const sunVis = series.sunFrac[k] > 0
  const earthVis = series.earthVis[k] === 1
  const toSun = hoursUntilChange(series.n, k, (i) => series.sunFrac[i] > 0)
  const toEarth = hoursUntilChange(series.n, k, (i) => series.earthVis[i] === 1)
  const calA = Math.max(0, Math.min(series.n - 30 * 24, calStart - (calStart % 24)))
  const m = metrics(series, calA, calA + 30 * 24)
  const dsnNow = DSN_STATIONS.filter((_, j) => series.dsnUp[k] & (1 << j))
  const clearance = series.sunEl[k] - series.sunHz[k]

  return (
    <div className="explore">
      <section className="panel ring-panel">
        <header className="panel-h">
          <h2>Horizon Ring</h2>
          <span className="muted">{fmtUTC(idxToDate(ephem.startMs, k))} · mast {mast} m</span>
        </header>
        <HorizonRing H={H} series={series} cursor={k} />
        <p className="legend">
          <span className="lg terrain" /> terrain horizon (LOLA)
          <span className="lg sun" /> Sun path ±15 d
          <span className="lg earth" /> Earth path
          <span className="lg hid" /> faded = hidden by terrain
        </p>
        <p className="caption">Plan view from the site, north up. Distance from centre = elevation angle (−6° centre to +14° edge); dashed circle = 0° local horizontal.</p>
      </section>

      <section className="panel status-panel">
        <div className={`status-card ${sunVis ? 'on-sun' : 'off'}`}>
          <div className="status-h">☀ Sun {sunVis ? (series.sunFrac[k] >= 0.999 ? 'fully visible' : 'partly visible') : 'hidden by terrain'}</div>
          <div className="big">{(series.sunFrac[k] * 100).toFixed(0)}<small>% of disc</small></div>
          <dl>
            <dt>Elevation</dt><dd>{fmtDeg(series.sunEl[k])}</dd>
            <dt>Azimuth</dt><dd>{series.sunAz[k].toFixed(1)}° {compass(series.sunAz[k])}</dd>
            <dt>Terrain there</dt><dd>{fmtDeg(series.sunHz[k])}</dd>
            <dt>Clearance</dt><dd className={clearance > 0 ? 'pos' : 'neg'}>{fmtDeg(clearance)}</dd>
            <dt>{sunVis ? 'Sunset in' : 'Sunrise in'}</dt><dd className="em">{fmtDur(toSun)}</dd>
          </dl>
        </div>
        <div className={`status-card ${earthVis ? 'on-earth' : 'off'}`}>
          <div className="status-h">⊕ Earth {earthVis ? 'in view' : 'below terrain'}</div>
          <div className="big">{fmtDeg(series.earthEl[k], 1)}<small> elevation</small></div>
          <dl>
            <dt>Azimuth</dt><dd>{series.earthAz[k].toFixed(1)}° {compass(series.earthAz[k])}</dd>
            <dt>Terrain there</dt><dd>{fmtDeg(series.earthHz[k])}</dd>
            <dt>{earthVis ? 'Earthset in' : 'Earthrise in'}</dt><dd className="em">{fmtDur(toEarth)}</dd>
            <dt>DSN complexes up</dt>
            <dd>{dsnNow.length ? dsnNow.map((d) => <span key={d.short} className="badge">{d.antenna} {d.complex}</span>) : <span className="muted">none ≥10°</span>}</dd>
          </dl>
        </div>
        <div className="time-ctl">
          <label>Scrub time (±15 days)</label>
          <input type="range" min={Math.max(0, k - 360)} max={Math.min(series.n - 1, k + 360)} value={k}
            onChange={(e) => setCursor(Number(e.target.value))} />
          <div className="btns">
            <button onClick={() => setCursor(Math.max(0, k - 24))}>−1 d</button>
            <button onClick={() => setCursor(Math.max(0, k - 1))}>−1 h</button>
            <button onClick={() => setCursor(Math.min(series.n - 1, k + 1))}>+1 h</button>
            <button onClick={() => setCursor(Math.min(series.n - 1, k + 24))}>+1 d</button>
            {toSun !== null && <button className="accent" onClick={() => setCursor(k + toSun)}>{sunVis ? 'Jump to sunset' : 'Jump to sunrise'}</button>}
          </div>
        </div>
      </section>

      <section className="panel pano-panel">
        <header className="panel-h"><h2>Panorama</h2><span className="muted">horizon unrolled: N → E → S → W → N</span></header>
        <Panorama H={H} series={series} cursor={k} />
      </section>

      <section className="panel cal-panel">
        <header className="panel-h">
          <h2>Power &amp; Comms Calendar</h2>
          <span className="muted">30 days from {fmtUTC(idxToDate(ephem.startMs, calA), false)} · all times UTC · click a cell to jump</span>
        </header>
        <div className="kpis">
          <Kpi label="Sunlit" value={`${m.sunPct.toFixed(1)}%`} sub={`${m.sunHours} h any disc · ${m.fullSunHours} h full disc`} tone="sun" />
          <Kpi label="Earth in view" value={`${m.earthPct.toFixed(1)}%`} sub={`${m.earthHours} h`} tone="earth" />
          <Kpi label="Sun + Earth" value={`${m.bothPct.toFixed(1)}%`} sub={`${m.bothHours} h together`} />
          <Kpi label="Earth + DSN ≥10°" value={`${m.dsnPct.toFixed(1)}%`} sub="geometric DTE link possible" tone="earth" />
          <Kpi label="Longest dark stretch" value={fmtDur(m.longestDark)} sub="no Sun disc — battery must cover" tone="warn" />
          <Kpi label="Longest Earth outage" value={fmtDur(m.longestNoEarth)} sub="no direct-to-Earth geometry" />
        </div>
        <Calendar series={series} startMs={ephem.startMs} a={calA} days={30} cursor={k} onPick={setCursor} />
        <p className="legend">
          <span className="lg sun" /> Sun visible (brighter = more of disc)
          <span className="lg earth" /> Earth above terrain
          <span className="lg dsn" /> + DSN complex sees Moon ≥10°
          <span className="lg off" /> none
        </p>
        <p className="caption">Visibility is geometric (terrain line of sight). Sunlight ≠ generated power and Earth in view ≠ a guaranteed radio link; battery sizing needs your load and array assumptions.</p>
      </section>
      <SiteFacts site={site} />
    </div>
  )
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-l">{label}</div>
      <div className="kpi-v">{value}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  )
}

function SiteFacts({ site }: { site: Site }) {
  const v = site.validation
  return (
    <section className="panel facts">
      <header className="panel-h"><h2>About this point</h2></header>
      <dl className="facts-dl">
        <dt>Coordinates</dt><dd>{site.coordinates.lat_deg.toFixed(4)}°, {site.coordinates.lon_deg.toFixed(4)}°E · elev {site.coordinates.surface_elev_m.toFixed(0)} m (rel. 1737.4 km)</dd>
        <dt>How chosen</dt><dd>{site.selection.method}. Anchor: {site.selection.anchor_source}.</dd>
        <dt>Status</dt><dd className="warn-t">{site.selection.note}</dd>
        <dt>Terrain</dt><dd>{site.dem_source}. {site.pixel_scale_warning}</dd>
        <dt>Check vs NASA map</dt><dd>18.6-yr sunlit: ours {v.ours_sun_pct.toFixed(1)}% vs PGDA {v.pgda69_sun_pct.toFixed(1)}% · Earth: ours {v.ours_earth_pct.toFixed(1)}% vs PGDA {v.pgda69_earth_pct?.toFixed(1)}%</dd>
      </dl>
    </section>
  )
}
