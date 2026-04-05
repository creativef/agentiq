import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { companyMembers, companies, agents, users } from "../db/schema";
import { tasks } from "../db/schema";
import { chatMessages } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limiter";

export const chatRouter = new Hono();
chatRouter.use(authMiddleware);

// GET /chat — list messages
chatRouter.get("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const targetAgentId = c.req.query("agentId") || null;
  
  const baseWhere = targetAgentId
    ? sql`(
        (${companyMembers.userId} = ${user.userId}) 
        AND (${chatMessages.companyId} = ${companyMembers.companyId})
        AND (${chatMessages.agentId} = ${targetAgentId} OR ${chatMessages.agentId} IS NULL)
      )`
    : sql`(
        (${companyMembers.userId} = ${user.userId}) 
        AND (${chatMessages.companyId} = ${companyMembers.companyId})
        AND (${chatMessages.agentId} IS NULL)
      )`;

  const rows = await db
    .select({
      id: chatMessages.id,
      content: chatMessages.content,
      role: chatMessages.role,
      agentId: chatMessages.agentId,
      createdAt: chatMessages.createdAt,
      agentName: agents.name,
      userEmail: users.email,
    })
    .from(chatMessages)
    .leftJoin(agents, sql`${chatMessages.agentId} = ${agents.id}`)
    .leftJoin(companies, sql`${chatMessages.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, baseWhere)
    .leftJoin(users, sql`${chatMessages.userId} = ${users.id}`)
    .orderBy(chatMessages.createdAt)
    .limit(50); // Default limit

  return c.json({ messages: rows });
});

// POST /chat — send a message
chatRouter.post("/chat", async (c) => {
  const user: UserPayload = c.get("user");
  const ip = c.req.header("x-forwarded-for") || "unknown";
  
  // Rate limiting
  const rl = rateLimitMiddleware(ip);
  if (!rl.allowed) {
    return c.json({ error: `Too fast. Wait ${rl.retryAfter}s` }, 429);
  }

  const body = await c.req.json().catch(() => ({}));

  if (!body.content || !body.companyId) {
    return c.json({ error: "Missing content or companyId" }, 400);
  }

  // Verify access
  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${body.companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // 1. Save the message
  const msg = await db.insert(chatMessages).values({
    companyId: body.companyId,
    agentId: body.agentId || null,
    userId: user.userId,
    content: body.content,
    role: "user",
  }).returning();

  // 2. Chat-to-Task (Direct Command)
  if (body.agentId) {
    try {
      // Check if the agent is actually in this company
      const agentCheck = await db.select({ id: agents.id, name: agents.name, projectId: agents.projectId })
        .from(agents)
        .where(sql`${agents.id} = ${body.agentId} AND ${agents.companyId} = ${body.companyId}`)
        .limit(1);

      if (agentCheck.length === 0) {
         return c.json({ error: "Target agent not found in this company" }, 404);
      }

      // Find a valid projectId. The DB requires NOT NULL.
      let targetProjectId = agentCheck[0].projectId;

      if (!targetProjectId) {
         // Fallback: Find the first project for this company
         const proj = await db.select({ id: projects.id })
           .from(projects)
           .where(sql`${projects.companyId} = ${body.companyId}`)
           .limit(1);
         
         if (proj.length > 0) {
           targetProjectId = proj[0].id;
         } else {
           // If NO projects exist, create a default one for the chat
           const newProj = await db.insert(projects).values({ 
             companyId: body.companyId, 
             name: "Chat Operations" 
           }).returning();
           targetProjectId = newProj[0].id;
         }
      }

      const taskTitle = `Chat: ${body.content.substring(0, 40)}${body.content.length > 40 ? '...' : ''}`;
      
      const newTask = await db.insert(tasks).values({
        title: taskTitle,
        description: `User message: "${body.content}"`,
        status: "backlog",
        execStatus: "ready", // Ready to run immediately
        agentId: body.agentId,
        projectId: targetProjectId, 
        assignedBy: user.userId,
      }).returning();

      console.log(`[Chat] Created Task ${newTask[0].id} for ${agentCheck[0].name}: "${taskTitle}"`);

      return c.json({ 
        message: msg[0], 
        taskCreated: true, 
        taskId: newTask[0].id 
      });

    } catch (e: any) {
      console.error("[Chat] Task Creation Failed:", e.message);
      return c.json({ message: msg[0], taskCreated: false, error: "Task creation failed: " + e.message });
    }
  }
  return c.json({ message: msg[0], taskCreated: false });
});

export { chatRouter };
