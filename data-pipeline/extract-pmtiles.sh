#!/usr/bin/env bash
# Build a small GB-only PMTiles extract from the Protomaps daily build.
#
# Reproducible: anyone with this repo can run `npm run data:pmtiles` and get
# the same GB extract. Output is written to public/tiles/gb.pmtiles, which is
# gitignored. CI runs this before `npm run build`.
#
# The `pmtiles` CLI is auto-installed to node_modules/.cache/pmtiles/ on first
# run if not already on PATH. Version pinned via PMTILES_VERSION below (kept
# in sync with .github/workflows/deploy.yml).
#
# Usage:
#   ./data-pipeline/extract-pmtiles.sh

set -euo pipefail

# GB bounding box: includes Great Britain + Northern Ireland + Channel Isles.
# minLon, minLat, maxLon, maxLat
BBOX="${BBOX:--8.7,49.5,2.1,61.1}"
MAXZOOM="${MAXZOOM:-9}"

# Pin to a recent Protomaps daily build. Daily builds are published at
# https://build.protomaps.com/{YYYYMMDD}.pmtiles (ODbL); older builds are
# purged, so the script walks back up to 14 days from BUILD_DATE to find
# a usable build. Bump BUILD_DATE during the monthly refresh to keep cache
# keys (defined in .github/workflows/deploy.yml) fresh.
BUILD_DATE="${BUILD_DATE:-20260508}"

PMTILES_VERSION="${PMTILES_VERSION:-1.22.1}"

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

ensure_pmtiles_cli() {
  if command -v pmtiles >/dev/null 2>&1; then
    return 0
  fi
  local repo_root cache_dir bin os arch tarball url
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cache_dir="${repo_root}/node_modules/.cache/pmtiles"
  bin="${cache_dir}/pmtiles"
  if [[ -x "${bin}" ]]; then
    PATH="${cache_dir}:${PATH}"
    export PATH
    return 0
  fi
  case "$(uname -s)" in
    Linux)  os="Linux"  ;;
    Darwin) os="Darwin" ;;
    *)
      echo "error: auto-install supports Linux/macOS only; install pmtiles manually from" >&2
      echo "  https://github.com/protomaps/go-pmtiles/releases" >&2
      exit 1
      ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)   arch="x86_64" ;;
    arm64|aarch64)  arch="arm64" ;;
    *)
      echo "error: unsupported arch $(uname -m); install pmtiles manually" >&2
      exit 1
      ;;
  esac
  tarball="go-pmtiles_${PMTILES_VERSION}_${os}_${arch}.tar.gz"
  url="https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${tarball}"
  echo "installing pmtiles ${PMTILES_VERSION} to ${cache_dir}" >&2
  mkdir -p "${cache_dir}"
  curl -fsSL -o "${cache_dir}/${tarball}" "${url}"
  tar -xzf "${cache_dir}/${tarball}" -C "${cache_dir}" pmtiles
  rm -f "${cache_dir}/${tarball}"
  chmod +x "${bin}"
  PATH="${cache_dir}:${PATH}"
  export PATH
}

ensure_pmtiles_cli

if [[ -n "${SOURCE:-}" ]]; then
  resolved="${SOURCE}"
elif ! resolved=$(resolve_source); then
  echo "error: no Protomaps daily build available within 14 days of ${BUILD_DATE}" >&2
  exit 1
fi

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/tiles"
OUT_FILE="${OUT_DIR}/gb.pmtiles"

mkdir -p "${OUT_DIR}"

echo "extracting GB bbox=${BBOX} maxzoom=${MAXZOOM}" >&2
echo "  source: ${resolved}" >&2
echo "  output: ${OUT_FILE}" >&2

pmtiles extract "${resolved}" "${OUT_FILE}" \
  --bbox="${BBOX}" \
  --maxzoom="${MAXZOOM}"

# Guard against silent extract failures (e.g., source URL returned a redirect
# page, network blip mid-extract). Removing the file ensures actions/cache
# doesn't poison the cache with a degenerate blob.
size=$(stat -c '%s' "${OUT_FILE}" 2>/dev/null || stat -f '%z' "${OUT_FILE}" 2>/dev/null || echo 0)
if [ "${size}" -lt 1000000 ]; then
  echo "error: ${OUT_FILE} is only ${size} bytes — extract produced a degenerate file" >&2
  rm -f "${OUT_FILE}"
  exit 1
fi

ls -lh "${OUT_FILE}" >&2
