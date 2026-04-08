const http = require('http');
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);
const PORT = 3000;

// Simple in-memory storage
const tasks = new Map();
const executionRuns = new Map();
let taskId = 1;
let runId = 1;

// WebSocket server for real-time updates
const server = http.createServer();
const wss = new WebSocketServer({ server, path: '/ws/executions' });

const clients = new Map();
let nextClientId = 1;

wss.on('connection', (ws, req) => {
  const clientId = `client-${nextClientId++}`;
  const subscriptions = new Set();
  const client = { ws, subscriptions };
  clients.set(clientId, client);

  console.log(`[WebSocket] Client ${clientId} connected`);

  // Parse query params
  const url = new URL(req.url, `http://${req.headers.host}`);
  const companyId = url.searchParams.get('companyId');
  const runIdParam = url.searchParams.get('runId');

  if (companyId) {
    subscriptions.add(`company:${companyId}`);
  }
  if (runIdParam) {
    subscriptions.add(runIdParam);
  }

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: Date.now()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocket] Message from ${clientId}:`, message.type);

      if (message.type === 'subscribe' && message.runId) {
        subscriptions.add(message.runId);
        ws.send(JSON.stringify({
          type: 'subscribed',
          runId: message.runId,
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      console.error(`[WebSocket] Error parsing message:`, err);
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Client ${clientId} disconnected`);
    clients.delete(clientId);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Error for client ${clientId}:`, err);
  });
});

// Broadcast execution events to subscribed clients
function broadcastExecutionEvent(runId, event) {
  const message = JSON.stringify({
    type: 'execution_event',
    runId,
    event,
    timestamp: Date.now()
  });

  clients.forEach((client, clientId) => {
    if (client.ws.readyState === 1 && 
        (client.subscriptions.has(runId) || 
         client.subscriptions.has(`company:${event.companyId}`))) {
      try {
        client.ws.send(message);
      } catch (err) {
        console.error(`[WebSocket] Error sending to client ${clientId}:`, err);
      }
    }
  });
}

// Build a Hermes prompt
function buildPrompt(task) {
  return `You are Hermes, the autonomous AI brain of AgentIQ Mission Control.

COMPANY CONTEXT: You are working for ${task.company || 'Test Company'}
TASK: ${task.title}
DESCRIPTION: ${task.description}

Execute this task using your available tools and skills.
Show your work with tool calls.
When finished, provide a clear summary of what was accomplished.`;
}

// Execute task with Hermes
async function executeTask(task, run) {
  console.log(`[${new Date().toISOString()}] Executing task: "${task.title}"`);
  
  // Update run status
  run.status = 'running';
  run.startedAt = new Date().toISOString();
  executionRuns.set(run.id, run);
  
  // Broadcast start event
  broadcastExecutionEvent(run.id, {
    type: 'execution_started',
    runId: run.id,
    taskId: task.id,
    companyId: task.companyId,
    timestamp: Date.now()
  });

  const prompt = buildPrompt(task);
  const promptFile = path.join('/tmp', `hermes-${run.id}.txt`);
  fs.writeFileSync(promptFile, prompt, 'utf-8');
  
  try {
    console.log(`  🔧 Executing Hermes command...`);
    // Read the prompt file content
    const promptContent = fs.readFileSync(promptFile, 'utf-8');
    console.log(`  📝 Prompt length: ${promptContent.length} chars`);
    
    // Use a simpler approach - write command to script file
    const scriptFile = path.join('/tmp', `hermes-script-${run.id}.sh`);
    const scriptContent = `#!/bin/bash
cd /root/agentiq
hermes chat -Q -q "${promptContent.replace(/"/g, '\\"')}" --source tool --max-turns 3
`;
    fs.writeFileSync(scriptFile, scriptContent, 'utf-8');
    fs.chmodSync(scriptFile, '755');
    
    console.log(`  📝 Script created: ${scriptFile}`);
    
    const { stdout, stderr } = await execAsync(`bash ${scriptFile}`, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    
    console.log(`  ✅ Hermes executed successfully`);
    console.log(`  📊 Output length: ${stdout.length} chars`);
    const result = stdout.trim() || (stderr ? stderr.trim() : 'No output');
    
    // Cleanup script file
    fs.unlinkSync(scriptFile);
    
    // Update run status
    run.status = 'completed';
    run.result = result;
    run.finishedAt = new Date().toISOString();
    executionRuns.set(run.id, run);
    
    // Update task
    task.status = 'done';
    task.execStatus = 'completed';
    task.result = result;
    tasks.set(task.id, task);
    
    console.log(`  ✅ Task completed`);
    
    // Broadcast completion event
    broadcastExecutionEvent(run.id, {
      type: 'execution_completed',
      runId: run.id,
      taskId: task.id,
      companyId: task.companyId,
      status: 'completed',
      result: result.substring(0, 500) + (result.length > 500 ? '...' : ''),
      timestamp: Date.now()
    });
    
    // Cleanup
    fs.unlinkSync(promptFile);
    
    return { success: true, result };
  } catch (e) {
    console.log(`  ❌ Task failed: ${e.message}`);
    
    // Update run status
    run.status = 'failed';
    run.error = e.message;
    run.finishedAt = new Date().toISOString();
    executionRuns.set(run.id, run);
    
    // Update task
    task.status = 'blocked';
    task.execStatus = 'failed';
    task.result = `Error: ${e.message}`;
    tasks.set(task.id, task);
    
    // Broadcast failure event
    broadcastExecutionEvent(run.id, {
      type: 'execution_failed',
      runId: run.id,
      taskId: task.id,
      companyId: task.companyId,
      status: 'failed',
      error: e.message,
      timestamp: Date.now()
    });
    
    return { success: false, error: e.message };
  }
}

// HTTP server routes
server.on('request', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Health check
  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: Date.now(),
      websocket: wss.clients.size,
      tasks: tasks.size,
      executions: executionRuns.size
    }));
    return;
  }
  
  // Get tasks
  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      tasks: Array.from(tasks.values()),
      total: tasks.size
    }));
    return;
  }
  
  // Create task
  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const taskData = JSON.parse(body);
        const task = {
          id: `task-${taskId++}`,
          title: taskData.title || 'Untitled Task',
          description: taskData.description || null,
          status: 'ready',
          execStatus: 'ready',
          priority: taskData.priority || 'medium',
          companyId: taskData.companyId || 'test-company',
          projectId: taskData.projectId || null,
          agentId: taskData.agentId || null,
          createdAt: new Date().toISOString(),
          result: null
        };
        
        tasks.set(task.id, task);
        
        // Create execution run
        const run = {
          id: `run-${runId++}`,
          taskId: task.id,
          companyId: task.companyId,
          agentId: task.agentId,
          provider: 'hermes',
          status: 'queued',
          createdAt: new Date().toISOString()
        };
        
        executionRuns.set(run.id, run);
        
        // Execute in background
        setTimeout(async () => {
          await executeTask(task, run);
        }, 1000);
        
        res.writeHead(201);
        res.end(JSON.stringify({ task, run }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  // Get execution runs
  if (req.method === 'GET' && url.pathname === '/api/executions') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      runs: Array.from(executionRuns.values()),
      total: executionRuns.size
    }));
    return;
  }
  
  // Create execution (for existing tasks)
  if (req.method === 'POST' && url.pathname === '/api/executions') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const taskId = data.taskId;
        
        if (!taskId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'taskId is required' }));
          return;
        }
        
        const task = tasks.get(taskId);
        if (!task) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Task not found' }));
          return;
        }
        
        // Create execution run
        const run = {
          id: `run-${runId++}`,
          taskId: task.id,
          companyId: task.companyId,
          agentId: task.agentId,
          provider: 'hermes',
          status: 'queued',
          createdAt: new Date().toISOString()
        };
        
        executionRuns.set(run.id, run);
        
        // Update task status
        task.execStatus = 'queued';
        task.status = 'in_progress';
        tasks.set(task.id, task);
        
        // Execute in background
        setTimeout(async () => {
          await executeTask(task, run);
        }, 1000);
        
        res.writeHead(201);
        res.end(JSON.stringify({ run }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  // Hermes webhook for execution events
  if (req.method === 'POST' && url.pathname.startsWith('/api/executions/') && url.pathname.endsWith('/events')) {
    const runId = url.pathname.split('/')[3];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log(`[Hermes Webhook] Event for run ${runId}:`, data.message);
        
        // Broadcast to WebSocket clients
        broadcastExecutionEvent(runId, {
          type: 'execution_event',
          runId,
          level: data.level || 'info',
          message: data.message,
          meta: data.meta,
          timestamp: Date.now()
        });
        
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  // Hermes webhook for execution results
  if (req.method === 'POST' && url.pathname.startsWith('/api/executions/') && url.pathname.endsWith('/result')) {
    const runId = url.pathname.split('/')[3];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log(`[Hermes Webhook] Result for run ${runId}:`, data.status);
        
        const run = executionRuns.get(runId);
        if (run) {
          run.status = data.status;
          run.result = data.result || null;
          run.error = data.error || null;
          run.finishedAt = new Date().toISOString();
          executionRuns.set(runId, run);
          
          // Update task
          const task = tasks.get(run.taskId);
          if (task) {
            task.execStatus = data.status;
            task.status = data.status === 'completed' ? 'done' : 'blocked';
            task.result = data.result || data.error || null;
            tasks.set(task.id, task);
          }
          
          // Broadcast to WebSocket clients
          broadcastExecutionEvent(runId, {
            type: 'execution_result',
            runId,
            status: data.status,
            result: data.result,
            error: data.error,
            timestamp: Date.now()
          });
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  // Default 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found', path: url.pathname }));
});

server.listen(PORT, () => {
  console.log(`🚀 Minimal API Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server on ws://localhost:${PORT}/ws/executions`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`  GET  /api/health - Health check`);
  console.log(`  GET  /api/tasks - List tasks`);
  console.log(`  POST /api/tasks - Create task (auto-executes via Hermes)`);
  console.log(`  GET  /api/executions - List execution runs`);
  console.log(`  POST /api/executions - Execute existing task`);
  console.log(`  POST /api/executions/:runId/events - Hermes webhook for events`);
  console.log(`  POST /api/executions/:runId/result - Hermes webhook for results`);
  console.log(`\n🔧 Test with:`);
  console.log(`  curl -X POST http://localhost:${PORT}/api/tasks \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"title":"Test Hermes","description":"List files","companyId":"test-company"}'`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});