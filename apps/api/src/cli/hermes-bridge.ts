import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { executionRuns, tasks, agents, projects, agentSkills, skills as skillsTable } from "../db/schema";
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

// ---------- prompt builder ----------
function buildTaskPrompt(
  task: { title: string; description: string | null; scratchpad: string | null },
  agentName: string | null,
  agentRole: string | null,
  skillNames: string[],
  callbackUrl: string,
): string {
  const lines: string[] = [
    "You are an execution agent working for AgentIQ Mission Control.",
    "Execute the following task using your available tools (terminal, web, file, etc.).",
    "",
    `TASK: ${task.title}`,
    `DESCRIPTION: ${task.description || "Use your best judgment."}`,
  ];

  if (task.scratchpad) {
    lines.push(`CONTEXT/SCRATCHPAD: ${task.scratchpad}`);
  }

  if (agentName) {
    lines.push(`YOUR ROLE: ${agentName} (${agentRole || "Agent"})`);
  }

  if (skillNames.length > 0) {
    lines.push(`RELEVANT SKILLS: ${skillNames.join(", ")}`);
  }

  lines.push("");
  lines.push("Instructions:");
  lines.push("1. Execute the task thoroughly using appropriate tools.");
  lines.push("2. Show your work -- use tool calls so activity is visible.");
  lines.push(`3. When finished, end your response with a clear summary of what was done and any outputs created.`);
  lines.push("");
  lines.push(`Now execute the task "${task.title}":`);

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

// ---------- main dispatch loop ----------
async function main() {
  const queued = await db
    .select({
      id: executionRuns.id,
      taskId: executionRuns.taskId,
      agentId: executionRuns.agentId,
    })
    .from(executionRuns)
    .where(sql`${executionRuns.status} = 'queued'`)
    .limit(10);

  if (queued.length === 0) {
    console.log("[Hermes Bridge] No queued executions.");
    process.exit(0);
  }

  console.log(`[Hermes Bridge] Processing ${queued.length} queued execution(s)...`);

  for (const run of queued) {
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

      // ---- fetch project / company ----
      let companyId: string | null = null;
      if (task.projectId) {
        const projRow = await db
          .select({ companyId: projects.companyId })
          .from(projects)
          .where(sql`${projects.id} = ${task.projectId}`)
          .limit(1);
        companyId = projRow[0]?.companyId || null;
      }
      if (!companyId) {
        companyId = run.id; // fallback -- shouldn't happen in normal flow
      }

      // ---- fetch agent info & skills ----
      let agentName: string | null = null;
      let agentRole: string | null = null;
      let skillNames: string[] = [];

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

        const skillRows = await db
          .select({ name: skillsTable.name })
          .from(agentSkills)
          .innerJoin(skillsTable, sql`${agentSkills.skillId} = ${skillsTable.id}`)
          .where(sql`${agentSkills.agentId} = ${run.agentId}`);
        skillNames = skillRows.map((s) => s.name);
      }

      // ---- build prompt & dispatch ----
      const callbackUrl = `${AGENTIQ_API_URL}/api/executions/${run.id}`;
      const prompt = buildTaskPrompt(task, agentName, agentRole, skillNames, callbackUrl);
      const promptFile = writePromptFile(prompt, run.taskId);

      const cliCommand = `cat ${escapeShellArg(promptFile)} | hermes chat -Q -q "$(cat ${escapeShellArg(promptFile)})" --source tool --max-turns 60`;

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

  process.exit(0);
}

main().catch((e) => {
  console.error("[Hermes Bridge] Fatal:", e);
  process.exit(1);
});
