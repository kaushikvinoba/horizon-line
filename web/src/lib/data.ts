// Data loading for Horizon Line. All data are precomputed from NASA sources by
// the Python pipeline in /pipeline (see README). Written with AI assistance (Claude).

export interface SiteIndex {
  site_id: string
  region_name: string
  kind: 'candidate' | 'reference'
  coordinates: { lat_deg: number; lon_deg: number; stereo_x_m: number; stereo_y_m: number; surface_elev_m: number }
  validation: {
    span: string
    definition: string
    ours_sun_pct: number
    pgda69_sun_pct: number
    ours_earth_pct: number
    pgda69_earth_pct: number | null
    pgda69_note: string
  }
}

export interface Site extends SiteIndex {
  frame: string
  reference_radius_m: number
  selection: { method: string; anchor_source: string; anchor_lat_lon: number[]; search_radius_km: number[]; note: string }
  dem_source: string
  dem_resolution_m: number
  pixel_scale_warning: string
  azimuth_step_deg: number
  horizons_by_mast_m: Record<string, number[]>
  horizon_distance_km_mast0: number[]
}

export interface Ephem {
  startMs: number
  count: number
  vec: Float32Array // N*6 : sun xyz, earth xyz (km, MOON_ME, Moon centre)
  dsn: Int8Array // N*3 : Moon elevation (deg) at Goldstone, Madrid, Canberra
  meta: Record<string, unknown>
}

const BASE = import.meta.env.BASE_URL

export async function loadIndex(): Promise<SiteIndex[]> {
  const r = await fetch(`${BASE}data/sites.json`)
  return r.json()
}

const siteCache = new Map<string, Promise<Site>>()
export function loadSite(id: string): Promise<Site> {
  if (!siteCache.has(id)) siteCache.set(id, fetch(`${BASE}data/sites/${id}.json`).then((r) => r.json()))
  return siteCache.get(id)!
}

export async function loadEphem(): Promise<Ephem> {
  const [meta, vecBuf, dsnBuf] = await Promise.all([
    fetch(`${BASE}data/ephem.json`).then((r) => r.json()),
    fetch(`${BASE}data/ephem.bin`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}data/dsn.bin`).then((r) => r.arrayBuffer()),
  ])
  return {
    startMs: Date.parse(meta.start_utc),
    count: meta.count,
    vec: new Float32Array(vecBuf),
    dsn: new Int8Array(dsnBuf),
    meta,
  }
}

export const MASTS = [0, 1, 2, 5, 10]
export const DSN_STATIONS = [
  { complex: 'Goldstone', antenna: 'DSS-14', short: 'GDS' },
  { complex: 'Madrid', antenna: 'DSS-63', short: 'MAD' },
  { complex: 'Canberra', antenna: 'DSS-43', short: 'CAN' },
]
