// Aggregate metrics, transitions and the Window Finder scan.
// Developed by Team Horvan, using Claude (Anthropic) as an AI coding assistant.
import type { Series } from './astro'

export interface Metrics {
  hours: number
  sunHours: number // any part of disc above terrain
  sunPct: number
  fullSunHours: number // whole disc clear
  sunEquivHours: number // sum of visible disc fraction
  earthHours: number
  earthPct: number
  bothHours: number
  bothPct: number
  dsnHours: number // Earth in view AND >=1 DSN complex sees the Moon >= 10 deg
  dsnPct: number
  longestDark: number // longest run of hours with no Sun disc visible
  longestNoEarth: number
  meanSunElLit: number
}

export function metrics(s: Series, a = 0, b = s.n): Metrics {
  let sun = 0, full = 0, eq = 0, earth = 0, both = 0, dsn = 0, run = 0, longest = 0, runE = 0, longestE = 0, elSum = 0
  for (let k = a; k < b; k++) {
    const f = s.sunFrac[k]
    const lit = f > 0
    const ev = s.earthVis[k] === 1
    if (lit) { sun++; elSum += s.sunEl[k] }
    if (f >= 0.999) full++
    eq += f
    if (ev) earth++
    if (lit && ev) both++
    if (ev && s.dsnUp[k]) dsn++
    run = lit ? 0 : run + 1
    if (run > longest) longest = run
    runE = ev ? 0 : runE + 1
    if (runE > longestE) longestE = runE
  }
  const h = Math.max(1, b - a)
  return {
    hours: b - a, sunHours: sun, sunPct: (100 * sun) / h, fullSunHours: full, sunEquivHours: eq,
    earthHours: earth, earthPct: (100 * earth) / h, bothHours: both, bothPct: (100 * both) / h,
    dsnHours: dsn, dsnPct: (100 * dsn) / h, longestDark: longest, longestNoEarth: longestE,
    meanSunElLit: sun ? elSum / sun : NaN,
  }
}

/** Hours until the state of `pred` changes, scanning forward from k. null if not within series. */
export function hoursUntilChange(n: number, k: number, pred: (i: number) => boolean): number | null {
  const now = pred(k)
  for (let i = k + 1; i < n; i++) if (pred(i) !== now) return i - k
  return null
}

export interface WindowCriteria {
  days: number
  sunMin: number // 0 = any part, 0.5 = half disc, 1 = full disc
  needEarth: boolean
  needDsn: boolean
  coverage: number // 0..1 fraction of hours in window that must meet the rule
}

export interface FoundWindow {
  startIdx: number // series-local index
  hours: number
  coverage: number
  meanSun: number
  earthPct: number
}

export function findWindows(s: Series, c: WindowCriteria, a = 0, b = s.n, maxResults = 8): FoundWindow[] {
  const L = Math.round(c.days * 24)
  if (b - a < L) return []
  const ok = new Uint8Array(s.n)
  for (let k = a; k < b; k++) {
    const f = s.sunFrac[k]
    const sunOk = c.sunMin <= 0 ? f > 0 : f >= c.sunMin - 1e-9
    const eOk = !c.needEarth || s.earthVis[k] === 1
    const dOk = !c.needDsn || (s.earthVis[k] === 1 && s.dsnUp[k] > 0)
    ok[k] = sunOk && eOk && dOk ? 1 : 0
  }
  const P = new Float64Array(s.n + 1), F = new Float64Array(s.n + 1), E = new Float64Array(s.n + 1)
  for (let k = 0; k < s.n; k++) { P[k + 1] = P[k] + ok[k]; F[k + 1] = F[k] + s.sunFrac[k]; E[k + 1] = E[k] + s.earthVis[k] }
  const cands: FoundWindow[] = []
  for (let st = a; st + L <= b; st++) {
    const cov = (P[st + L] - P[st]) / L
    if (cov + 1e-9 >= c.coverage) cands.push({ startIdx: st, hours: L, coverage: cov, meanSun: (F[st + L] - F[st]) / L, earthPct: (100 * (E[st + L] - E[st])) / L })
  }
  cands.sort((x, y) => y.coverage - x.coverage || y.meanSun - x.meanSun)
  const picked: FoundWindow[] = []
  for (const w of cands) {
    if (picked.every((p) => w.startIdx + L <= p.startIdx || w.startIdx >= p.startIdx + L)) picked.push(w)
    if (picked.length >= maxResults) break
  }
  return picked
}
