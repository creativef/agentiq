import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { executionRuns, tasks, agents, projects, agentSkills, skills as skillsTable } from "../db/schema";
import { recordExecutionEvent } from "../execution/dispatcher";

const HERMES_BRIDGE_URL = process.env.HERMES_BRIDGE_URL || "";
const HERMES_BRIDGE_TOKEN = process.env.HERMES_BRIDGE_TOKEN || "";

async function main() {
  if (!HERMES_BRIDGE_URL) {
    console.error("HERMES_BRIDGE_URL is required");
    process.exit(1);
  }

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

      const payload = {
        runId: run.id,
        task: {
          id: taskRow[0].id,
          title: taskRow[0].title,
          description: taskRow[0].description,
          scratchpad: taskRow[0].scratchpad,
          priority: taskRow[0].priority,
        },
        companyId: projRow[0].companyId,
        agent: agentRow[0] ? { id: agentRow[0].id, name: agentRow[0].name, role: agentRow[0].role } : null,
        skills,
      };

      const res = await fetch(HERMES_BRIDGE_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(HERMES_BRIDGE_TOKEN ? { "authorization": `Bearer ${HERMES_BRIDGE_TOKEN}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        await db.update(executionRuns).set({ status: "failed", error: `HTTP ${res.status}: ${text.slice(0, 500)}`, finishedAt: new Date() }).where(sql`${executionRuns.id} = ${run.id}`);
        await recordExecutionEvent({ runId: run.id, level: "error", message: `Hermes dispatch failed: ${res.status}`, meta: { body: text } });
        
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
          console.error(`Dispatch failed for ${run.id}: ${res.status}. Retry ${currentRetryCount + 1}/${MAX_RETRIES}`);
        } else {
          // Max retries exceeded, mark as permanently failed
          await db.update(tasks).set({ 
            execStatus: "failed", 
            status: "blocked",
            result: `Hermes dispatch failed after ${MAX_RETRIES} retries: HTTP ${res.status}`
          }).where(sql`${tasks.id} = ${run.taskId}`);
          console.error(`Dispatch failed for ${run.id}: ${res.status}. Max retries (${MAX_RETRIES}) exceeded. Task blocked.`);
        }
        continue;
      }

      await recordExecutionEvent({ runId: run.id, level: "info", message: "Dispatched to Hermes" });
      console.log(`Dispatched run ${run.id}`);
    } catch (e: any) {
      await db.update(executionRuns).set({ status: "failed", error: e.message, finishedAt: new Date() }).where(sql`${executionRuns.id} = ${run.id}`);
      await recordExecutionEvent({ runId: run.id, level: "error", message: `Dispatch error: ${e.message}` });
      
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
        console.error(`Error dispatching ${run.id}: ${e.message}. Retry ${currentRetryCount + 1}/${MAX_RETRIES}`);
      } else {
        // Max retries exceeded, mark as permanently failed
        await db.update(tasks).set({ 
          execStatus: "failed", 
          status: "blocked",
          result: `Hermes dispatch error after ${MAX_RETRIES} retries: ${e.message}`
        }).where(sql`${tasks.id} = ${run.taskId}`);
        console.error(`Error dispatching ${run.id}: ${e.message}. Max retries (${MAX_RETRIES}) exceeded. Task blocked.`);
      }
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
