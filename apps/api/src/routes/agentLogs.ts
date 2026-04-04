import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { agentLogs, agents, tasks, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const agentLogsRouter = new Hono();
agentLogsRouter.use(authMiddleware);

// GET /agents/:id/activity — Get the activity log for a specific agent
agentLogsRouter.get("/agents/:agentId/activity", async (c) => {
  const agentId = c.req.param("agentId");
  const user: UserPayload = c.get("user");

  // Check access
  const agentCheck = await db.select({ companyId: agents.companyId }).from(agents).where(sql`${agents.id} = ${agentId}`).limit(1);
  if (agentCheck.length === 0) return c.json({ error: "Agent not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${agentCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const logs = await db
    .select({
      id: agentLogs.id,
      agentId: agentLogs.agentId,
      taskId: agentLogs.taskId,
      taskTitle: tasks.title,
      level: agentLogs.level,
      message: agentLogs.message,
      createdAt: agentLogs.createdAt,
    })
    .from(agentLogs)
    .leftJoin(tasks, sql`${agentLogs.taskId} = ${tasks.id}`)
    .where(sql`${agentLogs.agentId} = ${agentId}`)
    .orderBy(agentLogs.createdAt)
    .limit(500);

  return c.json({ logs });
});
