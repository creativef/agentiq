// ============================================================
// CEO Toolkit: Structured commands the CEO Orchestrator can use
// Each tool is a JSON command that the execution engine parses
// ============================================================
import { db } from "../db/client";
import { tasks, agents, projects, companyBriefs } from "../db/schema";
import { sql } from "drizzle-orm";

// ─── CEO Tool Definitions ───────────────────────────────────

export interface CEOAction {
  tool: string;
  [key: string]: any;
}

export const CEO_TOOLS = {
  // 🎯 CREATE TASK: Assign work to an agent
  create_task: {
    description: "Create a new task and assign it to a specific agent",
    params: {
      agentId: { type: "string", required: true, desc: "UUID of the agent" },
      title: { type: "string", required: true, desc: "Task title" },
      description: { type: "string", required: true, desc: "Full task description" },
      priority: { type: "string", required: false, enum: ["low", "medium", "high", "critical"], default: "medium" },
      scratchpad: { type: "string", required: false, desc: "Context notes the agent should reference" },
    },
  },

  // ✉️ UPDATE SCRATCHPAD: Add shared context to a task or project
  update_scratchpad: {
    description: "Add shared context/notes to a task or agent's working memory",
    params: {
      taskId: { type: "string", required: false, desc: "UUID of the task" },
      agentId: { type: "string", required: false, desc: "UUID of the agent" },
      content: { type: "string", required: true, desc: "The context/note to add" },
      append: { type: "boolean", default: true, desc: "If true, appends to existing scratchpad" },
    },
  },

  // 🛑 STOP TASK: Cancel a running or pending task
  stop_task: {
    description: "Stop a task — mark as blocked or cancelled",
    params: {
      taskId: { type: "string", required: true, desc: "UUID of the task to stop" },
      reason: { type: "string", required: false, desc: "Why the task is being stopped" },
    },
  },

  // 💬 FOLLOW UP: Append new instructions to an in-progress task
  follow_up: {
    description: "Add new context or constraints to an existing task",
    params: {
      taskId: { type: "string", required: true, desc: "UUID of the task" },
      message: { type: "string", required: true, desc: "New instructions to append" },
    },
  },

  // 📋 REPORT: Send a status summary to Founders (via chat/events)
  report: {
    description: "Send a strategic report or status update",
    params: {
      companyId: { type: "string", required: true, desc: "Company UUID" },
      channel: { type: "string", required: false, enum: ["chat", "brief_update"], default: "chat" },
      message: { type: "string", required: true, desc: "The report content" },
    },
  },

  // 🎯 SET GOAL: Create or update a company goal
  set_goal: {
    description: "Create or update a strategic goal for the company",
    params: {
      title: { type: "string", required: true, desc: "Goal title" },
      description: { type: "string", required: true, desc: "Detailed goal description" },
      priority: { type: "string", default: "medium", enum: ["low", "medium", "high", "critical"] },
    },
  },
} as const;

// ─── Tool Execution Engine ──────────────────────────────────

export async function executeCEOTool(companyId: string, action: CEOAction): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    switch (action.tool) {
      case "create_task": {
        if (!action.agentId || !action.title || !action.description) {
          return { success: false, error: "Missing required params: agentId, title, description" };
        }

        // Find a valid projectId
        let targetProjectId: string | null = action.projectId || null;
        if (!targetProjectId) {
          const agentCheck = await db.select({ projectId: agents.projectId })
            .from(agents)
            .where(sql`${agents.id} = ${action.agentId} AND ${agents.companyId} = ${companyId}`)
            .limit(1);
          
          if (agentCheck.length > 0) {
            targetProjectId = agentCheck[0].projectId;
          }
          
          if (!targetProjectId) {
            const proj = await db.select({ id: projects.id })
              .from(projects)
              .where(sql`${projects.companyId} = ${companyId}`)
              .limit(1);
            if (proj.length > 0) targetProjectId = proj[0].id;
          }
        }

        if (!targetProjectId) {
          return { success: false, error: "No project ID found for task creation" };
        }

        const newTask = await db.insert(tasks).values({
          projectId: targetProjectId,
          agentId: action.agentId,
          title: action.title,
          description: action.description,
          priority: action.priority || "medium",
          status: "ready",
          execStatus: "ready",
          scratchpad: action.scratchpad || null,
        }).returning();

        return { success: true, result: { taskId: newTask[0].id, title: newTask[0].title } };
      }

      case "update_scratchpad": {
        if (!action.taskId && !action.agentId) {
          return { success: false, error: "Must provide taskId or agentId" };
        }

        if (action.taskId) {
          const existing = await db.select({ scratchpad: tasks.scratchpad })
            .from(tasks)
            .where(sql`${tasks.id} = ${action.taskId}`)
            .limit(1);
          
          const newPad = action.append && existing[0]?.scratchpad
            ? existing[0].scratchpad + "\n\n---\n\n" + action.content
            : action.content;
          
          await db.update(tasks).set({ scratchpad: newPad })
            .where(sql`${tasks.id} = ${action.taskId}`);
          
          return { success: true, result: { type: "task", id: action.taskId } };
        }

        if (action.agentId) {
          const existing = await db.select({ scratchpad: agents.scratchpad })
            .from(agents)
            .where(sql`${agents.id} = ${action.agentId}`)
            .limit(1);
          
          const newPad = action.append && existing[0]?.scratchpad
            ? existing[0].scratchpad + "\n\n---\n\n" + action.content
            : action.content;
          
          await db.update(agents).set({ scratchpad: newPad })
            .where(sql`${agents.id} = ${action.agentId}`);
          
          return { success: true, result: { type: "agent", id: action.agentId } };
        }

        return { success: false, error: "Invalid target" };
      }

      case "stop_task": {
        if (!action.taskId) {
          return { success: false, error: "Missing taskId" };
        }

        await db.update(tasks).set({
          execStatus: "failed",
          status: "blocked",
          result: action.reason ? `Stopped by CEO: ${action.reason}` : "Stopped by CEO",
        }).where(sql`${tasks.id} = ${action.taskId}`);

        return { success: true, result: { taskId: action.taskId } };
      }

      case "follow_up": {
        if (!action.taskId || !action.message) {
          return { success: false, error: "Missing taskId or message" };
        }

        await db.update(tasks).set({
          description: sql`${tasks.description} || '\n\n--- CEO FOLLOW UP ---\n\n' || ${action.message}`,
        }).where(sql`${tasks.id} = ${action.taskId}`);

        return { success: true, result: { taskId: action.taskId } };
      }

      default:
        return { success: false, error: `Unknown tool: ${action.tool}` };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
