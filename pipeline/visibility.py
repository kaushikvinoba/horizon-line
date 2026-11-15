"""Topocentric Sun/Earth az-el on the Moon and terrain-aware visibility.

Mirrors web/src/lib/astro.ts exactly so Python validation and the browser
agree. Azimuth: degrees clockwise from local north (toward the lunar north
pole along the meridian), east = 90.

Solar disc fraction: Sun angular radius r = asin(R_sun / |v|). With
u = (el - H(az)) / r the visible fraction of a uniform disc above a locally
straight horizon is
    f = 0                              u <= -1
    f = 1                              u >= +1
    f = 0.5 + (u sqrt(1-u^2) + asin u)/pi   otherwise.

Developed by Team Horvan, using Claude (Anthropic) as an AI coding assistant.
"""
from __future__ import annotations

import numpy as np

from lunar import R0

R_SUN_KM = 695_700.0
R_EARTH_KM = 6_371.0


def site_vectors(lat_deg, lon_deg, height_m):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    pos_km = up * (R0 + height_m) / 1000.0
    return pos_km, up, east, north


def az_el(target_km: np.ndarray, lat, lon, height_m):
    """target_km (N,3) Moon-centred MOON_ME -> az, el (deg), distance (km)."""
    p, u, e, n = site_vectors(lat, lon, height_m)
    v = target_km - p
    dist = np.linalg.norm(v, axis=1)
    el = np.degrees(np.arcsin(np.clip(v @ u / dist, -1, 1)))
    az = np.degrees(np.arctan2(v @ e, v @ n)) % 360
    return az, el, dist


def horizon_at(H: np.ndarray, az: np.ndarray, step: float = 0.5):
    """Linear interpolation of the 720-ray mask at arbitrary azimuths."""
    x = az / step
    i0 = np.floor(x).astype(int) % len(H)
    i1 = (i0 + 1) % len(H)
    f = x - np.floor(x)
    return H[i0] * (1 - f) + H[i1] * f


def disc_fraction(el, horizon, ang_radius_deg):
    u = (el - horizon) / ang_radius_deg
    uc = np.clip(u, -1, 1)
    f = 0.5 + (uc * np.sqrt(1 - uc ** 2) + np.arcsin(uc)) / np.pi
    return np.where(u <= -1, 0.0, np.where(u >= 1, 1.0, f))


def visibility(ephem: np.ndarray, H: np.ndarray, lat, lon, height_m):
    """Return dict of hourly arrays for Sun and Earth."""
    s_az, s_el, s_d = az_el(ephem[:, :3], lat, lon, height_m)
    e_az, e_el, e_d = az_el(ephem[:, 3:], lat, lon, height_m)
    s_r = np.degrees(np.arcsin(R_SUN_KM / s_d))
    e_r = np.degrees(np.arcsin(R_EARTH_KM / e_d))
    s_h = horizon_at(H, s_az)
    e_h = horizon_at(H, e_az)
    return {
        "sun_az": s_az, "sun_el": s_el, "sun_hz": s_h,
        "sun_frac": disc_fraction(s_el, s_h, s_r),
        "earth_az": e_az, "earth_el": e_el, "earth_hz": e_h,
        "earth_frac": disc_fraction(e_el, e_h, e_r),
        "earth_center_vis": e_el > e_h,
    }
