import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '../db/client';
import { sql } from 'drizzle-orm';
import { executionRuns, executionEvents } from '../db/schema';

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>; // Set of runIds or "all"
  userId?: string;
  companyId?: string;
}

export class ExecutionWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private nextClientId = 1;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/executions' });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = `client-${this.nextClientId++}`;
      const client: Client = { ws, subscriptions: new Set() };
      this.clients.set(clientId, client);

      console.log(`[WebSocket] Client ${clientId} connected from ${req.socket.remoteAddress}`);

      // Parse query params for initial subscriptions
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const runId = url.searchParams.get('runId');
      const companyId = url.searchParams.get('companyId');
      
      if (runId) {
        client.subscriptions.add(runId);
        console.log(`[WebSocket] Client ${clientId} subscribed to run ${runId}`);
      }
      if (companyId) {
        client.companyId = companyId;
        // Subscribe to all runs for this company
        client.subscriptions.add(`company:${companyId}`);
      }

      ws.on('message', (data: any) => this.handleMessage(clientId, data.toString()));
      ws.on('close', () => this.handleDisconnect(clientId));
      ws.on('error', (err: Error) => this.handleError(clientId, err));

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
      }));
    });
  }

  private handleMessage(clientId: string, message: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const data: any = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          if (data.runId) {
            client.subscriptions.add(data.runId);
            this.sendToClient(clientId, {
              type: 'subscribed',
              runId: data.runId,
              timestamp: new Date().toISOString(),
            });
            console.log(`[WebSocket] Client ${clientId} subscribed to run ${data.runId}`);
          }
          break;

        case 'unsubscribe':
          if (data.runId) {
            client.subscriptions.delete(data.runId);
            this.sendToClient(clientId, {
              type: 'unsubscribed',
              runId: data.runId,
              timestamp: new Date().toISOString(),
            });
          }
          break;

        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: new Date().toISOString(),
          });
          break;
      }
    } catch (err) {
      console.error(`[WebSocket] Error processing message from ${clientId}:`, err);
    }
  }

  private handleDisconnect(clientId: string) {
    console.log(`[WebSocket] Client ${clientId} disconnected`);
    this.clients.delete(clientId);
  }

  private handleError(clientId: string, err: Error) {
    console.error(`[WebSocket] Error for client ${clientId}:`, err);
    this.clients.delete(clientId);
  }

  private sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(data));
    } catch (err: any) {
      console.error(`[WebSocket] Error sending to client ${clientId}:`, err);
    }
  }

  // Public API for broadcasting execution events
  public async broadcastExecutionEvent(runId: string, event: any) {
    const run = await db.select({ companyId: executionRuns.companyId })
      .from(executionRuns)
      .where(sql`${executionRuns.id} = ${runId}`)
      .limit(1);

    if (run.length === 0) return;

    const companyId = run[0].companyId;
    const message = JSON.stringify({
      type: 'execution_event',
      runId,
      companyId,
      event,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to all subscribed clients
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // Check if client is subscribed to this run or company
      const shouldReceive = 
        client.subscriptions.has(runId) ||
        client.subscriptions.has(`company:${companyId}`) ||
        (client.companyId === companyId);

      if (shouldReceive) {
        try {
          client.ws.send(message);
        } catch (err) {
          console.error(`[WebSocket] Error broadcasting to client ${clientId}:`, err);
        }
      }
    }
  }

  public broadcastExecutionResult(runId: string, result: any) {
    const message = JSON.stringify({
      type: 'execution_result',
      runId,
      result,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to all clients subscribed to this run
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      
      if (client.subscriptions.has(runId)) {
        try {
          client.ws.send(message);
        } catch (err) {
          console.error(`[WebSocket] Error broadcasting result to client ${clientId}:`, err);
        }
      }
    }
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      clients: Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        subscriptions: Array.from(client.subscriptions),
        companyId: client.companyId,
      })),
    };
  }
}