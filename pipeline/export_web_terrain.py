"""Export browser assets for custom-coordinate analysis and the site map.

* web/public/data/dem_240m.bin : int16 heights (m, rel. 1737.4 km), LOLA LDEM_80S_80M
  block-averaged 3x3 -> 240 m/px, 2533 x 2533, polar stereographic (same
  projection as the source). Used to cast 720 rays for any clicked point.
* web/public/data/dem_240m.json: grid metadata.
* web/public/data/illum_map.png: PGDA Product 69 average solar illumination
  (Mazarico et al. 2011) over the same 80-90 S extent, for the clickable map.

Code written with AI assistance (Claude, Anthropic) for Team Horvan.
"""
from __future__ import annotations

import json
import struct
import sys
import zlib
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from lunar import load_pds_img  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data"


def write_png(path: Path, rgb: np.ndarray):
    h, w, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    dem = load_pds_img(ROOT / "raw/ldem_80s_80m.img")
    f = 3
    n = dem.data.shape[0] // f  # 2533
    blk = dem.values(dem.data[: n * f, : n * f]).reshape(n, f, n, f).mean(axis=(1, 3))
    np.round(blk).astype("<i2").tofile(OUT / "dem_240m.bin")
    meta = {
        "source": "NASA LRO LOLA LDEM_80S_80M (PDS), 3x3 block mean",
        "lines": n, "samples": n, "scale_m": dem.scale * f,
        # pixel centre of block (i) covers source pixels f*i..f*i+2 -> centre f*i+1
        "line_off": (dem.line_off - 1) / f, "samp_off": (dem.samp_off - 1) / f,
        "units": "m relative to 1737.4 km sphere", "dtype": "int16 LE",
        "projection": "south polar stereographic, R=1737.4 km, MOON_ME (DE421)",
    }
    (OUT / "dem_240m.json").write_text(json.dumps(meta, indent=1))

    # illumination map over the same extent (80-90 S), 1000 px
    ill = load_pds_img(ROOT / "raw/illum/AVGVISIB_75S_120M_201608.IMG")
    half = dem.data.shape[0] * dem.scale / 2  # metres
    px = 1000
    xs = (np.arange(px) + 0.5) / px * 2 * half - half
    X, Y = np.meshgrid(xs, -xs)
    samp = ill.samp_off + X / ill.scale
    line = ill.line_off - Y / ill.scale
    v = ill.values(ill.data[np.clip(line.astype(int), 0, ill.data.shape[0] - 1),
                            np.clip(samp.astype(int), 0, ill.data.shape[1] - 1)])
    v = np.clip(v, 0, 1)
    # palette: deep navy (0) -> slate -> amber (1); permanent shadow stays darkest
    stops = np.array([[0.0, 6, 9, 18], [0.15, 22, 30, 52], [0.4, 70, 80, 100],
                      [0.65, 170, 140, 80], [1.0, 255, 196, 90]])
    rgb = np.stack([np.interp(v, stops[:, 0], stops[:, i]) for i in (1, 2, 3)], axis=-1)
    rho = np.hypot(X, Y)
    rgb[rho > half] = (7, 11, 20)
    write_png(OUT / "illum_map.png", rgb.astype(np.uint8))
    meta2 = {"source": "PGDA Product 69 AVGVISIB_75S_120M_201608 (Mazarico et al. 2011)",
             "extent_m": half, "px": px, "palette": stops.tolist()}
    (OUT / "illum_map.json").write_text(json.dumps(meta2, indent=1))
    print("dem", n, "px", meta["scale_m"], "m; map written")


if __name__ == "__main__":
    main()
