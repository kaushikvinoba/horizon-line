// Classroom Mode: plain-language view with a time slider, play button and
// mast-height slider, built on the same real data as the planner views.
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import { useEffect, useState } from 'react'
import { HorizonRing } from '../components/HorizonRing'
import { Panorama } from '../components/Panorama'
import type { Ephem, Site } from '../lib/data'
import { compass, fmtDur, fmtUTC, idxToDate } from '../lib/format'
import { hoursUntilChange } from '../lib/metrics'
import { useSeries } from '../lib/useData'

interface Props { site: Site; ephem: Ephem; cursor: number; setCursor: (k: number) => void }

const dirWord = (az: number) => ({ N: 'north', NNE: 'north', NE: 'north-east', ENE: 'east', E: 'east', ESE: 'east', SE: 'south-east', SSE: 'south', S: 'south', SSW: 'south', SW: 'south-west', WSW: 'west', W: 'west', WNW: 'west', NW: 'north-west', NNW: 'north' } as Record<string, string>)[compass(az)]

export function Classroom({ site, ephem, cursor, setCursor }: Props) {
  const [mast, setMast] = useState(0)
  const [playing, setPlaying] = useState(false)
  const data = useSeries(site, ephem, Math.round(mast * 2) / 2)
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setCursor(Math.min(ephem.count - 1, cursor + 2)), 60)
    return () => clearInterval(t)
  }, [playing, cursor, setCursor, ephem.count])
  if (!data) return null
  const { H, series } = data
  const k = cursor
  const sunUp = series.sunFrac[k] > 0
  const earthUp = series.earthVis[k] === 1
  const sunEl = series.sunEl[k], hz = series.sunHz[k]
  const toSun = hoursUntilChange(series.n, k, (i) => series.sunFrac[i] > 0)
  const name = site.region_name.replace(' (Artemis III candidate region)', '')
  const monthStart = k - 354, monthEnd = k + 354

  let story: string
  if (sunEl < 0 && !sunUp) story = `The Sun is ${Math.abs(sunEl).toFixed(1)}° below the flat horizon — it's night here, like on Earth.`
  else if (!sunUp) story = `The Sun is ${sunEl.toFixed(1)}° above a perfectly flat horizon, but the terrain toward the ${dirWord(series.sunAz[k])} rises to ${hz.toFixed(1)}°. A ridge is blocking it, so this spot is in shadow even though it is "daytime".`
  else if (series.sunFrac[k] < 0.999) story = `The Sun is peeking over the ${dirWord(series.sunAz[k])} ridge — only ${(series.sunFrac[k] * 100).toFixed(0)}% of its disc is showing.`
  else story = `The Sun is ${sunEl.toFixed(1)}° up in the ${dirWord(series.sunAz[k])} and clears the terrain by ${(sunEl - hz).toFixed(1)}°. Solar panels here would see the whole Sun — but standing almost sideways, because it never climbs high.`

  return (
    <div className="classroom">
      <section className="panel class-hero">
        <h2>Why is the Moon's south pole so tricky?</h2>
        <p className="lead">You are standing at <b>{name}</b>, near the Moon's south pole, on {fmtUTC(idxToDate(ephem.startMs, k))}.</p>
        <p className="story">{story}</p>
        <p className="story">{earthUp ? `Earth is ${series.earthEl[k].toFixed(1)}° above the horizon in the ${dirWord(series.earthAz[k])} — you could radio home directly.` : `Earth is hidden behind the horizon right now — no direct radio call home without a relay satellite.`}</p>
        <p className="story muted">{sunUp ? 'Sunset' : 'Sunrise'} here comes in about <b>{fmtDur(toSun)}</b>. On Earth a day lasts 24 hours; on the Moon one full day-night cycle takes about 29.5 Earth days.</p>
        <div className="class-ctl">
          <button className="accent" onClick={() => setPlaying(!playing)}>{playing ? '❚❚ Pause' : '▶ Play time'}</button>
          <label>Time <input type="range" min={Math.max(0, monthStart)} max={Math.min(ephem.count - 1, monthEnd)} value={k} onChange={(e) => setCursor(Number(e.target.value))} /></label>
          <label>Mast height: <b>{mast.toFixed(1)} m</b> <input type="range" min={0} max={10} step={0.5} value={mast} onChange={(e) => setMast(Number(e.target.value))} /></label>
        </div>
      </section>
      <div className="class-grid">
        <section className="panel"><HorizonRing H={H} series={series} cursor={k} size={400} /></section>
        <section className="panel">
          <Panorama H={H} series={series} cursor={k} height={260} />
          <p className="caption">Grey = the mountains and crater rims around you. Yellow dots = where the Sun goes over a month; blue = Earth. When a dot dips into the grey, that body is hidden.</p>
        </section>
      </div>
      <div className="cards">
        <article className="panel card">
          <h3>1 · The Sun never climbs high</h3>
          <svg viewBox="0 0 300 120" className="mini"><line x1="10" y1="100" x2="290" y2="100" className="ring-zero" /><path d="M10,100 Q150,88 290,100" className="mini-sun-path" /><circle cx="150" cy="91" r="7" className="body-sun" /><text x="150" y="80" textAnchor="middle" className="ax-lbl">~1.5° max at the pole</text></svg>
          <p>The Moon's axis is tilted only about 1.5° relative to the Sun, so at the pole the Sun just circles around the horizon instead of rising overhead.</p>
        </article>
        <article className="panel card">
          <h3>2 · A small hill makes a long shadow</h3>
          <svg viewBox="0 0 300 120" className="mini"><path d="M0,110 L110,110 L160,70 L210,110 L300,110 Z" className="ring-terrain" /><line x1="20" y1="104" x2="290" y2="62" className="ray-sun" /><circle cx="290" cy="60" r="7" className="body-sun hid" /><circle cx="20" cy="106" r="3" className="ring-site" /></svg>
          <p>With the Sun that low, any ridge between you and the Sun blocks it. Two spots a few kilometres apart can be lit most of the year — or almost never.</p>
        </article>
        <article className="panel card">
          <h3>3 · Earth bobs at the horizon</h3>
          <svg viewBox="0 0 300 120" className="mini"><line x1="10" y1="80" x2="290" y2="80" className="ring-zero" /><path d="M10,80 C60,40 110,40 150,80 S240,120 290,80" className="mini-earth-path" /><circle cx="80" cy="50" r="7" className="body-earth" /></svg>
          <p>From the south pole, Earth hangs near the horizon and slowly wobbles up and down (libration) over about a month — so radio contact comes and goes.</p>
        </article>
        <article className="panel card">
          <h3>4 · Try it: raise the mast</h3>
          <p>Drag the mast slider. A taller mast lifts the solar panel or antenna above nearby bumps, so the grey horizon drops a little and the Sun or Earth may peek out earlier.</p>
          <p className="muted">Our terrain map has 80 m pixels, so boulders and tiny craters are not in it — real horizons are a bit rougher.</p>
        </article>
      </div>
    </div>
  )
}
