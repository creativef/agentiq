import { serve } from '@hono/node-server';
import { app } from './index';
import { startCEOOrchestrator } from './orchestrator';
import { cleanupRateLimiter } from './middleware/rate-limiter';

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
});

console.log(`API server running on port ${port}`);

// Start CEO autonomous orchestrator (30s tick)
// DISABLED TEMPORARILY: Fixing infinite recursion bug
// startCEOOrchestrator();

// Local task worker disabled — Hermes handles execution

// Clean up stale rate limiter entries every 60s
setInterval(cleanupRateLimiter, 60_000);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  process.exit(0);
});
