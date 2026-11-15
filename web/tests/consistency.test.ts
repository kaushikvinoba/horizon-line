// Cross-check: the browser engine (src/lib/astro.ts + metrics.ts) run in Node on
// the real published data must match the Python engine's numbers in
// tests/python_reference.json (produced by pipeline/make_reference.py).
// Run: node --experimental-strip-types tests/consistency.test.ts
import { readFileSync } from 'node:fs'
import { computeSeries, maskFor } from '../src/lib/astro.ts'
import { findWindows, metrics } from '../src/lib/metrics.ts'

const D = new URL('../public/data/', import.meta.url)
const meta = JSON.parse(readFileSync(new URL('ephem.json', D), 'utf8'))
const vecB = readFileSync(new URL('ephem.bin', D))
const dsnB = readFileSync(new URL('dsn.bin', D))
const ephem = {
  startMs: Date.parse(meta.start_utc), count: meta.count, meta,
  vec: new Float32Array(vecB.buffer, vecB.byteOffset, vecB.byteLength / 4),
  dsn: new Int8Array(dsnB.buffer, dsnB.byteOffset, dsnB.byteLength),
}
const ref = JSON.parse(readFileSync(new URL('./python_reference.json', import.meta.url), 'utf8'))
let fail = 0
const check = (name: string, a: number, b: number, tol: number) => {
  const ok = Math.abs(a - b) <= tol
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ts=${a.toFixed(3)} py=${b.toFixed(3)} (tol ${tol})`)
}
for (const r of ref.sites) {
  const site = JSON.parse(readFileSync(new URL(`sites/${r.site_id}.json`, D), 'utf8'))
  const H = maskFor(site, r.mast)
  const s = computeSeries(site, ephem as never, H, r.mast)
  const m = metrics(s, r.a, r.b)
  check(`${r.site_id} sun%`, m.sunPct, r.sun_pct, 0.05)
  check(`${r.site_id} earth%`, m.earthPct, r.earth_pct, 0.05)
  check(`${r.site_id} longest dark h`, m.longestDark, r.longest_dark, 0)
  check(`${r.site_id} sun az@k`, s.sunAz[r.k], r.sun_az_k, 0.01)
  check(`${r.site_id} sun el@k`, s.sunEl[r.k], r.sun_el_k, 0.001)
  const w = findWindows(s, { days: 6, sunMin: 0.5, needEarth: true, needDsn: false, coverage: 1 }, r.a, r.b, 1)
  check(`${r.site_id} finder has 6-day window`, w.length ? 1 : 0, r.has_window ? 1 : 0, 0)
}
console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll checks passed')
process.exit(fail ? 1 : 0)
