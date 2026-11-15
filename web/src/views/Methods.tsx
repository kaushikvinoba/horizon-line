// Methods, data sources, validation evidence, limitations and AI disclosure.
// Written with AI assistance (Claude, Anthropic) for Team Horvan.
import type { SiteIndex } from '../lib/data'

const short = (n: string) => n.replace(' (Artemis III candidate region)', '')

export function Methods({ index }: { index: SiteIndex[] }) {
  return (
    <div className="methods">
      <section className="panel prose">
        <h2>How Horizon Line works</h2>
        <ol className="pipeline">
          <li><b>LOLA terrain.</b> NASA LRO Lunar Orbiter Laser Altimeter polar DEMs LDEM_80S_80M (80 m/px) and LDEM_75S_120M (120 m/px), polar stereographic, MOON_ME frame, heights relative to a 1737.4 km sphere.</li>
          <li><b>Horizon mask.</b> From each site we cast 720 rays (every 0.5° of azimuth) along great circles out to 150 km in 40 m steps, starting 160 m out. For each terrain point the elevation angle including lunar curvature is θ = atan2(r<sub>t</sub>cos ψ − r<sub>obs</sub>, r<sub>t</sub> sin ψ), ψ = d / 1737.4 km. The highest θ on each ray is the horizon. No atmosphere, so no refraction. Masks are stored for mast heights 0, 1, 2, 5 and 10 m.</li>
          <li><b>Ephemeris.</b> Hourly Sun and Earth position vectors 2026–2030 from NASA/JPL NAIF SPICE (DE440, moon_pa_de440 lunar orientation, MOON_ME frame, light-time + stellar aberration). The browser turns them into topocentric azimuth/elevation for the site.</li>
          <li><b>Visibility.</b> A body is visible when its elevation exceeds the horizon at its azimuth. For the Sun we compute the visible fraction of its disc (angular radius from its distance). Earth "in view" = Earth's centre above the terrain. Direct-to-Earth geometry additionally checks that a Deep Space Network complex (Goldstone DSS-14, Madrid DSS-63, Canberra DSS-43) sees the Moon ≥10° above its horizon.</li>
          <li><b>Scores.</b> Sunlit %, Earth-in-view %, both together, Earth+DSN %, longest dark stretch and longest Earth outage over any date range; Window Finder scans for windows meeting a rule.</li>
        </ol>
      </section>

      <section className="panel prose">
        <h2>Validation evidence</h2>
        <h3>1 · Ephemeris vs JPL Horizons</h3>
        <p>Site 85.98°S, 358.33°E (Mons Malapert), 2026-12-01 00:00 UTC. JPL Horizons (lunar surface observer): Sun az 281.6047°, el 2.2835°; Earth az 8.3461°, el 2.3674°. Horizon Line: Sun az 281.605°, el 2.284°; Earth az 8.346°, el 2.367° — agreement ≈0.001°. DSN check: Moon elevation from Goldstone matched Horizons (−41°, −46°, −47°, −44° for 00–03 UTC).</p>
        <h3>2 · Terrain illumination vs published NASA maps</h3>
        <p>For each point we simulated 18.6 years hourly (one lunar nutation cycle, 2026–2044) and counted hours with any part of the Sun's / Earth's disc above our horizon, then compared with Mazarico et al. (2011) average illumination and Earth-visibility maps (PGDA Product 69, 120 m/px).</p>
        <table className="duel-t">
          <thead><tr><th>Point</th><th>Sunlit — ours</th><th>Sunlit — PGDA 69</th><th>Δ</th><th>Earth — ours</th><th>Earth — PGDA 69</th><th>Δ</th></tr></thead>
          <tbody>
            {index.map((s) => {
              const v = s.validation
              const ds = v.ours_sun_pct - v.pgda69_sun_pct
              const de = v.pgda69_earth_pct === null ? NaN : v.ours_earth_pct - v.pgda69_earth_pct
              return (
                <tr key={s.site_id}>
                  <td>{short(s.region_name)}</td>
                  <td>{v.ours_sun_pct.toFixed(1)}%</td><td>{v.pgda69_sun_pct.toFixed(1)}%</td>
                  <td className={Math.abs(ds) <= 3 ? 'pos' : 'neg'}>{ds >= 0 ? '+' : ''}{ds.toFixed(1)}</td>
                  <td>{v.ours_earth_pct.toFixed(1)}%</td><td>{v.pgda69_earth_pct?.toFixed(1)}%</td>
                  <td className={Math.abs(de) <= 3 ? 'pos' : 'neg'}>{de >= 0 ? '+' : ''}{de.toFixed(1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <h3>3 · Resolution sensitivity</h3>
        <p><b>Custom points (240 m terrain, computed in the browser):</b> versus our 80 m masks at the nine candidate points the horizon differs by 0.2–1.3° RMS and the 18.6-yr sunlit % by −2 to +3 points at seven sites, +2 at Cabeus B (some rays leave the 80°S grid) and +19 at Malapert's sharp summit — treat custom-point results on peaks as optimistic.</p>
        <p><b>Finer terrain (LOLA 20 m, 85°S–90°S):</b> re-running six southern points with a 20 m near field at mast 0 lowered sunlit % by 1–22 points (e.g. Mons Mouton 77→55%). Slopes within ~100 m of the exact spot matter a lot at mast 0 — the exact placement of a lander or solar mast inside a region is decisive. We keep 80 m for the candidate sites because it is the like-for-like comparison with the 120 m NASA map.</p>
        <p className="caption">Differences come from DEM resolution (80 m vs the higher-resolution terrain used by PGDA), different time spans (PGDA averages a different 18.6-yr epoch), point vs 120 m pixel sampling, and Earth criterion details. We do not claim NASA validation or endorsement — these are our own comparisons with public NASA products.</p>
      </section>

      <section className="panel prose">
        <h2>Candidate sites — how points were chosen</h2>
        <p>NASA has not published point coordinates for the nine Artemis III candidate regions (only a map; NASA release 24-136, Oct 2024; George et al., LPSC 2026). For each region we take an official anchor — the IAU Gazetteer centre of the named feature, or a published coordinate tied to that region name — and pick the best-lit pixel (PGDA 69 average illumination, 3×3 mean) inside a documented search radius. <b>These are representative points chosen by us, not NASA-designated landing sites.</b> Each site's anchor, radius and source are shown under "About this point" and in <code>data/sites/*.json</code>.</p>
      </section>

      <section className="panel prose">
        <h2>Limitations</h2>
        <ul>
          <li>80–120 m terrain grid: boulders, small craters and sub-pixel slopes are missing; rays start 160 m out. Mast height helps but cannot recover unresolved near-field terrain.</li>
          <li>Hourly sampling: transitions are accurate to about ±30 min.</li>
          <li>Geometric visibility only: sunlight ≠ generated power (array orientation, efficiency, dust, thermal) and Earth in view ≠ a working link (antenna, power, scheduling, multipath). DSN uses a fixed 10° mask, not actual antenna schedules.</li>
          <li>Earth "in view" uses Earth's centre; a partly visible Earth is not counted.</li>
          <li>Representative points per region are our derivation and could differ from NASA's internal landing-site list.</li>
          <li>Ephemeris covers 2026-01-01 to 2030-12-31 UTC.</li>
        </ul>
      </section>

      <section className="panel prose">
        <h2>Data &amp; references</h2>
        <ul className="refs">
          <li>NASA LRO LOLA polar gridded DEMs, PDS Geosciences Node — <a href="https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/" target="_blank" rel="noreferrer">pds-geosciences.wustl.edu</a></li>
          <li>NASA/JPL NAIF SPICE generic kernels (DE440, moon_pa_de440, moon_de440 frame kernel, naif0012, pck00011) — <a href="https://naif.jpl.nasa.gov/naif/" target="_blank" rel="noreferrer">naif.jpl.nasa.gov</a></li>
          <li>JPL Horizons System (independent ephemeris check) — <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">ssd.jpl.nasa.gov/horizons</a></li>
          <li>Mazarico et al. (2011), Icarus 211, Lunar polar illumination; PGDA Product 69 — <a href="https://pgda.gsfc.nasa.gov/products/69" target="_blank" rel="noreferrer">pgda.gsfc.nasa.gov/products/69</a></li>
          <li>NASA, "NASA Provides Update on Artemis III Moon Landing Regions", Oct 2024 — <a href="https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/" target="_blank" rel="noreferrer">nasa.gov</a></li>
          <li>George et al. (2026), Artemis III site selection update, LPSC 57 #1901 — <a href="https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf" target="_blank" rel="noreferrer">hou.usra.edu</a></li>
          <li>Mahanti et al. (2024), PSJ 5:62, PSRs within Artemis III candidate regions — <a href="https://iopscience.iop.org/article/10.3847/PSJ/ad1b50" target="_blank" rel="noreferrer">iopscience.iop.org</a></li>
          <li>IAU / USGS Gazetteer of Planetary Nomenclature — <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noreferrer">planetarynames.wr.usgs.gov</a></li>
          <li>NASA Deep Space Network — <a href="https://www.nasa.gov/communicating-with-missions/dsn/" target="_blank" rel="noreferrer">nasa.gov/dsn</a></li>
          <li>Software: Python, NumPy, SciPy, SpiceyPy; React, Vite, TypeScript.</li>
        </ul>
      </section>

      <section className="panel prose">
        <h2>AI disclosure</h2>
        <p>Team Horvan used Claude (Anthropic) to help write the code (Python pipeline and web app), draft documentation and slide text. All numbers shown are computed from the NASA datasets above by that code; none were generated by an AI model. No NASA logos or branding are used.</p>
      </section>
    </div>
  )
}
