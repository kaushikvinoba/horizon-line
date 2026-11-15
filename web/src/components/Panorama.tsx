// Panorama: unrolled 360 deg horizon (azimuth along x, elevation up) with the
// Sun and Earth paths. The most direct way to see "is it above the ridge?".
// Developed by Team Horvan, using Claude (Anthropic) as an AI coding assistant.
import { useMemo, type ReactElement } from 'react'
import type { Series } from '../lib/astro'

interface Props {
  H: ArrayLike<number>
  series: Series
  cursor: number
  trackHours?: number
  height?: number
}

export function Panorama({ H, series, cursor, trackHours = 354, height = 220 }: Props) {
  const W = 1000
  const pad = { l: 34, r: 8, t: 10, b: 22 }
  const k = Math.max(0, Math.min(series.n - 1, cursor))
  const [elMin, elMax] = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < H.length; i++) { lo = Math.min(lo, H[i]); hi = Math.max(hi, H[i]) }
    const a = Math.max(0, cursor - trackHours), b = Math.min(series.n, cursor + trackHours)
    for (let i = a; i < b; i++) {
      hi = Math.max(hi, series.sunEl[i], series.earthEl[i])
      lo = Math.min(lo, series.sunEl[i], series.earthEl[i])
    }
    return [Math.floor(Math.max(-8, lo) - 0.5), Math.ceil(Math.min(15, hi) + 0.8)]
  }, [H, series, cursor, trackHours])
  const x = (az: number) => pad.l + (az / 360) * (W - pad.l - pad.r)
  const y = (el: number) => pad.t + (1 - (el - elMin) / (elMax - elMin)) * (height - pad.t - pad.b)

  const terrain = useMemo(() => {
    let d = `M${x(0)},${y(elMin)}`
    for (let i = 0; i < H.length; i++) d += `L${x(i * 0.5).toFixed(1)},${y(Math.max(elMin, H[i])).toFixed(1)}`
    d += `L${x(360)},${y(Math.max(elMin, H[0]))}L${x(360)},${y(elMin)}Z`
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [H, elMin, elMax])

  const pts = useMemo(() => {
    const a = Math.max(0, cursor - trackHours), b = Math.min(series.n, cursor + trackHours)
    const s: ReactElement[] = []
    for (let i = a; i < b; i += 2) {
      s.push(<circle key={'s' + i} cx={x(series.sunAz[i])} cy={y(series.sunEl[i])} r={1.5} className={series.sunFrac[i] > 0 ? 'trk-sun' : 'trk-sun-hid'} />)
      s.push(<circle key={'e' + i} cx={x(series.earthAz[i])} cy={y(series.earthEl[i])} r={1.5} className={series.earthVis[i] ? 'trk-earth' : 'trk-earth-hid'} />)
    }
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, cursor, trackHours, elMin, elMax])

  const ticks: number[] = []
  for (let e = Math.ceil(elMin); e <= elMax; e++) if (e % 2 === 0) ticks.push(e)

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="pano" preserveAspectRatio="none" role="img"
      aria-label="Panorama of the terrain horizon with Sun and Earth paths">
      {ticks.map((e) => (
        <g key={e}>
          <line x1={pad.l} x2={W - pad.r} y1={y(e)} y2={y(e)} className={e === 0 ? 'ring-zero' : 'ring-grid'} />
          <text x={pad.l - 4} y={y(e) + 3} className="ax-lbl" textAnchor="end">{e}°</text>
        </g>
      ))}
      {[0, 90, 180, 270, 360].map((az, i) => (
        <text key={az} x={x(az)} y={height - 6} className="ax-lbl" textAnchor="middle">{['N', 'E', 'S', 'W', 'N'][i]}</text>
      ))}
      <path d={terrain} className="ring-terrain" />
      {pts}
      <circle cx={x(series.sunAz[k])} cy={y(series.sunEl[k])} r={7} className={series.sunFrac[k] > 0 ? 'body-sun' : 'body-sun hid'} />
      <circle cx={x(series.earthAz[k])} cy={y(series.earthEl[k])} r={6} className={series.earthVis[k] ? 'body-earth' : 'body-earth hid'} />
    </svg>
  )
}
