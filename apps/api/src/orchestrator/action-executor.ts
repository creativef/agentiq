// ============================================================
// Action Executor — Turns CEO decisions into DB operations
// ============================================================

import { db } from "../db/client";
import { tasks, events } from "../db/schema";
import { sql } from "drizzle-orm";
import { logAgentActivity } from "../utils/agentLogger";
import { executeEscalation } from "./escalation-engine";
import type { CEOAction, CEOContext } from "./types";

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
        await executeEscalation(action, context.companyId);
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

      default:
        return { success: false, detail: `Unknown action type: ${(action as any).type}` };
    }
  } catch (err: any) {
    console.error(`Action execution failed (${action.type}):`, err);
    return { success: false, detail: `Error: ${err.message || err}` };
  }
}
