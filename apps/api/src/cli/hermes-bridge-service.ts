#!/usr/bin/env tsx
import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { executionRuns, tasks, agents, projects, companies } from "../db/schema";
import { recordExecutionEvent, recordExecutionResult } from "../execution/dispatcher";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);
const AGENTIQ_API_URL = process.env.AGENTIQ_API_URL || "http://localhost:3000";
const HERMES_WORKDIR = process.env.HERMES_WORKDIR || "/root/agentiq";
const MAX_RETRIES = parseInt(process.env.HERMES_MAX_RETRIES || "3", 10);
const EXECUTION_TIMEOUT = parseInt(process.env.HERMES_EXECUTION_TIMEOUT || "600", 10); // seconds
const POLL_INTERVAL = parseInt(process.env.HERMES_POLL_INTERVAL || "5", 10) * 1000; // ms

// ---------- prompt builder ----------
function buildTaskPrompt(
  task: { title: string; description: string | null; scratchpad: string | null },
  agentName: string | null,
  agentRole: string | null,
  companyName: string | null,
  companyGoal: string | null,
  projectName: string | null,
  callbackUrl: string,
): string {
  const lines: string[] = [
    "You are Hermes, the autonomous AI brain of AgentIQ Mission Control.",
    "",
  ];

  // Company/Project Context
  if (companyName) {
    lines.push(`COMPANY CONTEXT: You are working for ${companyName}`);
    if (companyGoal) {
      lines.push(`COMPANY GOAL: ${companyGoal}`);
    }
  }
  
  if (projectName) {
    lines.push(`PROJECT: ${projectName}`);
  }

  lines.push(`TASK: ${task.title}`);
  lines.push(`DESCRIPTION: ${task.description || "Use your best judgment."}`);
  lines.push(`CALLBACK_URL: ${callbackUrl} (Use this to report progress and final results)`);

  if (task.scratchpad) {
    lines.push(`CONTEXT/SCRATCHPAD: ${task.scratchpad}`);
  }

  if (agentName && agentRole) {
    lines.push(`SPECIFIC AGENT ASSIGNMENT: You are acting as ${agentName}, the ${agentRole}`);
    lines.push(`ROLE CONTEXT: As ${agentRole}, use appropriate skills and approaches for this role.`);
  } else if (agentRole) {
    lines.push(`SPECIFIC AGENT ASSIGNMENT: You are acting as ${agentRole}`);
    lines.push(`ROLE CONTEXT: As ${agentRole}, use appropriate skills and approaches for this role.`);
  } else {
    // No specific agent assigned - Hermes acts as CEO/brain for this company
    lines.push(`CEO/BRAIN MODE: You are the CEO/brain of ${companyName || "the company"}.`);
    lines.push(`DECISION MAKING: Decide which agents/roles are needed for this task.`);
    lines.push(`EXECUTION: You can execute directly or delegate to subagents as needed.`);
    lines.push(`CONTEXT AWARENESS: Remember you are working for ${companyName || "this company"} on ${projectName || "this project"}.`);
  }

  lines.push("");
  lines.push("Execute this task using your available tools and skills.");
  lines.push("You can delegate to subagents if multiple roles are needed.");
  lines.push("Show your work with tool calls. Report progress to CALLBACK_URL for long tasks.");
  lines.push("When finished, provide a clear summary of what was accomplished.");

  return lines.join("\n");
}

// ---------- safe shell escaping ----------
function escapeShellArg(arg: string): string {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

// ---------- temp file for Hermes prompt ----------
function writePromptFile(prompt: string, taskId: string): string {
  const tmpDir = path.join("/tmp", "agentiq-hermes");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const filePath = path.join(tmpDir, `prompt-${taskId}.txt`);
  fs.writeFileSync(filePath, prompt, "utf-8");
  return filePath;
}

// ---------- execute single run ----------
async function executeRun(run: any) {
  try {
    await db
      .update(executionRuns)
      .set({ status: "dispatching", startedAt: new Date() })
      .where(sql`${executionRuns.id} = ${run.id}`);

    await recordExecutionEvent({ runId: run.id, level: "info", message: "Dispatching to Hermes CLI" });

    // ---- fetch task details ----
    const taskRow = await db
      .select()
      .from(tasks)
      .where(sql`${tasks.id} = ${run.taskId}`)
      .limit(1);
    if (taskRow.length === 0) throw new Error("Task not found");
    const task = taskRow[0];

    // ---- fetch project / company details ----
    let companyName: string | null = null;
    let companyGoal: string | null = null;
    let projectName: string | null = null;
    
    if (task.projectId) {
      // Get project and company details
      const projRow = await db
        .select({ 
          projectName: projects.name,
          companyId: projects.companyId 
        })
        .from(projects)
        .where(sql`${projects.id} = ${task.projectId}`)
        .limit(1);
        
      if (projRow.length > 0) {
        projectName = projRow[0].projectName;
        const companyId = projRow[0].companyId;
        
        // Get company details
        const companyRow = await db
          .select({ name: companies.name, goal: companies.goal })
          .from(companies)
          .where(sql`${companies.id} = ${companyId}`)
          .limit(1);
          
        if (companyRow.length > 0) {
          companyName = companyRow[0].name;
          companyGoal = companyRow[0].goal;
        }
      }
    }

    // ---- fetch agent info ----
    let agentName: string | null = null;
    let agentRole: string | null = null;

    if (run.agentId) {
      const agentRow = await db
        .select({ name: agents.name, role: agents.role })
        .from(agents)
        .where(sql`${agents.id} = ${run.agentId}`)
        .limit(1);
      if (agentRow.length > 0) {
        agentName = agentRow[0].name;
        agentRole = agentRow[0].role;
      }
    }

    // ---- build prompt & dispatch ----
    const callbackUrl = `${AGENTIQ_API_URL}/api/executions/${run.id}`;
    const prompt = buildTaskPrompt(
      task, 
      agentName, 
      agentRole, 
      companyName,
      companyGoal,
      projectName,
      callbackUrl
    );
    const promptFile = writePromptFile(prompt, run.taskId);

    const cliCommand = `hermes chat -Q -q "$(cat ${escapeShellArg(promptFile)})" --source tool --max-turns 60`;

    console.log(`[Hermes Bridge] Dispatching run ${run.id}: "${task.title}"`);
    console.log(`[Hermes Bridge] Prompt file: ${promptFile}`);

    const { stdout, stderr } = await execAsync(cliCommand, {
      timeout: EXECUTION_TIMEOUT * 1000,
      maxBuffer: 50 * 1024 * 1024, // 50MB
      cwd: HERMES_WORKDIR,
    });

    const result = stdout.trim() || (stderr ? stderr.trim() : "No output from Hermes");

    await recordExecutionResult({
      runId: run.id,
      status: "completed",
      result: result.substring(0, 10000),
    });

    console.log(`[Hermes Bridge] Run ${run.id} completed.`);

    // cleanup prompt file
    try {
      fs.unlinkSync(promptFile);
    } catch {}
    
  } catch (e: any) {
    console.error(`[Hermes Bridge] Error on run ${run.id}:`, e.message);

    await recordExecutionResult({
      runId: run.id,
      status: "failed",
      error: e.message.substring(0, 5000),
    });

    const taskRow = await db
      .select({ retryCount: tasks.retryCount })
      .from(tasks)
      .where(sql`${tasks.id} = ${run.taskId}`)
      .limit(1);
    const currentRetryCount = taskRow.length > 0 ? taskRow[0].retryCount || 0 : 0;

    if (currentRetryCount < MAX_RETRIES) {
      await db
        .update(tasks)
        .set({
          execStatus: "ready",
          status: "ready",
          retryCount: currentRetryCount + 1,
        })
        .where(sql`${tasks.id} = ${run.taskId}`);

      await db
        .update(executionRuns)
        .set({
          status: "queued",
          startedAt: null,
          finishedAt: null,
          result: null,
          error: null,
        })
        .where(sql`${executionRuns.id} = ${run.id}`);

      console.error(
        `[Hermes Bridge] Retry ${currentRetryCount + 1}/${MAX_RETRIES} for ${run.id}`,
      );
    } else {
      await db
        .update(tasks)
        .set({
          execStatus: "failed",
          status: "blocked",
          result: `Hermes execution failed after ${MAX_RETRIES} retries: ${e.message}`,
        })
        .where(sql`${tasks.id} = ${run.taskId}`);

      console.error(
        `[Hermes Bridge] Max retries (${MAX_RETRIES}) exceeded for ${run.id}. Task blocked.`,
      );
    }

    // cleanup prompt file on error
    try {
      const promptFile = path.join("/tmp", "agentiq-hermes", `prompt-${run.taskId}.txt`);
      if (fs.existsSync(promptFile)) fs.unlinkSync(promptFile);
    } catch {}
  }
}

// ---------- main service loop ----------
async function main() {
  console.log("[Hermes Bridge Service] Starting...");
  console.log(`[Hermes Bridge Service] Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`[Hermes Bridge Service] Max retries: ${MAX_RETRIES}`);
  console.log(`[Hermes Bridge Service] Timeout: ${EXECUTION_TIMEOUT}s`);

  let running = true;

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Hermes Bridge Service] SIGTERM received, shutting down...');
    running = false;
  });
  process.on('SIGINT', () => {
    console.log('[Hermes Bridge Service] SIGINT received, shutting down...');
    running = false;
  });

  while (running) {
    try {
      const queued = await db
        .select({
          id: executionRuns.id,
          taskId: executionRuns.taskId,
          agentId: executionRuns.agentId,
        })
        .from(executionRuns)
        .where(sql`${executionRuns.status} = 'queued'`)
        .limit(5); // Process up to 5 at a time

      if (queued.length > 0) {
        console.log(`[Hermes Bridge Service] Processing ${queued.length} queued execution(s)...`);
        
        // Execute runs in parallel (with limit)
        const promises = queued.map(run => executeRun(run));
        await Promise.all(promises);
      } else {
        // No work, sleep
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    } catch (error) {
      console.error('[Hermes Bridge Service] Error in main loop:', error);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  console.log('[Hermes Bridge Service] Stopped.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[Hermes Bridge Service] Fatal:", e);
    process.exit(1);
  });
}