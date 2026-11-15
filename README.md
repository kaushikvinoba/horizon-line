# Horizon Line — Lunar Landing Site Navigator

**Team Horvan · NASA Space Apps Challenge 2026 · Challenge: Lunar Landing Site Navigator**

Team: Kaushik Vinoba (Team Lead) · Ram Naren · S. Vijeta · Samuel M · Rishika M N

**Live app:** https://kaushikvinoba.github.io/horizon-line/ · **7-slide demo deck:** [docs/Horvan_LunarLandingSiteNavigator.pdf](docs/Horvan_LunarLandingSiteNavigator.pdf)

Pick a lunar south pole site and a date. See when the Sun and Earth clear the **real terrain**, so you know when you have power and when you can call home.

At the lunar south pole the Sun never rises more than about 1.5° above a flat horizon, and Earth sits within a few degrees of the horizon too. So a crater rim a few kilometres away decides whether a lander gets sunlight and a direct-to-Earth (DTE) radio line. Horizon Line turns NASA terrain and ephemeris data into one picture per site, plus four planning tools that work in a web browser with no setup.

## What it does

| Tool | What you get |
|---|---|
| **Horizon Ring + Panorama** | The site's 360° terrain horizon from LOLA data, with the Sun's and Earth's paths. Shows the Sun's elevation, how much of the solar disc is visible, how far the Sun is above the terrain, **time to sunset/sunrise and Earthset/Earthrise**, and which NASA Deep Space Network (DSN) complexes can see the Moon. |
| **Power & Comms Calendar** | A 30-day hourly strip: sunlit %, Earth-in-view %, both together, Earth + DSN %, the **longest dark stretch** (what batteries must cover) and the longest Earth outage. |
| **Site Duel** | Two sites over the same dates. The winner is marked on each metric, with no made-up overall score. |
| **Window Finder** | A rule such as "6 days with ≥50% of the Sun's disc and Earth in view (and DSN)". It scans 2026–2030 and returns ranked windows, or says plainly that none exist. |
| **Classroom Mode** | A plain-language explanation that updates as you move a time slider, a play button, a 0–10 m mast slider and explainer cards. |
| **Methods & Data** | The method, validation evidence, sources, limitations and AI disclosure. |

Sites: representative points for all **9 NASA Artemis III candidate regions** (Oct 2024), plus one reference point from the literature. Mast heights: 0, 1, 2, 5 and 10 m. Times are in UTC.

## How it works

```
LOLA DEM (PDS) ──► 720-ray horizon mask per site & mast ─┐
NAIF SPICE DE440 ─► hourly Sun/Earth vectors, MOON_ME ───┼─► browser: topocentric az/el ─► visibility ─► scores, calendar, duel, finder
SPICE IAU_EARTH ──► Moon elevation at 3 DSN complexes ───┘
```

1. **Terrain:** LRO LOLA polar DEMs `LDEM_80S_80M` (80 m/px) and `LDEM_75S_120M` (120 m/px): polar stereographic, MOON_ME (DE421 mean-Earth/polar-axis) frame, heights relative to a 1737.4 km sphere.
2. **Horizon mask:** 720 rays (one every 0.5° of azimuth) along great circles out to 150 km, in 40 m steps starting 160 m from the site. The elevation angle of each terrain point includes lunar curvature: `θ = atan2(r_t·cos ψ − r_obs, r_t·sin ψ)`, `ψ = d / R0`. The highest angle on each ray is the horizon. The Moon has no atmosphere, so there is no refraction. `pipeline/horizon.py`
3. **Ephemeris:** SpiceyPy with `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `naif0012.tls` and `pck00011.tpc`. It produces hourly Sun and Earth vectors in MOON_ME with light-time and stellar-aberration correction (`LT+S`) for 2026–2030 (1 MB). `pipeline/ephemeris.py`
4. **Visibility:** the browser computes local azimuth and elevation for the site. A body is visible when its elevation is above the horizon at its azimuth. The visible fraction of the Sun's disc uses the circular-segment formula with the Sun's real angular radius. Earth "in view" means Earth's centre is above the terrain. The DSN check requires the Moon to be at least 10° above Goldstone (DSS-14), Madrid (DSS-63) or Canberra (DSS-43). `web/src/lib/astro.ts` mirrors `pipeline/visibility.py`.

## Validation (real comparisons, not claims of NASA endorsement)

- **Ephemeris against JPL Horizons:** at 85.98°S, 358.33°E on 2026-12-01 00:00 UTC, Horizons gives Sun az/el 281.6047° / 2.2835° and Earth 8.3461° / 2.3674°. Horizon Line gives 281.605° / 2.284° and 8.346° / 2.367°, a difference of about 0.001°. The Moon's elevation from Goldstone also matches Horizons to the degree.
- **Terrain illumination against NASA PGDA Product 69 (Mazarico et al. 2011):** we simulated 18.6 years hourly and counted hours when any part of the disc is visible:

| Point | Sunlit ours | Sunlit PGDA | Earth ours | Earth PGDA |
|---|---|---|---|---|
| Peak near Cabeus B | 57.7% | 58.2% | 67.7% | 69.6% |
| Haworth | 66.6% | 67.7% | 56.1% | 57.8% |
| Malapert Massif | 64.3% | 70.3% | 58.1% | 57.7% |
| Mons Mouton Plateau | 56.9% | 57.3% | 100% | 100% |
| Nobile Rim 1 | 74.2% | 76.8% | 74.7% | 75.2% |
| Mons Mouton | 77.2% | 78.4% | 70.8% | 67.8% |
| Nobile Rim 2 | 53.7% | 53.2% | 71.9% | 68.3% |
| de Gerlache Rim 2 | 46.6% | 46.1% | 58.3% | 58.4% |
| Slater Plain | 66.6% | 68.2% | 51.3% | 51.3% |
| Reference (Mahanti 2024) | 49.3% | 45.9% | 23.4% | 23.0% |

Most points agree within about 3 percentage points. Malapert is 6 points lower than PGDA, most likely because the 80 m DEM blunts a sharp summit. All numbers are in `web/public/data/sites.json`.

## How the candidate points were chosen

NASA has published the nine Artemis III region **names and a map**, but no point coordinates. For each region we take an official anchor: the IAU Gazetteer centre of the named feature, or a published coordinate tied to that region name (Mahanti et al. 2024 for Nobile Rim 1 and de Gerlache Rim 2; a published site study for Nobile Rim 2). We then choose the best-lit pixel (PGDA 69, 3×3 mean) within a documented search radius. **These are representative points chosen by Team Horvan, not NASA-designated landing sites.** Every anchor, radius and source is stored in `web/public/data/sites/<id>.json` (`selection` field) and shown in the app.

## Limitations

- 80–120 m terrain grid: boulders and small craters are not in it, and rays start 160 m from the site.
- Hourly sampling, so sunrise and sunset times are accurate to about ±30 min.
- Visibility is geometric only. Sunlight is not the same as generated power, and Earth in view is not the same as a working radio link. DSN uses a fixed 10° mask, not real antenna schedules.
- The ephemeris covers 2026-01-01 to 2030-12-31 UTC.

## Run it yourself

```bash
# web app (uses the precomputed data in web/public/data)
cd web && npm install && npm run dev

# regenerate the data from NASA sources
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
bash pipeline/download_data.sh          # ~420 MB of public NASA data into raw/
python pipeline/ephemeris.py            # SPICE → web/public/data/ephem.bin, dsn.bin
python pipeline/build_sites.py          # LOLA → 720-ray masks + validation → web/public/data/sites/
```

## Open data: horizon masks

`web/public/data/sites/<id>.json` follows the project's data contract: `site_id`, `region_name`, `frame: MOON_ME`, `reference_radius_m`, `coordinates` (lat, lon, stereo x/y, surface elevation), `dem_source`, `azimuth_step_deg: 0.5`, and `horizons_by_mast_m` with 720 elevation angles (in degrees, for azimuths 0.0–359.5, clockwise from north) for each mast height. These files are released as CC0.

## Data sources

- NASA LRO LOLA polar gridded DEMs, PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
- NASA/JPL NAIF SPICE generic kernels: https://naif.jpl.nasa.gov/naif/
- JPL Horizons System: https://ssd.jpl.nasa.gov/horizons/
- Mazarico et al. (2011), Icarus 211, and PGDA Product 69: https://pgda.gsfc.nasa.gov/products/69
- NASA, "NASA Provides Update on Artemis III Moon Landing Regions" (Oct 2024): https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
- George et al. (2026), LPSC 57 #1901: https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf
- Mahanti et al. (2024), PSJ 5:62: https://iopscience.iop.org/article/10.3847/PSJ/ad1b50
- IAU/USGS Gazetteer of Planetary Nomenclature: https://planetarynames.wr.usgs.gov/
- NASA Deep Space Network: https://www.nasa.gov/communicating-with-missions/dsn/

## AI disclosure

Team Horvan used **Claude (Anthropic) as an AI coding assistant**, to help write and debug the Python data pipeline and the React web app. The team chose the method and data and checked the results: every number shown is computed by this code from the NASA datasets listed above, and none was produced by an AI model. No NASA logos or branding are used. Horizon Line is not affiliated with or endorsed by NASA.

## License

The code is under the MIT license. Derived data (horizon masks, ephemeris tables) are released as CC0.
