import { db } from "../db/client";
import { agentLogs } from "../db/schema";
import { sql } from "drizzle-orm";

export async function logAgentActivity(agentId: string, taskId: string, level: 'info' | 'action' | 'success' | 'error', message: string) {
  try {
    await db.insert(agentLogs).values({
      agentId,
      taskId,
      level,
      message,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("Failed to write agent log:", e);
  }
}
