#!/usr/bin/env bash
set -euo pipefail

INTERVAL_SECONDS="${HERMES_BRIDGE_INTERVAL_SECONDS:-10}"

echo "[Hermes Bridge] Starting loop (every ${INTERVAL_SECONDS}s)"

while true; do
  pnpm tsx apps/api/src/cli/hermes-bridge.ts || true
  sleep "$INTERVAL_SECONDS"
done
