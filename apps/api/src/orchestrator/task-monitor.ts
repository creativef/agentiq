// ============================================================
// Task Monitor — Decision Type 4: Monitor in-progress tasks
// ============================================================

import { db } from "../db/client";
import { tasks, agentLogs, projects } from "../db/schema";
import { sql } from "drizzle-orm";
import type { CEOContext, CEOAction, InProgressTask } from "./types";

const STALE_THRESHOLD_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;

interface InProgressDetail {
  id: string;
  title: string;
  agentId: string | null;
  status: string;
  execStatus: string;
  lastLogTime: Date | null;
  lastLogLevel: string | null;
  retryCount: number;
}

export async function monitorTasks(context: CEOContext): Promise<CEOAction[]> {
  const actions: CEOAction[] = [];
  const details = await getInProgressDetails(context.companyId);

  for (const task of details) {
    if (task.lastLogLevel === "error") {
      actions.push({
        type: "retry_task",
        payload: { taskId: task.id, agentId: task.agentId, reason: "Task last activity was an error", retryCount: task.retryCount + 1 },
        reason: `Task "${task.title}" encountered an error. Retrying.`,
        confidence: "medium",
      });
      if (task.retryCount >= MAX_RETRIES) {
        actions.push({
          type: "reassign_task",
          payload: { taskId: task.id, currentAgentId: task.agentId },
          reason: `Task failed ${task.retryCount} times with same agent. Reassigning.`,
          confidence: "high",
        });
      }
      continue;
    }

    if (task.lastLogTime) {
      const timeSinceLast = Date.now() - task.lastLogTime.getTime();
      if (timeSinceLast > STALE_THRESHOLD_MS) {
        actions.push({
          type: "retry_task",
          payload: { taskId: task.id, agentId: task.agentId, reason: `No activity for ${Math.round(timeSinceLast / 60000)}m`, retryCount: task.retryCount + 1 },
          reason: `Task "${task.title}" stalled — no logs for ${Math.round(timeSinceLast / 60000)}min`,
          confidence: "medium",
        });
      }
    }

    if (!task.agentId) {
      actions.push({
        type: "reassign_task",
        payload: { taskId: task.id },
        reason: `Task "${task.title}" is in-progress but has no agent assigned`,
        confidence: "high",
      });
    }
  }

  return actions;
}

async function getInProgressDetails(companyId: string): Promise<InProgressDetail[]> {
  const taskRows = await db
    .select({ id: tasks.id, title: tasks.title, agentId: tasks.agentId, status: tasks.status, execStatus: tasks.execStatus })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`(${projects.companyId} = ${companyId}) AND ${tasks.status} = 'in_progress'`);

  const details: InProgressDetail[] = [];

  for (const task of taskRows) {
    const latestLogs = await db
      .select({ createdAt: agentLogs.createdAt, level: agentLogs.level })
      .from(agentLogs)
      .where(sql`${agentLogs.taskId} = ${task.id}`)
      .orderBy(agentLogs.createdAt)
      .limit(1);

    details.push({
      id: task.id,
      title: task.title,
      agentId: task.agentId,
      status: task.status,
      execStatus: task.execStatus || "",
      lastLogTime: latestLogs[0]?.createdAt || null,
      lastLogLevel: latestLogs[0]?.level || null,
      retryCount: 0,
    });
  }

  return details;
}
