// In-browser 720-ray horizon for custom coordinates, from a 240 m block-mean of
// NASA LOLA LDEM_80S_80M. Same geometry as pipeline/horizon.py (great-circle
// rays, curvature-correct elevation angle). Quick estimate: compared with our
// 80 m masks it is typically within ~0.2-1.3 deg RMS (see Methods).
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import type { Site } from './data'

const R0 = 1737400
const D2R = Math.PI / 180
const BASE = import.meta.env.BASE_URL

interface Dem { n: number; scale: number; lineOff: number; sampOff: number; z: Int16Array }
let demP: Promise<Dem> | null = null

export function loadDem(): Promise<Dem> {
  if (!demP) {
    demP = Promise.all([
      fetch(`${BASE}data/dem_240m.json`).then((r) => r.json()),
      fetch(`${BASE}data/dem_240m.bin`).then((r) => r.arrayBuffer()),
    ]).then(([m, buf]) => ({ n: m.lines, scale: m.scale_m, lineOff: m.line_off, sampOff: m.samp_off, z: new Int16Array(buf) }))
  }
  return demP
}

export function latlonToXY(lat: number, lon: number): [number, number] {
  const rho = 2 * R0 * Math.tan(Math.PI / 4 + (lat * D2R) / 2)
  return [rho * Math.sin(lon * D2R), rho * Math.cos(lon * D2R)]
}
export function xyToLatLon(x: number, y: number): [number, number] {
  const rho = Math.hypot(x, y)
  const lat = (2 * Math.atan(rho / (2 * R0)) - Math.PI / 2) / D2R
  let lon = Math.atan2(x, y) / D2R
  if (lon < 0) lon += 360
  return [lat, lon]
}

function heightAt(d: Dem, x: number, y: number): number {
  const s = d.sampOff + x / d.scale
  const l = d.lineOff - y / d.scale
  const l0 = Math.floor(l), s0 = Math.floor(s)
  if (l0 < 0 || s0 < 0 || l0 >= d.n - 1 || s0 >= d.n - 1) return NaN
  const fl = l - l0, fs = s - s0, i = l0 * d.n + s0
  return d.z[i] * (1 - fl) * (1 - fs) + d.z[i + d.n] * fl * (1 - fs) + d.z[i + 1] * (1 - fl) * fs + d.z[i + d.n + 1] * fl * fs
}

const MASTS = [0, 1, 2, 5, 10]

export async function customSite(lat: number, lon: number): Promise<Site> {
  const d = await loadDem()
  const [x0, y0] = latlonToXY(lat, lon)
  const z0 = heightAt(d, x0, y0)
  if (!isFinite(z0)) throw new Error('Point is outside the 80°S–90°S terrain grid')
  const step = 120, dmin = 360, dmax = 150000
  const nD = Math.floor((dmax - dmin) / step) + 1
  const la1 = lat * D2R, lo1 = lon * D2R
  const sinLa1 = Math.sin(la1), cosLa1 = Math.cos(la1)
  const masks = MASTS.map(() => new Array<number>(720).fill(-90))
  const dist0 = new Array<number>(720).fill(0)
  let outside = 0, total = 0
  // precompute per-distance trig
  const cosP = new Float64Array(nD), sinP = new Float64Array(nD)
  for (let j = 0; j < nD; j++) { const p = (dmin + j * step) / R0; cosP[j] = Math.cos(p); sinP[j] = Math.sin(p) }
  for (let k = 0; k < 720; k++) {
    const az = k * 0.5 * D2R
    const cosAz = Math.cos(az), sinAz = Math.sin(az)
    const best = MASTS.map(() => -90)
    for (let j = 0; j < nD; j++) {
      const sinLa2 = sinLa1 * cosP[j] + cosLa1 * sinP[j] * cosAz
      const la2 = Math.asin(sinLa2)
      const lo2 = lo1 + Math.atan2(sinAz * sinP[j] * cosLa1, cosP[j] - sinLa1 * sinLa2)
      const rho = 2 * R0 * Math.tan(Math.PI / 4 + la2 / 2)
      const z = heightAt(d, rho * Math.sin(lo2), rho * Math.cos(lo2))
      total++
      if (!isFinite(z)) { outside++; continue }
      const rt = R0 + z
      for (let m = 0; m < MASTS.length; m++) {
        const ro = R0 + z0 + MASTS[m]
        const th = Math.atan2(rt * cosP[j] - ro, rt * sinP[j]) / D2R
        if (th > best[m]) { best[m] = th; if (m === 0) dist0[k] = (dmin + j * step) / 1000 }
      }
    }
    for (let m = 0; m < MASTS.length; m++) masks[m][k] = best[m]
  }
  const id = `custom_${lat.toFixed(3)}_${lon.toFixed(3)}`
  const outFrac = outside / total
  return {
    site_id: id,
    region_name: `Custom point ${lat.toFixed(3)}°, ${lon.toFixed(3)}°E`,
    kind: 'reference',
    frame: 'MOON_ME',
    reference_radius_m: R0,
    coordinates: { lat_deg: lat, lon_deg: lon, stereo_x_m: x0, stereo_y_m: y0, surface_elev_m: z0 },
    selection: {
      method: 'User-selected point; horizon computed in your browser',
      anchor_source: 'clicked on the map / typed coordinates',
      anchor_lat_lon: [lat, lon], search_radius_km: [0, 0],
      note: `Quick estimate from 240 m terrain (LOLA LDEM_80S_80M, 3×3 mean)${outFrac > 0.01 ? ` — ${(outFrac * 100).toFixed(0)}% of ray samples fell outside the 80°S grid, so distant terrain is missing` : ''}. Typical error vs our 80 m masks ≈0.2–1.3° RMS; sharp summits are over-lit.`,
    },
    dem_source: 'LRO LOLA LDEM_80S_80M block-averaged to 240 m/px (PDS Geosciences Node)',
    dem_resolution_m: 240,
    pixel_scale_warning: 'Terrain smaller than ~240 m is not resolved; rays start 360 m from the point.',
    azimuth_step_deg: 0.5,
    horizons_by_mast_m: Object.fromEntries(MASTS.map((m, i) => [m.toFixed(1), masks[i]])),
    horizon_distance_km_mast0: dist0,
    validation: {
      span: 'n/a (custom point)', definition: '', ours_sun_pct: NaN, pgda69_sun_pct: NaN,
      ours_earth_pct: NaN, pgda69_earth_pct: null, pgda69_note: '',
    },
  }
}
