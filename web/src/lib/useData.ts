import { useEffect, useMemo, useState } from 'react'
import { computeSeries, maskFor, type Series } from './astro'
import { loadSite, type Ephem, type Site } from './data'

export function useSite(id: string | null): Site | null {
  const [site, setSite] = useState<Site | null>(null)
  useEffect(() => {
    let live = true
    if (!id) { setSite(null); return }
    loadSite(id).then((s) => live && setSite(s))
    return () => { live = false }
  }, [id])
  return site && site.site_id === id ? site : null
}

const seriesCache = new Map<string, Series>()

/** Full-span hourly series for a site + mast height (memoised). */
export function useSeries(site: Site | null, ephem: Ephem | null, mast: number) {
  return useMemo(() => {
    if (!site || !ephem) return null
    const key = `${site.site_id}|${mast}`
    const H = maskFor(site, mast)
    let s = seriesCache.get(key)
    if (!s) {
      s = computeSeries(site, ephem, H, mast)
      if (seriesCache.size > 24) seriesCache.clear()
      seriesCache.set(key, s)
    }
    return { H, series: s }
  }, [site, ephem, mast])
}
