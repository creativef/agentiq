import { createServer } from 'http';
import { serve } from '@hono/node-server';
import { app } from './index';
import { ExecutionWebSocketServer } from './realtime/websocket';
import { setWebSocketServer } from './execution/dispatcher';
import { cleanupRateLimiter } from './middleware/rate-limiter';

const port = parseInt(process.env.PORT || '3000');

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wsServer = new ExecutionWebSocketServer(server);
setWebSocketServer(wsServer);

// Attach Hono app to HTTP server
server.on('request', (req, res) => {
  app.fetch(req, res);
});

server.listen(port, () => {
  console.log(`API server running on port ${port}`);
  console.log(`WebSocket server available at ws://localhost:${port}/ws/executions`);
});

// CEO orchestrator DISABLED - Hermes is the brain
// startCEOOrchestrator();
console.log("CEO orchestrator disabled - Hermes handles all orchestration");

// Local task worker disabled — Hermes handles execution

// Clean up stale rate limiter entries every 60s
setInterval(cleanupRateLimiter, 60_000);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close();
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close();
  process.exit(0);
});