import { serve } from '@hono/node-server';
import { app } from './index';
import { startTaskScheduler } from './task-exec';
import { cleanupRateLimiter } from './middleware/rate-limiter';

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
});

// Start background jobs
startTaskScheduler();
setInterval(cleanupRateLimiter, 60 * 1000); // Clean up rate limiter every 60s

console.log(`API server running on port ${port} | Task scheduler & cleanup active`);
