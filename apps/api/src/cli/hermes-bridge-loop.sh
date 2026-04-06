#!/usr/bin/env bash
set -euo pipefail

INTERVAL_SECONDS="${HERMES_BRIDGE_INTERVAL_SECONDS:-10}"

if [ -z "${HERMES_BRIDGE_URL:-}" ]; then
  echo "HERMES_BRIDGE_URL is required"
  exit 1
fi

echo "[Hermes Bridge] Starting loop (every ${INTERVAL_SECONDS}s)"

while true; do
  pnpm tsx apps/api/src/cli/hermes-bridge.ts || true
  sleep "$INTERVAL_SECONDS"
done
