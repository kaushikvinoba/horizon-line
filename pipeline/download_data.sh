#!/usr/bin/env bash
# Re-download the public NASA source data used by the pipeline into raw/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw/kernels raw/illum raw/iau
LOLA=https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img
for f in ldem_80s_80m ldem_75s_120m; do curl -L -o raw/$f.lbl $LOLA/$f.lbl; curl -L -o raw/$f.img $LOLA/$f.img; done
NAIF=https://naif.jpl.nasa.gov/pub/naif/generic_kernels
curl -L -o raw/kernels/naif0012.tls $NAIF/lsk/naif0012.tls
curl -L -o raw/kernels/de440s.bsp $NAIF/spk/planets/de440s.bsp
curl -L -o raw/kernels/pck00011.tpc $NAIF/pck/pck00011.tpc
curl -L -o raw/kernels/moon_pa_de440_200625.bpc $NAIF/pck/moon_pa_de440_200625.bpc
curl -L -o raw/kernels/moon_de440_250416.tf $NAIF/fk/satellites/moon_de440_250416.tf
ILL=http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG
for f in AVGVISIB_75S_120M_201608 AVGVISIB_75S_120M_201608_EARTH; do curl -L -o raw/illum/$f.LBL $ILL/$f.LBL; curl -L -o raw/illum/$f.IMG $ILL/$f.IMG; done
curl -L -o raw/iau/MOON_nomenclature_center_pts.zip https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip
