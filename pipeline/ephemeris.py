"""Hourly Sun and Earth position vectors in the MOON_ME frame, from NASA/JPL NAIF SPICE.

Output: web/public/data/ephem.bin  (float32 little-endian, N x 6:
         sun_x, sun_y, sun_z, earth_x, earth_y, earth_z  in km, Moon-centred MOON_ME)
        web/public/data/ephem.json (metadata: start epoch, step, count, kernels)

Kernels (raw/kernels): naif0012.tls, de440s.bsp, moon_pa_de440_200625.bpc,
moon_de440_250416.tf, pck00011.tpc. MOON_ME here is the DE440 lunar orientation
expressed in the DE421 mean-Earth/polar-axis frame, which is the frame of the
LOLA DEMs ("MEAN EARTH/POLAR AXIS OF DE421").

Aberration: 'LT+S' (apparent direction as seen from the Moon). Topocentric
vectors are formed in the browser / scoring step as target - site.

Code written with AI assistance (Claude, Anthropic) for Team Horvan.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import spiceypy as sp

ROOT = Path(__file__).resolve().parents[1]
K = ROOT / "raw" / "kernels"
KERNELS = ["naif0012.tls", "de440s.bsp", "pck00011.tpc",
           "moon_pa_de440_200625.bpc", "moon_de440_250416.tf"]


def furnish():
    sp.kclear()
    for k in KERNELS:
        sp.furnsh(str(K / k))


def vectors(start_utc: str, hours: int, step_h: float = 1.0) -> tuple[np.ndarray, float]:
    """Return (N,6) array of Sun & Earth vectors (km) in MOON_ME, and ET of first epoch."""
    et0 = sp.str2et(start_utc)
    ets = et0 + np.arange(hours) * step_h * 3600.0
    sun, _ = sp.spkpos("SUN", ets, "MOON_ME", "LT+S", "MOON")
    earth, _ = sp.spkpos("EARTH", ets, "MOON_ME", "LT+S", "MOON")
    return np.hstack([np.asarray(sun), np.asarray(earth)]), et0


# NASA DSN complexes (geodetic, deg E, deg N, km) - reference antennas
DSN = [("Goldstone", "DSS-14", -116.890, 35.426, 1.0),
       ("Madrid", "DSS-63", -4.248, 40.431, 0.86),
       ("Canberra", "DSS-43", 148.981, -35.401, 0.69)]


def dsn_elevations(start_utc: str, hours: int) -> np.ndarray:
    """Elevation (deg) of the Moon above each DSN complex's horizon, (N,3).

    Uses the IAU_EARTH body-fixed frame (pck00011), adequate for a 10 deg
    elevation mask (error << 0.1 deg)."""
    et0 = sp.str2et(start_utc)
    ets = et0 + np.arange(hours) * 3600.0
    moon, _ = sp.spkpos("MOON", ets, "IAU_EARTH", "LT+S", "EARTH")
    moon = np.asarray(moon)
    radii = sp.bodvrd("EARTH", "RADII", 3)[1]
    re, rp = radii[0], radii[2]
    f = (re - rp) / re
    out = np.zeros((hours, len(DSN)))
    for j, (_, _, lon, lat, alt) in enumerate(DSN):
        pos = np.array(sp.georec(np.radians(lon), np.radians(lat), alt, re, f))
        normal = np.array(sp.surfnm(re, re, rp, sp.georec(np.radians(lon), np.radians(lat), 0, re, f)))
        v = moon - pos
        out[:, j] = np.degrees(np.arcsin((v @ normal) / np.linalg.norm(v, axis=1)))
    return out


def main():
    furnish()
    start = "2026-01-01T00:00:00"
    end = "2031-01-01T00:00:00"
    hours = int(round((sp.str2et(end) - sp.str2et(start)) / 3600))
    arr, _ = vectors(start, hours)
    out = ROOT / "web" / "public" / "data"
    out.mkdir(parents=True, exist_ok=True)
    arr.astype("<f4").tofile(out / "ephem.bin")
    meta = {
        "start_utc": start + "Z", "step_hours": 1, "count": hours,
        "layout": ["sun_x", "sun_y", "sun_z", "earth_x", "earth_y", "earth_z"],
        "units": "km", "frame": "MOON_ME (DE440 orientation in DE421 ME axes)",
        "origin": "Moon centre", "aberration": "LT+S",
        "kernels": KERNELS, "source": "NASA/JPL NAIF SPICE (https://naif.jpl.nasa.gov/naif/)",
        "generated_with": "pipeline/ephemeris.py (SpiceyPy)",
    }
    dsn = dsn_elevations(start, hours)
    np.clip(np.round(dsn), -90, 90).astype("i1").tofile(out / "dsn.bin")
    meta["dsn"] = {"file": "dsn.bin", "dtype": "int8 deg, N x 3, Moon elevation at station",
                   "stations": [{"complex": c, "antenna": a, "lon_deg": lo, "lat_deg": la}
                                for c, a, lo, la, _ in DSN],
                   "mask_deg": 10, "frame": "IAU_EARTH (pck00011)"}
    (out / "ephem.json").write_text(json.dumps(meta, indent=2))
    print("wrote", hours, "epochs", arr.shape, "sun |r| km", np.linalg.norm(arr[0, :3]),
          "earth |r| km", np.linalg.norm(arr[0, 3:]))


if __name__ == "__main__":
    main()
