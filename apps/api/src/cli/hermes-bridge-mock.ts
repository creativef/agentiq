#!/usr/bin/env tsx
/**
 * Mock Hermes Bridge for testing without database
 * This simulates task execution for demonstration purposes
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);
const HERMES_WORKDIR = process.env.HERMES_WORKDIR || "/root/agentiq";

// Mock task data
const mockTasks = [
  {
    id: "test-1",
    title: "Test Hermes Integration",
    description: "List files in current directory",
    status: "queued",
    companyName: "Test Company",
    projectName: "Hermes Integration",
    agentName: "Hermes",
    agentRole: "Autonomous AI",
  },
  {
    id: "test-2", 
    title: "Check system status",
    description: "Check disk usage and running processes",
    status: "queued",
    companyName: "Test Company",
    projectName: "System Monitoring",
    agentName: "System Agent",
    agentRole: "DevOps",
  },
];

// ---------- prompt builder ----------
function buildTaskPrompt(task: any): string {
  return `You are Hermes, the autonomous AI brain of AgentIQ Mission Control.

COMPANY CONTEXT: You are working for ${task.companyName}
PROJECT: ${task.projectName}
TASK: ${task.title}
DESCRIPTION: ${task.description}
AGENT ASSIGNMENT: You are acting as ${task.agentName}, the ${task.agentRole}

Execute this task using your available tools and skills.
Show your work with tool calls.
When finished, provide a clear summary of what was accomplished.`;
}

// ---------- safe shell escaping ----------
function escapeShellArg(arg: string): string {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

// ---------- execute single task ----------
async function executeTask(task: any) {
  console.log(`\n[${new Date().toISOString()}] Starting task: "${task.title}"`);
  console.log(`  Company: ${task.companyName}`);
  console.log(`  Project: ${task.projectName}`);
  console.log(`  Agent: ${task.agentName} (${task.agentRole})`);

  const prompt = buildTaskPrompt(task);
  const promptFile = path.join("/tmp", `hermes-mock-${task.id}.txt`);
  fs.writeFileSync(promptFile, prompt, "utf-8");

  try {
    const cliCommand = `hermes chat -Q -q "$(cat ${escapeShellArg(promptFile)})" --source tool --max-turns 3`;
    
    console.log(`  Executing Hermes with prompt...`);
    const { stdout, stderr } = await execAsync(cliCommand, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: HERMES_WORKDIR,
    });

    const result = stdout.trim() || (stderr ? stderr.trim() : "No output");
    
    console.log(`  ✅ Task completed successfully`);
    console.log(`  Result summary: ${result.substring(0, 200)}...`);
    
    // Simulate WebSocket broadcast
    console.log(`  📡 [WebSocket] Broadcasting completion event for task ${task.id}`);
    
  } catch (e: any) {
    console.log(`  ❌ Task failed: ${e.message}`);
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(promptFile);
    } catch {}
  }
}

// ---------- main service loop ----------
async function main() {
  console.log("=== Hermes Bridge Mock Service ===");
  console.log("This service simulates Hermes task execution without database");
  console.log("Press Ctrl+C to stop\n");
  
  let taskIndex = 0;
  
  const processNextTask = async () => {
    if (taskIndex < mockTasks.length) {
      const task = mockTasks[taskIndex];
      await executeTask(task);
      taskIndex++;
      
      // Schedule next task after 5 seconds
      setTimeout(processNextTask, 5000);
    } else {
      console.log("\n=== All mock tasks completed ===");
      console.log("To test with real tasks:");
      console.log("1. Start PostgreSQL database");
      console.log("2. Run: cd ~/agentiq/apps/api && npm run dev");
      console.log("3. Run: cd ~/agentiq/apps/api && npx tsx src/cli/hermes-bridge-service.ts");
      console.log("4. Create tasks in the web interface at http://localhost:3000");
      process.exit(0);
    }
  };
  
  // Start processing tasks
  processNextTask();
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\nSIGTERM received, shutting down...');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down...');
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  });
}