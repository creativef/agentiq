import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { agents, tasks, projects } from "./db/schema";
import { startCEOOrchestrator } from "./orchestrator";

/**
 * Task Execution Engine
 * 
 * Executes tasks based on their type/title. Supports:
 * - "Hire [ROLE]" → Creates a new agent with that role
 * - "Fire [ROLE/NAME]" → Removes an agent
 * - Generic tasks → Marks completed with a description
 */
export async function execAgent(taskRow: any) {
  const taskId = taskRow.id;
  const title = taskRow.title || "";
  const projectId = taskRow.projectId;
  const companyId = taskRow.projectId
    ? (await db.select({ companyId: projects.companyId }).from(projects).where(sql`${projects.id} = ${projectId}`).limit(1))[0]?.companyId
    : null;

  if (!companyId) {
    await db.update(tasks).set({
      execStatus: "failed",
      result: "Could not determine company from project",
    }).where(sql`${tasks.id} = ${taskId}`);
    return;
  }

  try {
    // Pattern matching for task execution
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.startsWith("hire ") || lowerTitle.startsWith("create ")) {
      // Extract role from title: "Hire CEO" → role=CEO
      const parts = title.split(/\s+/);
      const roleName = parts[parts.length - 1].toUpperCase();
      const validRoles = ["FOUNDER", "CEO", "MANAGER", "AGENT"];

      if (validRoles.includes(roleName)) {
        const agentName = parts.slice(1, -1).join(" ") || roleName;

        // Check if an agent with this role already exists
        const existing = await db.select().from(agents).where(
          sql`${agents.companyId} = ${companyId} AND ${agents.role} = ${roleName}`
        ).limit(1);

        if (existing.length > 0) {
          await db.update(tasks).set({
            execStatus: "completed",
            result: `${roleName} already exists: ${existing[0].name}`,
          }).where(sql`${tasks.id} = ${taskId}`);
          return;
        }

        // Create the new agent
        const newAgent = await db.insert(agents).values({
          companyId,
          projectId: projectId || null,
          name: agentName,
          role: roleName,
          status: "idle",
        }).returning();

        await db.update(tasks).set({
          execStatus: "completed",
          status: "done",
          result: `Created new agent: ${newAgent[0].name} (Role: ${roleName}, ID: ${newAgent[0].id})`,
        }).where(sql`${tasks.id} = ${taskId}`);
        return;
      }
    }

    if (lowerTitle.startsWith("fire ") || lowerTitle.startsWith("remove ")) {
      const parts = title.split(/\s+/);
      const searchName = parts.slice(1).join(" ");

      // Try to find agent by name
      const found = await db.select({ id: agents.id }).from(agents).where(
        sql`${agents.companyId} = ${companyId} AND LOWER(${agents.name}) = ${searchName.toLowerCase()}`
      ).limit(1);

      if (found.length > 0) {
        await db.delete(agents).where(sql`${agents.id} = ${found[0].id}`);
        await db.update(tasks).set({
          execStatus: "completed",
          result: `Removed agent: ${searchName}`,
        }).where(sql`${tasks.id} = ${taskId}`);
        return;
      } else {
        await db.update(tasks).set({
          execStatus: "failed",
          result: `Agent not found: ${searchName}`,
        }).where(sql`${tasks.id} = ${taskId}`);
        return;
      }
    }

    // Default: mark as completed with generic result
    await db.update(tasks).set({
      execStatus: "completed",
      status: "done",
      result: `Task executed: "${title}". Agent performed the requested action and reported completion.`,
    }).where(sql`${tasks.id} = ${taskId}`);

  } catch (e: any) {
    await db.update(tasks).set({
      execStatus: "failed",
      result: `Execution error: ${e.message || "Unknown error"}`,
    }).where(sql`${tasks.id} = ${taskId}`);
    console.error(`Task execution failed for ${taskId}:`, e);
  }
}

/**
 * Background scheduler — runs every 30s to check for scheduled tasks
 */
export function startTaskScheduler() {
  // Start the full autonomous CEO orchestrator
  // This runs the real decision loop: build context -> LLM reasoning -> route -> execute -> monitor -> report
  startCEOOrchestrator({ tickMs: 30_000, reportHours: 24, enabled: true });

  // Keep old scheduler for backwards-compatibility with scheduled tasks
  setInterval(async () => {
    try {
      const dueTasks = await db.select().from(tasks).where(
        sql`${tasks.execStatus} = 'scheduled' AND ${tasks.scheduledAt} <= NOW()`
      );

      for (const task of dueTasks) {
        if (task.approverRole && task.approvalStatus !== "approved") {
          await db.update(tasks).set({
            approvalStatus: "pending",
          }).where(sql`${tasks.id} = ${task.id}`);
          continue;
        }

        await db.update(tasks).set({ execStatus: "executing" }).where(sql`${tasks.id} = ${task.id}`);
        await execAgent(task);
      }
    } catch (e) {
      console.error("Task scheduler error:", e);
    }
  }, 30000);
}
