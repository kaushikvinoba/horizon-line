"""Shared lunar geometry helpers for the Horizon Line pipeline.

Conventions (match the LOLA PDS polar products, see raw/*.lbl):
  * Sphere radius R0 = 1737.4 km, MOON_ME frame (Mean Earth / Polar Axis).
  * South polar stereographic, centre lat -90, centre lon 0, east-positive lon.
  * PDS polar stereographic (DSMAP_POLAR.CAT), south pole:
        rho = 2 R0 tan(pi/4 + lat/2)     (lat in radians, negative)
        x   = rho * sin(lon)
        y   = rho * cos(lon)
        sample = SAMPLE_PROJECTION_OFFSET + x / scale   (0-based, pixel centre)
        line   = LINE_PROJECTION_OFFSET  - y / scale     (0-based)
    Sign verified: Mons Mouton & Mons Malapert sample ~+5 km, Shackleton/Haworth floors deep
    (IAU gazetteer coordinates, LDEM_80S_80M).

Developed by Team Horvan, using Claude (Anthropic) as an AI coding assistant.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

R0 = 1_737_400.0  # m


@dataclass
class PolarGrid:
    name: str
    data: np.ndarray  # raw int16 (memmap), shape (lines, samples); value = data * k + add
    scale: float      # m / pixel
    line_off: float
    samp_off: float
    k: float = 1.0
    add: float = 0.0

    def values(self, a):
        return np.asarray(a, dtype=np.float64) * self.k + self.add

    @property
    def half_extent_m(self) -> float:
        return self.data.shape[0] * self.scale / 2


def _lbl_value(text: str, key: str) -> str:
    m = re.search(rf"^\s*{key}\s*=\s*(.+?)\s*$", text, re.M)
    if not m:
        raise KeyError(key)
    return m.group(1)


def _num(s: str) -> float:
    return float(re.match(r"[-+0-9.eE]+", s.strip()).group(0))


def load_pds_img(img_path: str | Path, mmap: bool = True) -> PolarGrid:
    """Load a PDS3 polar stereographic IMG (int16 LSB) using its .lbl."""
    img_path = Path(img_path)
    lbl = img_path.with_suffix(".lbl")
    if not lbl.exists():
        lbl = img_path.with_suffix(".LBL")
    text = lbl.read_text(errors="replace")
    lines = int(_num(_lbl_value(text, "LINES")))
    samples = int(_num(_lbl_value(text, "LINE_SAMPLES")))
    scale_factor = _num(_lbl_value(text, "SCALING_FACTOR"))
    try:
        offset = _num(_lbl_value(text, "OFFSET"))
    except KeyError:
        offset = 0.0
    map_scale = _num(_lbl_value(text, "MAP_SCALE"))
    line_off = _num(_lbl_value(text, "LINE_PROJECTION_OFFSET"))
    samp_off = _num(_lbl_value(text, "SAMPLE_PROJECTION_OFFSET"))
    raw = np.memmap(img_path, dtype="<i2", mode="r", shape=(lines, samples)) if mmap \
        else np.fromfile(img_path, dtype="<i2").reshape(lines, samples)
    # For DEMs OFFSET is the reference radius (1737.4 km); we keep heights
    # relative to R0. For non-DEM products OFFSET is added (usually 0).
    add = offset if offset < 1e5 else 0.0
    return PolarGrid(img_path.stem, raw, map_scale, line_off, samp_off, scale_factor, add)


def latlon_to_xy(lat_deg, lon_deg):
    lat = np.radians(lat_deg)
    lon = np.radians(lon_deg)
    rho = 2 * R0 * np.tan(np.pi / 4 + lat / 2)
    return rho * np.sin(lon), rho * np.cos(lon)


def xy_to_latlon(x, y):
    rho = np.hypot(x, y)
    lat = 2 * np.arctan(rho / (2 * R0)) - np.pi / 2
    lon = np.arctan2(x, y)
    return np.degrees(lat), np.degrees(lon) % 360


def xy_to_pix(grid: PolarGrid, x, y, line_sign: float = -1.0):
    samp = grid.samp_off + np.asarray(x) / grid.scale
    line = grid.line_off + line_sign * np.asarray(y) / grid.scale
    return line, samp


def bilinear(grid: PolarGrid, line, samp):
    """Bilinear sample; returns NaN outside the grid."""
    line = np.asarray(line, dtype=np.float64)
    samp = np.asarray(samp, dtype=np.float64)
    n_l, n_s = grid.data.shape
    l0 = np.floor(line).astype(np.int64)
    s0 = np.floor(samp).astype(np.int64)
    ok = (l0 >= 0) & (s0 >= 0) & (l0 < n_l - 1) & (s0 < n_s - 1)
    out = np.full(line.shape, np.nan, dtype=np.float64)
    if not ok.any():
        return out
    l0o, s0o = l0[ok], s0[ok]
    fl, fs = line[ok] - l0o, samp[ok] - s0o
    d = grid.data
    v = (d[l0o, s0o] * (1 - fl) * (1 - fs) + d[l0o + 1, s0o] * fl * (1 - fs)
         + d[l0o, s0o + 1] * (1 - fl) * fs + d[l0o + 1, s0o + 1] * fl * fs)
    out[ok] = v * grid.k + grid.add
    return out


def sample_latlon(grid: PolarGrid, lat, lon, line_sign: float = -1.0):
    x, y = latlon_to_xy(lat, lon)
    l, s = xy_to_pix(grid, x, y, line_sign)
    return bilinear(grid, l, s)
