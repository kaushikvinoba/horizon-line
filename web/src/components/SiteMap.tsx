// Clickable south-pole map (80-90 S) coloured by NASA PGDA-69 average solar
// illumination, with the candidate sites. Click to analyse any point.
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import { useState } from 'react'
import type { SiteIndex } from '../lib/data'
import { latlonToXY, xyToLatLon } from '../lib/terrain'

const EXTENT = 303960 // m, half-width of the 80S grid (7600 px * 80 m / 2)
const BASE = import.meta.env.BASE_URL
const short = (n: string) => n.replace(' (Artemis III candidate region)', '')
// label offsets to avoid overlaps in the crowded Malapert / Mons Mouton area
const LBL: Record<string, [number, number, 'start' | 'end']> = {
  malapert_massif: [-8, 4, 'end'], mons_mouton: [-8, -8, 'end'], nobile_rim_1: [8, 12, 'start'],
  mons_mouton_plateau: [8, -2, 'start'], ref_peak_near_shackleton: [8, 12, 'start'],
}

interface Props {
  index: SiteIndex[]
  selected: string
  custom: { lat: number; lon: number } | null
  onSelect: (id: string) => void
  onCustom: (lat: number, lon: number) => void
  busy: boolean
}

export function SiteMap({ index, selected, custom, onSelect, onCustom, busy }: Props) {
  const S = 600
  const toPx = (lat: number, lon: number) => {
    const [x, y] = latlonToXY(lat, lon)
    return [S / 2 + (x / EXTENT) * (S / 2), S / 2 - (y / EXTENT) * (S / 2)]
  }
  const [lat, setLat] = useState('-85.5')
  const [lon, setLon] = useState('30')
  const [hover, setHover] = useState<string>('')

  const fromEvent = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * S
    const py = ((e.clientY - r.top) / r.height) * S
    const x = ((px - S / 2) / (S / 2)) * EXTENT
    const y = -((py - S / 2) / (S / 2)) * EXTENT
    return xyToLatLon(x, y)
  }

  const lonLines = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  const latRings = [-80, -82, -84, -86, -88]

  return (
    <div className="map-wrap">
      <svg viewBox={`0 0 ${S} ${S}`} className="map" role="img" aria-label="South pole illumination map; click to analyse a point"
        onClick={(e) => { if (busy) return; const [la, lo] = fromEvent(e); if (la <= -80) onCustom(la, lo) }}
        onMouseMove={(e) => { const [la, lo] = fromEvent(e); setHover(la <= -80 ? `${la.toFixed(3)}°, ${lo.toFixed(2)}°E` : '') }}
        onMouseLeave={() => setHover('')}>
        <image href={`${BASE}data/illum_map.png`} x={0} y={0} width={S} height={S} />
        {latRings.map((la) => { const r = (latlonToXY(la, 0)[1] / EXTENT) * (S / 2); return <circle key={la} cx={S / 2} cy={S / 2} r={Math.abs(r)} className="map-grid" /> })}
        {lonLines.map((lo) => { const [x, y] = toPx(-80, lo); return <line key={lo} x1={S / 2} y1={S / 2} x2={x} y2={y} className="map-grid" /> })}
        {[0, 90, 180, 270].map((lo) => { const [x, y] = toPx(-80.7, lo); return <text key={lo} x={x} y={y} className="map-lbl" textAnchor="middle" dominantBaseline="middle">{lo}°</text> })}
        {index.map((s) => {
          const [x, y] = toPx(s.coordinates.lat_deg, s.coordinates.lon_deg)
          const on = s.site_id === selected
          return (
            <g key={s.site_id} className="map-site" onClick={(e) => { e.stopPropagation(); onSelect(s.site_id) }}>
              <circle cx={x} cy={y} r={on ? 7 : 5} className={on ? 'map-dot on' : s.kind === 'candidate' ? 'map-dot' : 'map-dot ref'} />
              <text x={x + (LBL[s.site_id]?.[0] ?? 8)} y={y + (LBL[s.site_id]?.[1] ?? 4)} textAnchor={LBL[s.site_id]?.[2] ?? 'start'} className="map-name">{short(s.region_name).replace('Reference point: ', '')}</text>
            </g>
          )
        })}
        {custom && (() => { const [x, y] = toPx(custom.lat, custom.lon); return <g><circle cx={x} cy={y} r={7} className="map-dot custom" /><text x={x + 9} y={y + 4} className="map-name">Custom</text></g> })()}
        <circle cx={S / 2} cy={S / 2} r={2} fill="#fff" />
      </svg>
      <div className="map-side">
        <p className="muted">Colour = average fraction of time sunlit (NASA PGDA Product 69, Mazarico et al. 2011): dark = permanent shadow, amber = most lit. Click a site, or click anywhere to analyse a custom point.</p>
        <div className="map-scale"><span>0%</span><i /><span>100% lit</span></div>
        <p className="mono">{hover || ' '}</p>
        <form className="coord-form" onSubmit={(e) => { e.preventDefault(); const a = Number(lat), b = Number(lon); if (a <= -80 && a > -90 && isFinite(b)) onCustom(a, ((b % 360) + 360) % 360) }}>
          <label>Lat (°, −80 to −90)<input value={lat} onChange={(e) => setLat(e.target.value)} /></label>
          <label>Lon (°E)<input value={lon} onChange={(e) => setLon(e.target.value)} /></label>
          <button className="accent" disabled={busy}>{busy ? 'Computing…' : 'Analyse point'}</button>
        </form>
        <p className="caption">Custom points: the 720-ray horizon is computed in your browser from 240 m LOLA terrain (12 MB, loaded on first use). It's a quick estimate; the 9 candidate sites use 80 m terrain.</p>
      </div>
    </div>
  )
}
