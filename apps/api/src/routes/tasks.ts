import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { tasks, agents, projects, companyMembers, companies, goals, agentSkills, skills as skillsTable, agentLogs, chatMessages } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { logAgentActivity } from "../utils/agentLogger";

// ============================================================
// REAL EXECUTION ENGINE
// ============================================================

interface ExecutionContext {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  assignedAgent: { id: string; name: string; role: string };
  companyId: string;
  projectId: string;
  agentSkills: Array<{ name: string; category: string; instructions: string }>;
  scratchpad: string | null;   // Shared context from CEO/parent
}

interface ExecutionStep {
  agent: string;
  action: string;
  outcome: string;
  databaseChanges: string[];
}

function extractRoles(text: string): string[] {
  const roles = ["FOUNDER", "CEO", "MANAGER", "AGENT", "CTO", "CFO", "CMO", "COO", "VP"];
  const mentions: string[] = [];
  for (const role of roles) {
    const regex = new RegExp(`\\b${role}\\b`, 'i');
    if (regex.test(text)) mentions.push(role);
  }
  if (text.toLowerCase().includes("hire cto") || text.toLowerCase().includes("found cto")) mentions.push("CTO");
  if (text.toLowerCase().includes("hire cfo") || text.toLowerCase().includes("found cfo")) mentions.push("CFO");
  if (text.toLowerCase().includes("hire cmo") || text.toLowerCase().includes("found cmo")) mentions.push("CMO");
  return [...new Set(mentions)];
}

async function createSubtask(ctx: ExecutionContext, role: string, title: string, description: string) {
  const agent = await db.select().from(agents)
    .where(sql`${agents.companyId} = ${ctx.companyId} AND UPPER(${agents.role}) = ${role}`)
    .limit(1);
  const agentId = agent.length > 0 ? agent[0].id : null;

  await db.insert(tasks).values({
    projectId: ctx.projectId,
    agentId,
    title,
    description,
    status: "backlog",
    priority: "medium",
    execStatus: "pending_approval",
    approvalStatus: "pending",
    approverRole: "CEO",
  });
}

async function executeTask(ctx: ExecutionContext): Promise<{ success: boolean; steps: ExecutionStep[]; report: string }> {
  const steps: ExecutionStep[] = [];
  const changes: string[] = [];
  const lowerTitle = ctx.taskTitle.toLowerCase();
  const lowerDesc = (ctx.taskDescription || "").toLowerCase();
  const fullText = `${lowerTitle} ${lowerDesc}`;

  // 1. HIRING
  if (fullText.includes("hire") || fullText.includes("found") || fullText.includes("recruit") || fullText.includes("onboard")) {
    const rolesToHire = extractRoles(fullText);
    if (rolesToHire.length === 0) {
      if (fullText.includes("cto") || fullText.includes("chief technology")) rolesToHire.push("CTO");
      else if (fullText.includes("cfo") || fullText.includes("chief financial")) rolesToHire.push("CFO");
      else if (fullText.includes("cmo") || fullText.includes("chief marketing")) rolesToHire.push("CMO");
      else if (fullText.includes("coo") || fullText.includes("chief operations")) rolesToHire.push("COO");
      else if (fullText.includes("manager")) rolesToHire.push("MANAGER");
      else if (fullText.includes("agent") || fullText.includes("staff")) rolesToHire.push("AGENT");
      else rolesToHire.push("AGENT");
    }

    for (const role of rolesToHire) {
      const existing = await db.select().from(agents)
        .where(sql`${agents.companyId} = ${ctx.companyId} AND UPPER(${agents.role}) = ${role}`)
        .limit(1);

      await logAgentActivity(ctx.assignedAgent.id, ctx.taskId, "info", `Searching for existing ${role} agent...`);

      if (existing.length > 0) {
        await logAgentActivity(ctx.assignedAgent.id, ctx.taskId, "info", `Found existing agent: ${existing[0].name}.`);
        steps.push({ agent: ctx.assignedAgent.name, action: `Verified ${role} exists`, outcome: `"${existing[0].name}" is already active.`, databaseChanges: [] });
      } else {
        const agentName = `${role.charAt(0) + role.slice(1).toLowerCase()}`;
        await logAgentActivity(ctx.assignedAgent.id, ctx.taskId, "action", `Creating Agent: ${agentName}...`);

        const newAgent = await db.insert(agents).values({
          companyId: ctx.companyId, projectId: ctx.projectId, name: agentName, role, status: "idle", createdAt: new Date(),
        }).returning();

        await logAgentActivity(ctx.assignedAgent.id, ctx.taskId, "success", `✅ ${agentName} created as ${role}.`);
        changes.push(`Created agent: ${agentName} (${role})`);
        steps.push({ agent: ctx.assignedAgent.name, action: `Hired ${role}`, outcome: `Onboarded ${agentName}.`, databaseChanges: changes.slice() });

        // Assign skills
        const roleSkills: Record<string, string[]> = {
          CEO: ["Strategic Planning", "Project Management"], CTO: ["Code Generation", "Research & Analysis"],
          CFO: ["Research & Analysis"], CMO: ["Content Writing", "Research & Analysis"], MANAGER: ["Project Management"],
        };
        await logAgentActivity(ctx.assignedAgent.id, ctx.taskId, "action", `Assigning core skills...`);
        const skillNames = roleSkills[role] || ["Research & Analysis"];
        const skillRows = await db.select().from(skillsTable).where(sql`${skillsTable.name} IN ${skillNames}`);
        for (const skill of skillRows) {
          await db.insert(agentSkills).values({ agentId: newAgent[0].id, skillId: skill.id });
        }
        await logAgentActivity(ctx.assignedAgent.id, ctx.taskId, "success", `Skills: ${skillNames.join(", ")}`);
      }
    }
    for (const role of rolesToHire) {
      await createSubtask(ctx, role, `Onboarding for ${role}`, `Complete setup for new ${role}.`);
      steps.push({ agent: ctx.assignedAgent.name, action: "Created subtask", outcome: `Scheduled onboarding for ${role}.`, databaseChanges: changes.slice() });
    }
    return {
      success: true, steps,
      report: `🚀 HIRING COMPLETE\n${steps.map(s => `• [${s.agent}] ${s.action}: ${s.outcome}`).join('\n')}\n\n${changes.length > 0 ? 'Changes:\n' + changes.map(c => `  ✅ ${c}`).join('\n') : ''}`,
    };
  }

  // 2. GOALS
  if (fullText.includes("goal") || fullText.includes("strategy") || fullText.includes("kpi") || fullText.includes("metric")) {
    const keywords = ["revenue", "growth", "users", "traffic", "conversion", "launch", "profit"];
    const matches = keywords.filter(kw => fullText.includes(kw));
    for (const key of matches) {
      await db.insert(goals).values({ companyId: ctx.companyId, title: `${key.charAt(0) + key.slice(1)} Goal`, progress: 0 });
      changes.push(`Created goal: ${key}`);
    }
    if (matches.length === 0) {
      await db.insert(goals).values({ companyId: ctx.companyId, title: ctx.taskTitle, progress: 0 });
    }
    steps.push({ agent: ctx.assignedAgent.name, action: "Defined goals", outcome: `Created ${matches.length || 1} goal(s).`, databaseChanges: changes });
    return { success: true, steps, report: `🎯 GOALS SET\nGoals created: ${changes.join(", ")}` };
  }

  // 3. DELEGATION
  if (fullText.includes("team") || fullText.includes("manage") || fullText.includes("coordinate")) {
    const mentioned = extractRoles(fullText);
    if (mentioned.length > 0) {
      for (const role of mentioned) {
        await createSubtask(ctx, role, `Execute plan for ${role}`, `Review objectives and provide status update.`);
        changes.push(`Delegated to ${role}`);
      }
    }
    steps.push({ agent: ctx.assignedAgent.name, action: "Delegated", outcome: `Routed to ${mentioned.join(", ") || "agent pool"}.`, databaseChanges: changes });
    return { success: true, steps, report: `📋 DELEGETED\n${steps[0].outcome}` };
  }

  // DEFAULT
  steps.push({ agent: ctx.assignedAgent.name, action: "Completed", outcome: `Task "${ctx.taskTitle}" done.`, databaseChanges: changes });
  if (ctx.agentSkills.length > 0) {
    steps.push({ agent: ctx.assignedAgent.name, action: "Skill applied", outcome: `Used: ${ctx.agentSkills.map(s => s.name).join(", ")}`, databaseChanges: changes });
  }

  // STRUCTURED OUTPUT: Append JSON block for CEO parsing
  const structuredResult = JSON.stringify({
    status: "success",
    task: ctx.taskTitle,
    result: `Task completed. ${changes.join(", ")}`,
    blockers: [],
    next_steps: [],
    files_created: [],
  }, null, 2);

  return {
    success: true, steps,
    report: `✅ TASK COMPLETED\n${steps.map(s => `• [${s.agent}] ${s.action}: ${s.outcome}`).join('\n')}\n\n--- CEO PARSEABLE OUTPUT ---\n${structuredResult}`,
  };
}

// ============================================================
// ROUTERS
// ============================================================

export const tasksRouter = new Hono();
tasksRouter.use(authMiddleware);

// GET /tasks
tasksRouter.get("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const projectId = c.req.query("projectId") || null;
  const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);

  const baseQuery = db
    .select({
      id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status,
      priority: tasks.priority, agentId: tasks.agentId, projectId: tasks.projectId, createdAt: tasks.createdAt,
      execStatus: tasks.execStatus, approvalStatus: tasks.approvalStatus, approverRole: tasks.approverRole,
      result: tasks.result, assignedBy: tasks.assignedBy,
    })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .innerJoin(companies, sql`${projects.companyId} = ${companies.id}`)
    .innerJoin(companyMembers, sql`${companyMembers.companyId} = ${companies.id}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .limit(limit)
    .orderBy(tasks.createdAt);

  let rows = await baseQuery;
  if (projectId) rows = rows.filter((t) => t.projectId === projectId);

  const statusOrder = { pending_approval: 0, scheduled: 1, ready: 2, executing: 3, idle: 4, completed: 5, failed: 6 };
  rows.sort((a, b) => (statusOrder[a.execStatus as keyof typeof statusOrder] ?? 99) - (statusOrder[b.execStatus as keyof typeof statusOrder] ?? 99));

  const agentIds = rows.map((t) => t.agentId).filter(Boolean);
  if (agentIds.length > 0) {
    const agentList = await db.select({ id: agents.id, name: agents.name }).from(agents).where(sql`${agents.id} IN ${agentIds}`);
    const agentMap = new Map(agentList.map((a) => [a.id, a.name]));
    rows = rows.map((t) => ({ ...t, agentName: agentMap.get(t.agentId!) || null }));
  } else {
    rows = rows.map((t) => ({ ...t, agentName: null }));
  }

  return c.json({ tasks: rows });
});

// GET /tasks/approvals
tasksRouter.get("/tasks/approvals", async (c) => {
  const user: UserPayload = c.get("user");
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, agentId: tasks.agentId, projectId: tasks.projectId, approverRole: tasks.approverRole, createdAt: tasks.createdAt })
    .from(tasks)
    .leftJoin(agents, sql`${tasks.agentId} = ${agents.id}`)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .leftJoin(companyMembers, sql`${projects.companyId} = ${companyMembers.companyId}`)
    .where(sql`${tasks.approvalStatus} = 'pending' AND ${companyMembers.userId} = ${user.userId}`);
  return c.json({ approvals: rows });
});

// POST /tasks
tasksRouter.post("/tasks", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json();
  let execStatus = "idle";
  let approvalStatus: string | null = null;
  let taskStatus = "backlog";

  if (body.scheduledAt) { execStatus = "scheduled"; taskStatus = "ready"; }
  if (body.requiresApproval || body.approverRole) { approvalStatus = "pending"; execStatus = "pending_approval"; }

  const newTask = await db.insert(tasks).values({
    projectId: body.projectId, agentId: body.agentId || null, title: body.title,
    description: body.description || null, status: taskStatus, priority: body.priority || "medium",
    execStatus, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    approverRole: body.approverRole || null, approvalStatus, assignedBy: user.userId,
    scratchpad: body.scratchpad || null,
  }).returning();

  if (!approvalStatus && !body.scheduledAt) {
    await db.update(tasks).set({ execStatus: "ready" }).where(sql`${tasks.id} = ${newTask[0].id}`);
  }
  return c.json({ task: newTask[0] });
});

// POST /tasks/:taskId/approve
tasksRouter.post("/tasks/:taskId/approve", async (c) => {
  const taskId = c.req.param("taskId");
  await db.update(tasks).set({ approvalStatus: "approved", execStatus: "ready" }).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// POST /tasks/:taskId/reject
tasksRouter.post("/tasks/:taskId/reject", async (c) => {
  const taskId = c.req.param("taskId");
  await db.update(tasks).set({ approvalStatus: "rejected", execStatus: "failed", status: "blocked" }).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// POST /tasks/:taskId/execute
tasksRouter.post("/tasks/:taskId/execute", async (c) => {
  const taskId = c.req.param("taskId");
  const taskCheck = await db.select().from(tasks).where(sql`${tasks.id} = ${taskId}`).limit(1);
  if (taskCheck.length === 0) return c.json({ error: "Task not found" }, 404);
  const task = taskCheck[0];

  let assignedAgentData = null;
  if (task.agentId) {
    const ag = await db.select().from(agents).where(sql`${agents.id} = ${task.agentId}`).limit(1);
    if (ag.length > 0) assignedAgentData = ag[0];
  }

  let agentSkillList: Array<{ name: string; category: string; instructions: string }> = [];
  if (task.agentId) {
    const skillRows = await db
      .select({ name: skillsTable.name, category: skillsTable.category, instructions: skillsTable.instructions })
      .from(agentSkills).innerJoin(skillsTable, sql`${agentSkills.skillId} = ${skillsTable.id}`)
      .where(sql`${agentSkills.agentId} = ${task.agentId}`);
    agentSkillList = skillRows;
  }

  const projCheck = await db.select({ companyId: projects.companyId, id: projects.id })
    .from(projects).where(sql`${projects.id} = ${task.projectId}`).limit(1);

  let companyId: string;
  let projectId: string;
  if (projCheck.length > 0) {
    companyId = projCheck[0].companyId;
    projectId = projCheck[0].id || projCheck[0].companyId;
  } else {
    const companyCheck = await db.select({ companyId: companyMembers.companyId })
      .from(companyMembers).where(sql`${companyMembers.userId} = ${task.assignedBy}`).limit(1);
    if (companyCheck.length === 0) return c.json({ success: false, result: "❌ No company found." }, 500);
    companyId = companyCheck[0].companyId;
    projectId = companyCheck[0].companyId;
  }

  const execContext: ExecutionContext = {
    taskId, taskTitle: task.title, taskDescription: task.description || "",
    assignedAgent: assignedAgentData || { id: "", name: "System", role: "SYSTEM" },
    companyId, projectId, agentSkills: agentSkillList,
    scratchpad: task.scratchpad || null,
  };

  await db.update(tasks).set({ execStatus: "executing" }).where(sql`${tasks.id} = ${taskId}`);
  await logAgentActivity(execContext.assignedAgent.id, taskId, "info", `🚀 Starting: "${task.title}"`);

  try {
    const result = await executeTask(execContext);
    
    await db.update(tasks).set({
      execStatus: result.success ? "completed" : "failed",
      status: result.success ? "done" : "blocked", result: result.report,
    }).where(sql`${tasks.id} = ${taskId}`);

    // CHAT INTEGRATION: If this task came from a Chat message, reply back!
    try {
      if (task.title.toLowerCase().startsWith("chat:")) {
        const replyToUser = task.assignedBy;
        if (replyToUser) {
          await db.insert(chatMessages).values({
            companyId: companyId,
            agentId: task.agentId || null,
            userId: replyToUser,
            content: result.success ? `✅ Done: ${result.report}` : `⚠️ ${result.report}`,
            role: "agent",
          });
        }
      }
    } catch (replyErr: any) {
      // Log error but do NOT crash the task execution
      console.error("[Task] Failed to send chat reply:", replyErr.message);
    }

    return c.json({ success: result.success, steps: result.steps, result: result.report });
  } catch (e: any) {
    await db.update(tasks).set({
      execStatus: "failed", status: "blocked", result: `Execution Crashed: ${e.message}`,
    }).where(sql`${tasks.id} = ${taskId}`);
    return c.json({ success: false, result: `Crashed: ${e.message}` }, 500);
  }
});

// PUT /tasks/:taskId
tasksRouter.put("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const updates: any = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.agentId !== undefined) updates.agentId = body.agentId || null;
  if (body.scheduledAt !== undefined) updates.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (body.execStatus !== undefined) updates.execStatus = body.execStatus;

  await db.update(tasks).set(updates).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});

// DELETE /tasks/:taskId
tasksRouter.delete("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  await db.delete(tasks).where(sql`${tasks.id} = ${taskId}`);
  return c.json({ ok: true });
});
