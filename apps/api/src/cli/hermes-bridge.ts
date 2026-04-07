import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { executionRuns, tasks, agents, projects, agentSkills, skills as skillsTable } from "../db/schema";
import { recordExecutionEvent, recordExecutionResult } from "../execution/dispatcher";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const AGENTIQ_API_URL = process.env.AGENTIQ_API_URL || "http://localhost:3000";

async function main() {
  const queued = await db.select({ id: executionRuns.id, taskId: executionRuns.taskId, agentId: executionRuns.agentId })
    .from(executionRuns)
    .where(sql`${executionRuns.status} = 'queued'`)
    .limit(10);

  if (queued.length === 0) {
    console.log("No queued executions");
    process.exit(0);
  }

  for (const run of queued) {
    try {
      await db.update(executionRuns).set({ status: "dispatching", startedAt: new Date() })
        .where(sql`${executionRuns.id} = ${run.id}`);

      const taskRow = await db.select().from(tasks).where(sql`${tasks.id} = ${run.taskId}`).limit(1);
      if (taskRow.length === 0) throw new Error("Task not found");

      const projRow = await db.select({ companyId: projects.companyId })
        .from(projects).where(sql`${projects.id} = ${taskRow[0].projectId}`).limit(1);
      if (projRow.length === 0) throw new Error("Project not found");

      const agentRow = run.agentId
        ? await db.select().from(agents).where(sql`${agents.id} = ${run.agentId}`).limit(1)
        : [];

      let skills: Array<{ name: string; category: string; instructions: string }> = [];
      if (run.agentId) {
        const rows = await db.select({ name: skillsTable.name, category: skillsTable.category, instructions: skillsTable.instructions })
          .from(agentSkills)
          .innerJoin(skillsTable, sql`${agentSkills.skillId} = ${skillsTable.id}`)
          .where(sql`${agentSkills.agentId} = ${run.agentId}`);
        skills = rows;
      }

      // Build the task prompt for Hermes with AgentIQ skill context
      const taskPrompt = `You are executing a task for AgentIQ Mission Control. Use the 'agentiq-executor' skill.

TASK: ${taskRow[0].title}
DESCRIPTION: ${taskRow[0].description || "No description provided"}
${taskRow[0].scratchpad ? `CONTEXT/SCRATCHPAD: ${taskRow[0].scratchpad}` : ""}
COMPANY: ${projRow[0].companyId}
${agentRow[0] ? `AGENT: ${agentRow[0].name} (${agentRow[0].role})` : "UNASSIGNED"}
CALLBACK_URL: ${AGENTIQ_API_URL}/api/executions/${run.id}

${skills.length > 0 ? `RELEVANT SKILLS: ${skills.map(s => s.name).join(", ")}` : ""}

Follow the agentiq-executor skill protocol:
1. Acknowledge task start with a callback
2. Execute the task using appropriate tools
3. Report progress for long-running tasks
4. Send final result to the callback URL

Now execute the task "${taskRow[0].title}":`;

      console.log(`[Hermes Bridge] Executing task ${run.id}: "${taskRow[0].title}"`);
      
      // Execute Hermes with the task and AgentIQ skill
      const { stdout, stderr } = await execAsync(`echo "${taskPrompt.replace(/"/g, '\\"')}" | hermes chat --toolsets terminal,web,file --skills agentiq-executor --quiet`, {
        timeout: 300000, // 5 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const result = stdout + (stderr ? `\nSTDERR: ${stderr}` : "");
      
      // Record successful execution
      await recordExecutionResult({
        runId: run.id,
        status: "completed",
        result: result.substring(0, 4000) // Truncate if too long
      });
      
      console.log(`[Hermes Bridge] Task ${run.id} completed successfully`);

    } catch (e: any) {
      console.error(`[Hermes Bridge] Error executing task ${run.id}:`, e.message);
      
      // Record failed execution
      await recordExecutionResult({
        runId: run.id,
        status: "failed",
        error: e.message.substring(0, 1000)
      });
      
      // Check retry count before resetting task to ready
      const taskRow = await db.select({ retryCount: tasks.retryCount }).from(tasks).where(sql`${tasks.id} = ${run.taskId}`).limit(1);
      const currentRetryCount = taskRow.length > 0 ? (taskRow[0].retryCount || 0) : 0;
      const MAX_RETRIES = 3;
      
      if (currentRetryCount < MAX_RETRIES) {
        // Increment retry count and set back to ready for retry
        await db.update(tasks).set({ 
          execStatus: "ready", 
          status: "ready",
          retryCount: currentRetryCount + 1
        }).where(sql`${tasks.id} = ${run.taskId}`);
        console.error(`Error executing ${run.id}: ${e.message}. Retry ${currentRetryCount + 1}/${MAX_RETRIES}`);
      } else {
        // Max retries exceeded, mark as permanently failed
        await db.update(tasks).set({ 
          execStatus: "failed", 
          status: "blocked",
          result: `Hermes execution failed after ${MAX_RETRIES} retries: ${e.message}`
        }).where(sql`${tasks.id} = ${run.taskId}`);
        console.error(`Error executing ${run.id}: ${e.message}. Max retries (${MAX_RETRIES}) exceeded. Task blocked.`);
      }
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});