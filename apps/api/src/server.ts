import { serve } from '@hono/node-server';
import { app } from './index';

import { cleanupRateLimiter } from './middleware/rate-limiter';

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
});

console.log(`API server running on port ${port}`);

// CEO orchestrator DISABLED - Hermes is the brain
// startCEOOrchestrator();
console.log("CEO orchestrator disabled - Hermes handles all orchestration");

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
