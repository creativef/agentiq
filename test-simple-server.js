const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);
const PORT = 3001;

// Simple in-memory task queue
const tasks = [];
let taskId = 1;

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
async function executeTask(task) {
  console.log(`[${new Date().toISOString()}] Executing task: "${task.title}"`);
  
  const prompt = buildPrompt(task);
  const promptFile = path.join('/tmp', `hermes-test-${task.id}.txt`);
  fs.writeFileSync(promptFile, prompt, 'utf-8');
  
  try {
    const cliCommand = `hermes chat -Q -q "$(cat ${promptFile})" --source tool --max-turns 3`;
    const { stdout, stderr } = await execAsync(cliCommand, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    });
    
    const result = stdout.trim() || (stderr ? stderr.trim() : 'No output');
    console.log(`  ✅ Task completed`);
    console.log(`  Result: ${result.substring(0, 200)}...`);
    
    // Cleanup
    fs.unlinkSync(promptFile);
    
    return { success: true, result };
  } catch (e) {
    console.log(`  ❌ Task failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
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
  
  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', timestamp: Date.now() }));
    return;
  }
  
  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    res.writeHead(200);
    res.end(JSON.stringify({ tasks }));
    return;
  }
  
  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const task = JSON.parse(body);
        task.id = `task-${taskId++}`;
        task.status = 'queued';
        task.createdAt = new Date().toISOString();
        tasks.push(task);
        
        // Execute in background
        setTimeout(async () => {
          const result = await executeTask(task);
          task.status = 'completed';
          task.result = result;
          task.completedAt = new Date().toISOString();
        }, 1000);
        
        res.writeHead(201);
        res.end(JSON.stringify({ task }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found', path: url.pathname }));
});

server.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/health - Health check`);
  console.log(`  GET  /api/tasks - List tasks`);
  console.log(`  POST /api/tasks - Create task (executes via Hermes)`);
  console.log(`\nTest with:`);
  console.log(`  curl -X POST http://localhost:${PORT}/api/tasks \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"title":"Test Hermes","description":"List files in /tmp"}'`);
});

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