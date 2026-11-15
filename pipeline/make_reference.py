"""Python reference numbers for the browser-engine consistency test
(web/tests/consistency.test.ts). Uses the same published data files.

Developed by Team Horvan, using Claude (Anthropic) as an AI coding assistant.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from visibility import visibility  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / "web" / "public" / "data"


def longest_run(mask):
    best = run = 0
    for v in mask:
        run = run + 1 if v else 0
        best = max(best, run)
    return best


def main():
    eph = np.fromfile(D / "ephem.bin", "<f4").reshape(-1, 6).astype(np.float64)
    a = 365 * 24  # 2027-01-01
    b = a + 365 * 24
    out = []
    for sid, mast in [("nobile_rim_1", 2.0), ("malapert_massif", 0.0), ("de_gerlache_rim_2", 5.0),
                      ("slater_plain", 10.0), ("peak_near_cabeus_b", 1.0)]:
        s = json.loads((D / "sites" / f"{sid}.json").read_text())
        c = s["coordinates"]
        H = np.array(s["horizons_by_mast_m"][f"{mast:.1f}"])
        v = visibility(eph, H, c["lat_deg"], c["lon_deg"], c["surface_elev_m"] + mast)
        lit = v["sun_frac"][a:b] > 0
        ev = v["earth_center_vis"][a:b]
        ok = (v["sun_frac"] >= 0.5 - 1e-9) & v["earth_center_vis"]
        P = np.concatenate([[0], np.cumsum(ok[a:b])])
        k = a + 1000
        out.append({
            "site_id": sid, "mast": mast, "a": a, "b": b, "k": k,
            "sun_pct": float(lit.mean() * 100), "earth_pct": float(ev.mean() * 100),
            "longest_dark": longest_run(~lit),
            "sun_az_k": float(v["sun_az"][k]), "sun_el_k": float(v["sun_el"][k]),
            "has_window": bool(((P[144:] - P[:-144]) == 144).any()),
        })
    (ROOT / "web" / "tests" / "python_reference.json").write_text(json.dumps({"sites": out}, indent=1))
    print("wrote", len(out), "reference sites")


if __name__ == "__main__":
    main()
