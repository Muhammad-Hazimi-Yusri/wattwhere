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

# Pin to a recent Protomaps daily build. Daily builds are published at
# https://build.protomaps.com/{YYYYMMDD}.pmtiles (ODbL); older builds are
# purged, so the script walks back up to 14 days from BUILD_DATE to find
# a usable build. Bump BUILD_DATE during the monthly refresh to keep cache
# keys (defined in .github/workflows/deploy.yml) fresh.
BUILD_DATE="${BUILD_DATE:-20260508}"

resolve_source() {
  local d
  for i in 0 1 2 3 4 5 6 7 8 9 10 11 12 13; do
    d=$(date -d "${BUILD_DATE} - ${i} days" +%Y%m%d 2>/dev/null \
      || echo "${BUILD_DATE}")
    if curl -fsIo /dev/null "https://build.protomaps.com/${d}.pmtiles"; then
      echo "https://build.protomaps.com/${d}.pmtiles"
      return 0
    fi
  done
  return 1
}

if [[ -n "${SOURCE:-}" ]]; then
  resolved="${SOURCE}"
elif ! resolved=$(resolve_source); then
  echo "error: no Protomaps daily build available within 14 days of ${BUILD_DATE}" >&2
  exit 1
fi

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/tiles"
OUT_FILE="${OUT_DIR}/gb.pmtiles"

mkdir -p "${OUT_DIR}"

if ! command -v pmtiles >/dev/null 2>&1; then
  echo "error: \`pmtiles\` CLI not found on PATH." >&2
  echo "install from https://github.com/protomaps/go-pmtiles/releases" >&2
  exit 1
fi

echo "extracting GB bbox=${BBOX} maxzoom=${MAXZOOM}" >&2
echo "  source: ${resolved}" >&2
echo "  output: ${OUT_FILE}" >&2

pmtiles extract "${resolved}" "${OUT_FILE}" \
  --bbox="${BBOX}" \
  --maxzoom="${MAXZOOM}"

ls -lh "${OUT_FILE}" >&2
