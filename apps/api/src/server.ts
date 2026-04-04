import { serve } from '@hono/node-server';
import { app } from './index';
import { startCEOOrchestrator } from './orchestrator';

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
});

console.log(`API server running on port ${port}`);

// Start the CEO autonomous orchestrator
// This makes scheduled tasks execute, CEO routing decisions fire,
// agent monitoring runs, and founder reports generate on schedule.
startCEOOrchestrator();
