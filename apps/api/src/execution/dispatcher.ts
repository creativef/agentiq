import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { executionRuns, executionEvents, tasks, agentLogs } from "../db/schema";

export async function enqueueExecution(params: {
  taskId: string;
  agentId?: string | null;
  companyId: string;
  provider?: string;
  payload?: any;
}) {
  const provider = params.provider || "hermes";
  const run = await db.insert(executionRuns).values({
    companyId: params.companyId,
    taskId: params.taskId,
    agentId: params.agentId || null,
    provider,
    status: "queued",
  }).returning();

  await db.insert(executionEvents).values({
    runId: run[0].id,
    level: "info",
    message: "Execution queued",
    meta: params.payload ? JSON.stringify(params.payload) : null,
  });

  await db.update(tasks).set({
    execStatus: "queued",
    status: "in_progress",
  }).where(sql`${tasks.id} = ${params.taskId}`);

  return run[0];
}

export async function recordExecutionEvent(params: {
  runId: string;
  level?: string;
  message: string;
  meta?: any;
}) {
  await db.insert(executionEvents).values({
    runId: params.runId,
    level: params.level || "info",
    message: params.message,
    meta: params.meta ? JSON.stringify(params.meta) : null,
  });
}

export async function recordExecutionResult(params: {
  runId: string;
  status: "completed" | "failed";
  result?: string | null;
  error?: string | null;
}) {
  const runCheck = await db.select({ taskId: executionRuns.taskId, agentId: executionRuns.agentId })
    .from(executionRuns)
    .where(sql`${executionRuns.id} = ${params.runId}`)
    .limit(1);
  if (runCheck.length === 0) throw new Error("Execution run not found");

  await db.update(executionRuns).set({
    status: params.status,
    result: params.result || null,
    error: params.error || null,
    finishedAt: new Date(),
  }).where(sql`${executionRuns.id} = ${params.runId}`);

  await db.update(tasks).set({
    execStatus: params.status,
    status: params.status === "completed" ? "done" : "blocked",
    result: params.result || params.error || null,
  }).where(sql`${tasks.id} = ${runCheck[0].taskId}`);

  if (runCheck[0].agentId) {
    await db.insert(agentLogs).values({
      agentId: runCheck[0].agentId,
      taskId: runCheck[0].taskId,
      level: params.status === "completed" ? "success" : "error",
      message: params.status === "completed"
        ? "✅ Hermes completed task"
        : `⚠️ Hermes failed task: ${params.error || "Unknown error"}`,
    }).catch(() => {});
  }
}
