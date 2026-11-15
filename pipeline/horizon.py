"""720-ray terrain horizon masks from LRO LOLA DEMs (Horizon Line, Team Horvan).

For each azimuth a_k = 0.5 deg * k (k = 0..719, clockwise from local north),
walk along the great circle from the site in steps of `step_m` out to `max_km`.
At ground distance d the central angle is psi = d / R0 and the terrain radius
is r_t = R0 + z(d). For an observer at r_obs = R0 + z0 + h_mast the elevation
angle of that terrain point is

    theta(d) = atan2(r_t cos(psi) - r_obs, r_t sin(psi))

which already includes lunar curvature (no atmosphere, so no refraction).
H[k] = max_d theta(d). Terrain comes from LDEM_80S_80M (80 m/px) where it
covers, otherwise LDEM_75S_120M (120 m/px).

Code written with AI assistance (Claude, Anthropic) for Team Horvan.
"""
from __future__ import annotations

import numpy as np

from lunar import R0, PolarGrid, bilinear, latlon_to_xy, xy_to_pix

N_RAYS = 720
AZ_STEP = 0.5


def dest_points(lat_deg: float, lon_deg: float, az_deg: np.ndarray, psi: np.ndarray):
    """Great-circle destinations. az (A,), psi (D,) -> lat, lon arrays (A, D) in deg."""
    la1 = np.radians(lat_deg)
    lo1 = np.radians(lon_deg)
    az = np.radians(az_deg)[:, None]
    ps = psi[None, :]
    sin_la2 = np.sin(la1) * np.cos(ps) + np.cos(la1) * np.sin(ps) * np.cos(az)
    la2 = np.arcsin(np.clip(sin_la2, -1, 1))
    lo2 = lo1 + np.arctan2(np.sin(az) * np.sin(ps) * np.cos(la1),
                           np.cos(ps) - np.sin(la1) * sin_la2)
    return np.degrees(la2), np.degrees(lo2)


def terrain_height(grids: list[PolarGrid], lat, lon):
    """Height (m, rel. R0) from the first grid that covers each point."""
    x, y = latlon_to_xy(lat, lon)
    out = np.full(np.shape(lat), np.nan)
    for g in grids:
        need = np.isnan(out)
        if not need.any():
            break
        l, s = xy_to_pix(g, x[need], y[need])
        out[need] = bilinear(g, l, s)
    return out


def site_height(grids, lat, lon) -> float:
    return float(terrain_height(grids, np.array([lat]), np.array([lon]))[0])


def horizon_mask(grids, lat, lon, mast_heights=(0.0,), step_m=40.0, max_km=150.0,
                 min_m=None):
    """Return (dict mast->H[720] deg, z0, max-distance-of-horizon km[720] for mast 0)."""
    az = np.arange(N_RAYS) * AZ_STEP
    first = min_m if min_m is not None else step_m
    d = np.arange(first, max_km * 1000 + 1, step_m)
    psi = d / R0
    la, lo = dest_points(lat, lon, az, psi)
    z = terrain_height(grids, la, lo)  # (720, D)
    z0 = site_height(grids, lat, lon)
    r_t = R0 + z
    out = {}
    hdist = None
    for h in mast_heights:
        r_obs = R0 + z0 + h
        theta = np.degrees(np.arctan2(r_t * np.cos(psi)[None, :] - r_obs,
                                      r_t * np.sin(psi)[None, :]))
        theta = np.where(np.isnan(theta), -90.0, theta)
        k = np.argmax(theta, axis=1)
        out[float(h)] = theta[np.arange(N_RAYS), k]
        if hdist is None:
            hdist = d[k] / 1000.0
    nan_frac = float(np.isnan(z).mean())
    return out, z0, hdist, nan_frac
