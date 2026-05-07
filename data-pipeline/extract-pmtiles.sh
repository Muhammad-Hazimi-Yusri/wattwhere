#!/usr/bin/env bash
# Build a small GB-only PMTiles extract from the Protomaps daily build.
#
# Reproducible: anyone with `pmtiles` CLI installed can run this and get the
# same GB extract. Output written to public/tiles/gb.pmtiles, which is
# gitignored — CI runs this before `npm run build`.
#
# Local install of the binary (from go-pmtiles releases):
#   https://github.com/protomaps/go-pmtiles/releases
#
# Usage:
#   ./data-pipeline/extract-pmtiles.sh

set -euo pipefail

# GB bounding box: includes Great Britain + Northern Ireland + Channel Isles.
# minLon, minLat, maxLon, maxLat
BBOX="${BBOX:--8.7,49.5,2.1,61.1}"
MAXZOOM="${MAXZOOM:-10}"

# Pin to a specific Protomaps daily build. Daily builds are published at
# https://build.protomaps.com/{YYYYMMDD}.pmtiles (ODbL). Update this date
# as part of the monthly refresh workflow.
BUILD_DATE="${BUILD_DATE:-20260501}"
SOURCE="${SOURCE:-https://build.protomaps.com/${BUILD_DATE}.pmtiles}"

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/tiles"
OUT_FILE="${OUT_DIR}/gb.pmtiles"

mkdir -p "${OUT_DIR}"

if ! command -v pmtiles >/dev/null 2>&1; then
  echo "error: \`pmtiles\` CLI not found on PATH." >&2
  echo "install from https://github.com/protomaps/go-pmtiles/releases" >&2
  exit 1
fi

echo "extracting GB bbox=${BBOX} maxzoom=${MAXZOOM}" >&2
echo "  source: ${SOURCE}" >&2
echo "  output: ${OUT_FILE}" >&2

pmtiles extract "${SOURCE}" "${OUT_FILE}" \
  --bbox="${BBOX}" \
  --maxzoom="${MAXZOOM}"

ls -lh "${OUT_FILE}" >&2
