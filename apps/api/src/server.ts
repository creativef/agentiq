import { serve } from '@hono/node-server';
import { app } from './index';
// import { startCEOOrchestrator } from './orchestrator'; // TEMP DISABLED
import { cleanupRateLimiter } from './middleware/rate-limiter';

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
});

console.log(`API server running on port ${port}`);

// Start CEO autonomous orchestrator (30s tick)
// TEMPORARILY DISABLED — syntax error in self-exec block
// startCEOOrchestrator();

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
