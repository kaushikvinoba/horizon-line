export const HOUR = 3600_000

export function idxToDate(startMs: number, i: number): Date {
  return new Date(startMs + i * HOUR)
}
export function dateToIdx(startMs: number, d: Date): number {
  return Math.round((d.getTime() - startMs) / HOUR)
}
export function fmtUTC(d: Date, withTime = true): string {
  const s = d.toISOString()
  return withTime ? `${s.slice(0, 10)} ${s.slice(11, 16)} UTC` : s.slice(0, 10)
}
export function fmtDur(h: number | null | undefined): string {
  if (h === null || h === undefined || !isFinite(h)) return '—'
  if (h < 48) return `${Math.round(h)} h`
  const d = Math.floor(h / 24)
  const r = Math.round(h - d * 24)
  return r ? `${d} d ${r} h` : `${d} d`
}
export function fmtDeg(x: number, dp = 2): string {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(dp)}°`
}
export function compass(az: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round((((az % 360) + 360) % 360) / 22.5) % 16]
}
export function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 16)
}
export function fromInputValue(v: string): Date {
  return new Date(v.length === 16 ? v + ':00Z' : v + 'T00:00:00Z')
}
