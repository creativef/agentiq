import { serve } from '@hono/node-server';
import { app } from './index';
import { startTaskScheduler } from './task-exec';

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
});

// Start task scheduler (runs every 30s looking for scheduled/pending tasks)
startTaskScheduler();

console.log(`API server running on port ${port} | Task scheduler started`);
