// ============================================================
// Task Router — Decision Type 2: Route tasks to agents
// ============================================================

import { db } from "../db/client";
import { tasks } from "../db/schema";
import { sql } from "drizzle-orm";
import { logAgentActivity } from "../utils/agentLogger";
import { matchAgentToTask, shouldCreateNewAgent } from "./skill-matcher";
import type { CEOContext, CEOAction } from "./types";

export async function routeTasks(context: CEOContext): Promise<CEOAction[]> {
  const actions: CEOAction[] = [];

  for (const task of context.pendingTasks) {
    // Filter out founders — they don't get tasks
    const companyAgents = context.agents.filter((a) => a.status !== "error" && a.role !== "FOUNDER");

    if (companyAgents.length === 0) {
      actions.push({
        type: "escalate_to_founders",
        payload: { taskId: task.taskId, reason: "No agents available to assign this task" },
        reason: "Agent pool is empty. Need to bootstrap team.",
        confidence: "high",
      });
      continue;
    }

    const matches = matchAgentToTask(task, companyAgents);
    const bestMatch = matches[0];

    if (!bestMatch || bestMatch.overloaded) {
      actions.push({
        type: "create_agent",
        payload: {
          companyId: context.companyId,
          suggestedRole: deriveRoleFromTask(task),
          taskTitle: task.title,
        },
        reason: `All agents at capacity (${companyAgents.filter((a) => a.activeTaskCount >= 5).length}/${companyAgents.length}). Need headcount.`,
        confidence: "medium",
      });
      continue;
    }

    if (shouldCreateNewAgent(task, bestMatch)) {
      // Skills gap — need new specialist
      actions.push({
        type: "create_agent",
        payload: {
          companyId: context.companyId,
          suggestedRole: deriveRoleFromTask(task),
          requiredSkills: bestMatch.missingSkills,
          taskTitle: task.title,
        },
        reason: `No agent has ${bestMatch.missingSkills.join(", ")}. Best match (${bestMatch.agent.name}) covers only ${bestMatch.matchPercentage.toFixed(0)}%.`,
        confidence: bestMatch.matchPercentage < 20 ? "high" : "medium",
      });
      continue;
    }

    // Assign to best match
    actions.push({
      type: "assign_task",
      payload: {
        taskId: task.taskId,
        agentId: bestMatch.agent.id,
        agentName: bestMatch.agent.name,
        matchingSkills: bestMatch.matchingSkills,
        matchPercentage: bestMatch.matchPercentage,
      },
      reason: `Best match: ${bestMatch.agent.name} (${bestMatch.agent.role}) with ${bestMatch.matchPercentage.toFixed(0)}% skill coverage. Active: ${bestMatch.agent.activeTaskCount}/5`,
      confidence: bestMatch.matchPercentage > 70 ? "high" : "medium",
    });
  }

  return actions;
}

function deriveRoleFromTask(task: { title: string; description?: string }): string {
  const text = `${task.title} ${task.description || ""}`.toLowerCase();
  if (text.includes("deploy") || text.includes("infrastructure")) return "DevOps Engineer";
  if (text.includes("design") || text.includes("ui") || text.includes("frontend")) return "Frontend Developer";
  if (text.includes("api") || text.includes("backend") || text.includes("database")) return "Backend Developer";
  if (text.includes("test") || text.includes("qa")) return "QA Engineer";
  if (text.includes("marketing") || text.includes("content")) return "Marketing Lead";
  if (text.includes("budget") || text.includes("financial")) return "Finance Manager";
  return "Specialist";
}
