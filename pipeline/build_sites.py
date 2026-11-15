"""Build representative sites, 720-ray horizon masks and validation numbers.

NASA has not published point coordinates for the nine Artemis III candidate
regions (NASA release 24-136, Oct 2024; George et al., LPSC 2026 #1901 give
only a map). We therefore derive ONE transparent representative point per
region:

  1. Anchor = an official coordinate tied to the region name: the IAU
     Gazetteer centre of the named feature, or a coordinate published in a
     peer-reviewed paper that names the region.
  2. Search area = a disc (or ring) of documented radius around the anchor.
  3. Representative point = the pixel with the highest 3x3-mean average solar
     illumination in Mazarico et al. (2011) / PGDA Product 69
     (AVGVISIB_75S_120M_201608), i.e. the best-lit spot in that search area.

These are NOT NASA-designated landing sites. Each record carries its anchor,
source and search radius so anyone can reproduce or challenge the choice.

Validation: our engine (LOLA DEM horizon + SPICE DE440) computes the % of
hourly timesteps over an 18.6-year span (2026-01-01 .. 2044-08-01) in which
any part of the solar / Earth disc is above the terrain, and compares it with
the PGDA 69 value at the same point. Same definition as the PGDA label.

Developed by Team Horvan, using Claude (Anthropic) as an AI coding assistant.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from ephemeris import furnish, vectors  # noqa: E402
from horizon import horizon_mask  # noqa: E402
from lunar import (bilinear, latlon_to_xy, load_pds_img, xy_to_latlon,  # noqa: E402
                   xy_to_pix)
from visibility import visibility  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data"
MASTS = (0.0, 1.0, 2.0, 5.0, 10.0)
MIN_RAY_M = 160.0  # skip the first 2 DEM pixels (sub-pixel terrain is unresolved)

IAU = "IAU Gazetteer of Planetary Nomenclature (USGS), MOON_nomenclature_center_pts"
MAHANTI = "Mahanti et al. 2024, PSJ 5:62, Table 1/2 (PSR centres in Artemis III regions)"

REGIONS = [
    dict(id="peak_near_cabeus_b", name="Peak near Cabeus B", anchor=(-82.2587, 305.4154),
         anchor_src=f"{IAU}: Cabeus B crater centre (D 59.6 km)", r_km=(0, 35)),
    dict(id="haworth", name="Haworth", anchor=(-87.45, 354.83),
         anchor_src=f"{IAU}: Haworth crater centre (D 51.4 km)", r_km=(0, 40)),
    dict(id="malapert_massif", name="Malapert Massif", anchor=(-85.98, 358.33),
         anchor_src=f"{IAU}: Mons Malapert centre (D 67 km)", r_km=(0, 34)),
    dict(id="mons_mouton_plateau", name="Mons Mouton Plateau", anchor=(-84.6, 31.0),
         anchor_src=f"{IAU}: Mons Mouton centre (D 130 km); plateau top = within 15 km",
         r_km=(0, 15)),
    dict(id="nobile_rim_1", name="Nobile Rim 1", anchor=(-85.218, 33.820),
         anchor_src=f"{MAHANTI}: PSR SP_852190_0338200 'Nobile Rim 1 and Leibnitz Beta plateau'",
         r_km=(0, 10)),
    dict(id="mons_mouton", name="Mons Mouton", anchor=(-84.6, 31.0),
         anchor_src=f"{IAU}: Mons Mouton centre; flanks = ring 15-50 km, >=10 km from other picks",
         r_km=(15, 50)),
    dict(id="nobile_rim_2", name="Nobile Rim 2", anchor=(-84.20156, 60.69989),
         anchor_src="Nobile Rim 2 optimal point in a published multi-criteria site study "
                    "(ResearchGate 385942633); cross-checked against Mahanti 2024 Nobile Rim 2 PSRs",
         r_km=(0, 10)),
    dict(id="de_gerlache_rim_2", name="de Gerlache Rim 2", anchor=(-88.161, 305.936),
         anchor_src=f"{MAHANTI}: PSR SP_881610_3059360 'partly overlapped by the de Gerlache Rim 2 region'",
         r_km=(0, 10)),
    dict(id="slater_plain", name="Slater Plain", anchor=(-88.0792, 111.2881),
         anchor_src=f"{IAU}: Slater crater centre (D 25.1 km); Slater Plain is described as ~20 km NE of Slater "
                    "crater, so the search is a 13-35 km ring restricted to the side facing away from the pole "
                    "(excludes the dropped 'Peak near Shackleton' region between Slater and Shackleton)",
         r_km=(13, 35), outward=True),
]
REFERENCE = [
    dict(id="ref_peak_near_shackleton", name="Reference point: ridge near Shackleton (Mahanti 2024)",
         point=(-88.79, 124.5),
         anchor_src="Mahanti et al. 2024 PSJ 5:62 s.2.1, quoting Mazarico et al. 2011: "
                    "'(-88.79, 124.5) receives persistent solar illumination (~80% of the time)'"),
]


def pick_point(illum, anchor, r_km, taken, min_sep_km=10.0, outward=False):
    ax, ay = latlon_to_xy(*anchor)
    rmax = r_km[1] * 1000
    l_c, s_c = xy_to_pix(illum, ax, ay)
    n = int(np.ceil(rmax / illum.scale)) + 2
    l0, l1 = int(l_c) - n, int(l_c) + n
    s0, s1 = int(s_c) - n, int(s_c) + n
    win = illum.values(illum.data[l0:l1, s0:s1])
    # 3x3 mean to avoid single-pixel artefacts
    pad = np.pad(win, 1, mode="edge")
    sm = sum(pad[i:i + win.shape[0], j:j + win.shape[1]] for i in range(3) for j in range(3)) / 9
    L, S = np.mgrid[l0:l1, s0:s1]
    x = (S - illum.samp_off) * illum.scale
    y = -(L - illum.line_off) * illum.scale
    dist = np.hypot(x - ax, y - ay)
    ok = (dist <= rmax) & (dist >= r_km[0] * 1000)
    if outward:  # only points farther from the pole than the anchor
        ok &= np.hypot(x, y) > np.hypot(ax, ay)
    for tx, ty in taken:
        ok &= np.hypot(x - tx, y - ty) >= min_sep_km * 1000
    sm = np.where(ok, sm, -1)
    k = np.unravel_index(np.argmax(sm), sm.shape)
    px, py = float(x[k]), float(y[k])
    return px, py, float(sm[k])


def pct(a):
    return round(float(np.mean(a)) * 100, 2)


def main():
    dem80 = load_pds_img(ROOT / "raw/ldem_80s_80m.img")
    dem75 = load_pds_img(ROOT / "raw/ldem_75s_120m.img")
    grids = [dem80, dem75]
    sun_map = load_pds_img(ROOT / "raw/illum/AVGVISIB_75S_120M_201608.IMG")
    earth_path = ROOT / "raw/illum/AVGVISIB_75S_120M_201608_EARTH.IMG"
    earth_map = load_pds_img(earth_path) if earth_path.exists() else None

    furnish()
    hours_val = int(18.6 * 365.25 * 24)
    eph_val, _ = vectors("2026-01-01T00:00:00", hours_val)

    sites, taken = [], []
    todo = [("candidate", r) for r in REGIONS] + [("reference", r) for r in REFERENCE]
    for kind, reg in todo:
        if kind == "candidate":
            x, y, ill = pick_point(sun_map, reg["anchor"], reg["r_km"], taken,
                                   outward=reg.get("outward", False))
            taken.append((x, y))
            lat, lon = xy_to_latlon(x, y)
            lat, lon = float(lat), float(lon)
            method = (f"Highest 3x3-mean PGDA-69 average illumination within "
                      f"{reg['r_km'][0]}-{reg['r_km'][1]} km of the anchor")
        else:
            lat, lon = reg["point"]
            x, y = (float(v) for v in latlon_to_xy(lat, lon))
            method = "Published point used as-is (validation reference)"
        H, z0, hdist, nanf = horizon_mask(grids, lat, lon, MASTS, min_m=MIN_RAY_M)
        v = visibility(eph_val, H[0.0], lat, lon, z0)
        maz_sun = float(bilinear(sun_map, *xy_to_pix(sun_map, x, y)))
        maz_earth = float(bilinear(earth_map, *xy_to_pix(earth_map, x, y))) if earth_map else None
        rec = {
            "site_id": reg["id"],
            "region_name": reg["name"] + (" (Artemis III candidate region)" if kind == "candidate" else ""),
            "kind": kind,
            "frame": "MOON_ME",
            "reference_radius_m": 1737400.0,
            "coordinates": {"lat_deg": round(lat, 5), "lon_deg": round(lon, 5),
                            "stereo_x_m": round(x, 1), "stereo_y_m": round(y, 1),
                            "surface_elev_m": round(z0, 1)},
            "selection": {"method": method, "anchor_source": reg["anchor_src"],
                          "anchor_lat_lon": list(reg.get("anchor", reg.get("point"))),
                          "search_radius_km": list(reg.get("r_km", [0, 0])),
                          "note": "Representative point derived by Team Horvan; not a NASA-designated landing site."},
            "dem_source": "LRO LOLA LDEM_80S_80M (80 m/px) + LDEM_75S_120M (120 m/px), PDS Geosciences Node",
            "dem_resolution_m": 80,
            "pixel_scale_warning": "Terrain features smaller than ~80-120 m (boulders, small craters) are not resolved; "
                                   "rays start 160 m from the site.",
            "max_ray_km": 150, "ray_step_m": 40, "azimuth_step_deg": 0.5,
            "horizons_by_mast_m": {f"{m:.1f}": [round(float(a), 3) for a in H[m]] for m in MASTS},
            "horizon_distance_km_mast0": [round(float(a), 1) for a in hdist],
            "validation": {
                "span": "2026-01-01 to 2044-08 (18.6 yr, hourly), SPICE DE440",
                "definition": "% of hours with any part of the disc above the terrain horizon (mast 0 m)",
                "ours_sun_pct": pct(v["sun_frac"] > 0),
                "pgda69_sun_pct": round(maz_sun * 100, 2),
                "ours_earth_pct": pct(v["earth_frac"] > 0),
                "pgda69_earth_pct": round(maz_earth * 100, 2) if maz_earth is not None else None,
                "pgda69_note": "Mazarico et al. 2011 / PGDA Product 69, AVGVISIB_75S_120M_201608 (+_EARTH), 120 m/px",
            },
        }
        print(f"{reg['id']:26s} {lat:9.4f} {lon:8.3f} z0={z0:7.0f} "
              f"sun ours={rec['validation']['ours_sun_pct']:6.2f} pgda={rec['validation']['pgda69_sun_pct']:6.2f} | "
              f"earth ours={rec['validation']['ours_earth_pct']:6.2f} pgda={rec['validation']['pgda69_earth_pct']} nan={nanf:.3f}")
        sites.append(rec)
    (OUT / "sites").mkdir(parents=True, exist_ok=True)
    index = []
    for s in sites:
        (OUT / "sites" / f"{s['site_id']}.json").write_text(json.dumps(s))
        index.append({k: s[k] for k in ("site_id", "region_name", "kind", "coordinates", "validation")})
    (OUT / "sites.json").write_text(json.dumps(index, indent=1))


if __name__ == "__main__":
    main()
