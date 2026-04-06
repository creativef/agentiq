// ============================================================
// CEO Action Executor — Execute decisions from the CEO brain
// ============================================================

import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { agents, tasks, events } from "../db/schema";
import { logAgentActivity } from "../utils/agentLogger";
import type { CEOContext, CEOAction } from "./types";
import { executeCEOTool } from "./ceo-tools";

export async function executeAction(
  action: CEOAction,
  context: CEOContext,
): Promise<{ success: boolean; detail: string }> {
  try {
    switch (action.type) {
      case "assign_task": {
        const { taskId, agentId, agentName, matchPercentage } = action.payload;
        await db
          .update(tasks)
          .set({ agentId, status: "in_progress", execStatus: "executing", approvalStatus: "approved" })
          .where(sql`${tasks.id} = ${taskId}`);

        await logAgentActivity(
          agentId,
          taskId,
          "action",
          `CEO assigned task. Skill match: ${matchPercentage.toFixed(0)}%. Reason: ${action.reason}`,
        );

        return { success: true, detail: `Assigned task ${taskId.slice(0,8)}... to ${agentName}` };
      }

      case "create_agent": {
        // Log as a recommendation — auto-hiring requires founder approval for now
        await logAgentActivity(
          "SYSTEM",
          null,
          "info",
          `CEO recommends creating agent: ${action.payload.suggestedRole}. Reason: ${action.reason}`,
        );
        return { success: true, detail: `Logged hiring recommendation for ${action.payload.suggestedRole}` };
      }

      case "assign_bundle_to_agent": {
        await logAgentActivity(
          action.payload.agentId,
          null,
          "info",
          `CEO flagged for skill bundling: ${action.reason}`,
        );
        return { success: true, detail: `Flagged agent ${action.payload.agentName} for skill assignment` };
      }

      case "retry_task": {
        const { taskId } = action.payload;
        await db
          .update(tasks)
          .set({ status: "in_progress", execStatus: "executing" })
          .where(sql`${tasks.id} = ${taskId}`);

        await logAgentActivity(action.payload.agentId || "SYSTEM", taskId, "action", `Retried by CEO: ${action.reason}`);

        return { success: true, detail: `Retrying task ${taskId.slice(0,8)}...` };
      }

      case "reassign_task": {
        const { taskId } = action.payload;
        await db
          .update(tasks)
          .set({ agentId: null, status: "ready", execStatus: "scheduled" })
          .where(sql`${tasks.id} = ${taskId}`);

        return { success: true, detail: `Requeued task ${taskId.slice(0,8)}... for re-routing` };
      }

      case "escalate_to_founders": {
        await db.insert(events).values({
          companyId: context.companyId,
          type: "escalation",
          actor: "CEO",
          description: action.payload.reason || "Task escalation",
        }).catch((e) => console.error("Failed to write escalation event:", e));
        return { success: true, detail: `Escalated to founders` };
      }

      case "create_report": {
        await db
          .insert(events)
          .values({
            companyId: context.companyId,
            type: "ceo_report",
            actor: "CEO",
            description: action.payload.assessment,
            meta: JSON.stringify(action.payload.metrics),
          })
          .catch((e) => console.error("Failed to write CEO report event:", e));

        return { success: true, detail: `CEO report stored for founders` };
      }

      case "ceo_tool": {
        const toolAction = action.payload;
        const result = await executeCEOTool(context.companyId, toolAction);
        
        // Log the tool execution for visibility
        if (result.success) {
          console.log(`[CEO Tool] ${toolAction.tool}:`, JSON.stringify(result.result));
          return { success: true, detail: `Tool ${toolAction.tool} executed: ${JSON.stringify(result.result)}` };
        } else {
          console.error(`[CEO Tool] ${toolAction.tool} failed:`, result.error);
          return { success: false, detail: `Tool ${toolAction.tool} failed: ${result.error}` };
        }
      }

      default:
        return { success: false, detail: `Unknown action type: ${(action as any).type}` };
    }
  } catch (err: any) {
    console.error(`Action execution failed (${action.type}):`, err);
    return { success: false, detail: `Error: ${err.message || err}` };
  }
}
