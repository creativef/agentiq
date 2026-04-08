#!/usr/bin/env bash
set -euo pipefail

INTERVAL_SECONDS="${HERMES_BRIDGE_INTERVAL_SECONDS:-10}"

echo "[Hermes Bridge] Starting with WebSocket support"
echo "[Hermes Bridge] Database URL: ${DATABASE_URL:-not set}"
echo "[Hermes Bridge] API URL: ${AGENTIQ_API_URL:-not set}"
echo "[Hermes Bridge] Poll interval: ${INTERVAL_SECONDS}s"

# Check if Hermes is installed
if ! command -v hermes &> /dev/null; then
    echo "[Hermes Bridge] ERROR: Hermes CLI not found!"
    echo "[Hermes Bridge] Attempting to install Hermes..."
    pip install hermes-agent --break-system-packages 2>&1 | grep -v "ERROR:" || true
fi

# Verify Hermes installation
hermes --version 2>/dev/null && echo "[Hermes Bridge] ✓ Hermes CLI ready" || echo "[Hermes Bridge] ⚠ Hermes CLI may not be installed"

# Start the Hermes Bridge Service (continuous process, not loop)
echo "[Hermes Bridge] Starting Hermes Bridge Service..."
pnpm tsx apps/api/src/cli/hermes-bridge-service.ts