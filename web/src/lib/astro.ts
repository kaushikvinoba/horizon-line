// Topocentric Sun/Earth geometry on the Moon + terrain visibility.
// Mirrors pipeline/visibility.py exactly (validated against JPL Horizons to 0.001 deg).
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import type { Ephem, Site } from './data'

export const R0_KM = 1737.4
const R_SUN = 695700
const R_EARTH = 6371
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

/** Horizon mask for any mast height 0..10 m, interpolated between precomputed masks. */
export function maskFor(site: Site, mast: number): Float64Array {
  const ms = Object.keys(site.horizons_by_mast_m).map(Number).sort((a, b) => a - b)
  let lo = ms[0], hi = ms[ms.length - 1]
  for (const m of ms) { if (m <= mast) lo = m; if (m >= mast) { hi = m; break } }
  const A = site.horizons_by_mast_m[lo.toFixed(1)]
  const B = site.horizons_by_mast_m[hi.toFixed(1)]
  const t = hi === lo ? 0 : (mast - lo) / (hi - lo)
  const out = new Float64Array(A.length)
  for (let i = 0; i < A.length; i++) out[i] = A[i] * (1 - t) + B[i] * t
  return out
}

export function horizonAt(H: ArrayLike<number>, az: number, step = 0.5): number {
  const x = (((az % 360) + 360) % 360) / step
  const i0 = Math.floor(x) % H.length
  const i1 = (i0 + 1) % H.length
  const f = x - Math.floor(x)
  return H[i0] * (1 - f) + H[i1] * f
}

export function discFraction(el: number, hz: number, r: number): number {
  const u = (el - hz) / r
  if (u <= -1) return 0
  if (u >= 1) return 1
  return 0.5 + (u * Math.sqrt(1 - u * u) + Math.asin(u)) / Math.PI
}

export interface Series {
  n: number
  i0: number
  sunAz: Float32Array; sunEl: Float32Array; sunHz: Float32Array; sunFrac: Float32Array
  earthAz: Float32Array; earthEl: Float32Array; earthHz: Float32Array; earthVis: Uint8Array
  dsnUp: Uint8Array // bit mask: 1 Goldstone, 2 Madrid, 4 Canberra (Moon >= 10 deg)
}

/** Compute hourly visibility for a site from ephemeris index i0 for n hours. */
export function computeSeries(site: Site, ephem: Ephem, H: ArrayLike<number>, mast: number, i0 = 0, n = ephem.count): Series {
  n = Math.max(0, Math.min(n, ephem.count - i0))
  const la = site.coordinates.lat_deg * D2R
  const lo = site.coordinates.lon_deg * D2R
  const r = R0_KM + (site.coordinates.surface_elev_m + mast) / 1000
  const ux = Math.cos(la) * Math.cos(lo), uy = Math.cos(la) * Math.sin(lo), uz = Math.sin(la)
  const ex = -Math.sin(lo), ey = Math.cos(lo)
  const nx = -Math.sin(la) * Math.cos(lo), ny = -Math.sin(la) * Math.sin(lo), nz = Math.cos(la)
  const px = ux * r, py = uy * r, pz = uz * r
  const s: Series = {
    n, i0,
    sunAz: new Float32Array(n), sunEl: new Float32Array(n), sunHz: new Float32Array(n), sunFrac: new Float32Array(n),
    earthAz: new Float32Array(n), earthEl: new Float32Array(n), earthHz: new Float32Array(n), earthVis: new Uint8Array(n),
    dsnUp: new Uint8Array(n),
  }
  const V = ephem.vec
  for (let k = 0; k < n; k++) {
    const j = (i0 + k) * 6
    for (let b = 0; b < 2; b++) {
      const vx = V[j + b * 3] - px, vy = V[j + b * 3 + 1] - py, vz = V[j + b * 3 + 2] - pz
      const d = Math.hypot(vx, vy, vz)
      const el = Math.asin((vx * ux + vy * uy + vz * uz) / d) * R2D
      let az = Math.atan2(vx * ex + vy * ey, vx * nx + vy * ny + vz * nz) * R2D
      if (az < 0) az += 360
      const hz = horizonAt(H, az)
      if (b === 0) {
        s.sunAz[k] = az; s.sunEl[k] = el; s.sunHz[k] = hz
        s.sunFrac[k] = discFraction(el, hz, Math.asin(R_SUN / d) * R2D)
      } else {
        s.earthAz[k] = az; s.earthEl[k] = el; s.earthHz[k] = hz
        s.earthVis[k] = el > hz ? 1 : 0
      }
    }
    const q = (i0 + k) * 3
    s.dsnUp[k] = (ephem.dsn[q] >= 10 ? 1 : 0) | (ephem.dsn[q + 1] >= 10 ? 2 : 0) | (ephem.dsn[q + 2] >= 10 ? 4 : 0)
  }
  return s
}

export function earthAngularRadius(): number { return Math.asin(R_EARTH / 384400) * R2D }
