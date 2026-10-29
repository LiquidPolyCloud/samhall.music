#!/usr/bin/env bash
# flyer.html -> out/ : print PDF (with bleed), a PNG, and a guides proof.
# Needs firefox, python3 and ghostscript (gs) only.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
prof=$(mktemp -d)
trap 'rm -rf "$prof"' EXIT

shot() {  # shot <query> <out.png>
  firefox --headless --no-remote --profile "$prof" --window-size=1575,2175 \
    --screenshot "$PWD/$2" "file://$PWD/flyer.html$1" >/dev/null 2>&1
}

shot "" out/samhall-flyer-5x7.png
shot "?guides=1" out/samhall-flyer-5x7-proof-guides.png
python3 png2pdf.py out/samhall-flyer-5x7.png out/samhall-flyer-5x7.pdf

# CMYK copy, for printers that want CMYK files (colors shift slightly)
gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=pdfwrite -sColorConversionStrategy=CMYK \
   -dProcessColorModel=/DeviceCMYK -dAutoFilterColorImages=false -dColorImageFilter=/FlateEncode \
   -dDownsampleColorImages=false -dUseTrimBox=false \
   -sOutputFile=out/samhall-flyer-5x7-cmyk.pdf out/samhall-flyer-5x7.pdf
ls -la out
