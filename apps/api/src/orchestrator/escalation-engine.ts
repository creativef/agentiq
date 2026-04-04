// ============================================================
// Escalation Engine — Decision Type 5: Escalate to founders
// ============================================================

import { db } from "../db/client";
import { tasks, events } from "../db/schema";
import { sql } from "drizzle-orm";
import type { CEOAction } from "./types";

export async function executeEscalation(action: CEOAction, companyId: string): Promise<void> {
  // Create an event that founders see on their dashboard
  try {
    await db.insert(events).values({
      companyId,
      type: "ceo_escalation",
      actor: "CEO",
      description: action.reason,
      meta: JSON.stringify({ action: action.type, payload: action.payload, confidence: action.confidence }),
    });
  } catch (e) {
    console.error("Failed to write escalation event:", e);
  }

  // If escalation is about a task, update the task's approval status
  if (action.payload.taskId) {
    try {
      await db
        .update(tasks)
        .set({ execStatus: "pending_approval", approvalStatus: "pending", approverRole: "FOUNDER" })
        .where(sql`${tasks.id} = ${action.payload.taskId}`);
    } catch (e) {
      console.error("Failed to update task approval status:", e);
    }
  }
}
