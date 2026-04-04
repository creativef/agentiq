// ============================================================
// Report Generator — Decision Type 6: Generate founder reports
// ============================================================

import { db } from "../db/client";
import { tasks, projects, events } from "../db/schema";
import { sql } from "drizzle-orm";
import type { CEOContext, CEOAction } from "./types";

export async function generateReport(context: CEOContext): Promise<CEOAction> {
  const completedCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`(${projects.companyId} = ${context.companyId}) AND (${tasks.status} = 'done' OR ${tasks.execStatus} = 'completed')`);

  const failedCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`(${projects.companyId} = ${context.companyId}) AND ${tasks.execStatus} = 'failed'`);

  const activeCount = context.agents.filter((a) => a.status === "idle" || a.status === "running").length;
  const errorCount = context.agents.filter((a) => a.status === "error").length;

  const report = {
    type: "CEO_STATUS_REPORT",
    company: context.companyName,
    period: new Date().toISOString(),
    metrics: {
      agents: { total: context.agents.length, active: activeCount, errors: errorCount },
      tasks: {
        completed: completedCount[0]?.count || 0,
        failed: failedCount[0]?.count || 0,
        pending: context.pendingTasks.length,
        inProgress: context.inProgressTasks.length,
        blocked: context.blockedTasks.length,
      },
      pendingDecisions: context.pendingTasks.map((t) => ({
        title: t.title,
        priority: t.priority,
        isUrgent: t.isUrgent,
      })),
    },
    assessment: generateAssessment(context),
  };

  return {
    type: "create_report",
    payload: report,
    reason: `Scheduled report: ${completedCount[0]?.count || 0} completed, ${failedCount[0]?.count || 0} failed, ${context.pendingTasks.length} pending`,
    confidence: "high",
  };
}

function generateAssessment(context: CEOContext): string {
  const parts: string[] = [];

  if (context.pendingTasks.length === 0 && context.inProgressTasks.length === 0) {
    parts.push("All clear. No pending or in-progress tasks.");
  }

  if (context.pendingTasks.length > 5) {
    parts.push(`${context.pendingTasks.length} tasks pending — consider allocating more agents.`);
  }

  const errors = context.agents.filter((a) => a.status === "error");
  if (errors.length > 0) {
    parts.push(`${errors.length} agent(s) reporting errors: ${errors.map((e) => e.name).join(", ")}`);
  }

  if (context.blockedTasks.length > 0) {
    parts.push(`${context.blockedTasks.length} blocked task(s) require intervention.`);
  }

  if (parts.length === 0) {
    parts.push("Company operating normally. No significant issues.");
  }

  return parts.join("\n");
}
