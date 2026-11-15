// The Horizon Ring: plan view of the site's 360 deg terrain horizon (grey) with
// Sun and Earth tracks. Radius encodes elevation angle; north is up, east right.
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import { useMemo } from 'react'
import type { Series } from '../lib/astro'

const EL_MIN = -6
const EL_MAX = 14

interface Props {
  H: ArrayLike<number>
  series: Series
  cursor: number // series index of the selected hour
  trackHours?: number // hours either side of cursor to draw
  size?: number
  compact?: boolean
}

export function HorizonRing({ H, series, cursor, trackHours = 354, size = 440, compact }: Props) {
  const c = size / 2
  const rIn = size * 0.09
  const rOut = size * 0.44
  const rad = (el: number) => rIn + ((Math.max(EL_MIN, Math.min(EL_MAX, el)) - EL_MIN) / (EL_MAX - EL_MIN)) * (rOut - rIn)
  const pt = (az: number, el: number) => {
    const a = (az * Math.PI) / 180
    const r = rad(el)
    return [c + r * Math.sin(a), c - r * Math.cos(a)]
  }

  const terrainPath = useMemo(() => {
    let d = ''
    for (let i = 0; i < H.length; i++) {
      const [x, y] = pt(i * 0.5, H[i])
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)
    }
    d += 'Z'
    // inner hole (counter-clockwise circle)
    d += `M${c + rIn},${c} A${rIn},${rIn} 0 1 0 ${c - rIn},${c} A${rIn},${rIn} 0 1 0 ${c + rIn},${c}Z`
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [H, size])

  const tracks = useMemo(() => {
    const a = Math.max(0, cursor - trackHours)
    const b = Math.min(series.n, cursor + trackHours)
    const sun: { x: number; y: number; vis: boolean }[] = []
    const earth: { x: number; y: number; vis: boolean }[] = []
    for (let k = a; k < b; k += 3) {
      const [sx, sy] = pt(series.sunAz[k], series.sunEl[k])
      sun.push({ x: sx, y: sy, vis: series.sunFrac[k] > 0 })
      const [ex, ey] = pt(series.earthAz[k], series.earthEl[k])
      earth.push({ x: ex, y: ey, vis: series.earthVis[k] === 1 })
    }
    return { sun, earth }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, cursor, trackHours, size])

  const k = Math.max(0, Math.min(series.n - 1, cursor))
  const [sx, sy] = pt(series.sunAz[k], series.sunEl[k])
  const [ex, ey] = pt(series.earthAz[k], series.earthEl[k])
  const sunVis = series.sunFrac[k] > 0
  const earthVis = series.earthVis[k] === 1
  const rings = [-5, 0, 5, 10]

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="ring" role="img"
      aria-label="Horizon ring: grey is terrain elevation angle around the site; amber dots are the Sun's path, cyan the Earth's">
      <circle cx={c} cy={c} r={rOut} className="ring-sky" />
      <path d={terrainPath} className="ring-terrain" fillRule="evenodd" />
      {rings.map((el) => (
        <g key={el}>
          <circle cx={c} cy={c} r={rad(el)} className={el === 0 ? 'ring-zero' : 'ring-grid'} />
          {!compact && <text x={c + 3} y={c - rad(el) - 3} className="ring-lbl">{el > 0 ? `+${el}` : el}°</text>}
        </g>
      ))}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((az) => {
        const [x1, y1] = pt(az, EL_MIN)
        const [x2, y2] = pt(az, EL_MAX)
        return <line key={az} x1={x1} y1={y1} x2={x2} y2={y2} className="ring-grid" />
      })}
      {tracks.sun.map((p, i) => <circle key={'s' + i} cx={p.x} cy={p.y} r={1.6} className={p.vis ? 'trk-sun' : 'trk-sun-hid'} />)}
      {tracks.earth.map((p, i) => <circle key={'e' + i} cx={p.x} cy={p.y} r={1.6} className={p.vis ? 'trk-earth' : 'trk-earth-hid'} />)}
      <line x1={c} y1={c} x2={sx} y2={sy} className="ray-sun" />
      <line x1={c} y1={c} x2={ex} y2={ey} className="ray-earth" />
      <circle cx={sx} cy={sy} r={compact ? 6 : 9} className={sunVis ? 'body-sun' : 'body-sun hid'} />
      <circle cx={ex} cy={ey} r={compact ? 5 : 7} className={earthVis ? 'body-earth' : 'body-earth hid'} />
      {(['N', 'E', 'S', 'W'] as const).map((l, i) => {
        const [x, y] = pt(i * 90, EL_MAX + 2.2)
        return <text key={l} x={x} y={y} className="ring-card" textAnchor="middle" dominantBaseline="middle">{l}</text>
      })}
      <circle cx={c} cy={c} r={3} className="ring-site" />
    </svg>
  )
}
