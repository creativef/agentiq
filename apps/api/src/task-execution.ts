import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { tasks, agents, projects, companyMembers, goals, agentSkills, skills as skillsTable, chatMessages } from "./db/schema";
import { logAgentActivity } from "./utils/agentLogger";

interface ExecutionContext {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  assignedAgent: { id: string; name: string; role: string };
  companyId: string;
  projectId: string;
  agentSkills: Array<{ name: string; category: string; instructions: string }>;
  scratchpad: string | null;
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
    execStatus: "ready",
    assignedBy: ctx.assignedAgent.id,
    scratchpad: ctx.scratchpad || `Context from ${ctx.assignedAgent.name} (${ctx.assignedAgent.role})`,
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

export async function executeTaskById(taskId: string): Promise<{ success: boolean; steps: ExecutionStep[]; result: string }> {
  const taskCheck = await db.select().from(tasks).where(sql`${tasks.id} = ${taskId}`).limit(1);
  if (taskCheck.length === 0) {
    throw new Error("Task not found");
  }
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
    projectId = projCheck[0].id;
  } else {
    // Resolve companyId from agent or assignedBy
    if (task.agentId) {
      const agentCompany = await db.select({ companyId: agents.companyId })
        .from(agents).where(sql`${agents.id} = ${task.agentId}`).limit(1);
      if (agentCompany.length > 0) companyId = agentCompany[0].companyId;
    }
    if (!companyId) {
      const companyCheck = await db.select({ companyId: companyMembers.companyId })
        .from(companyMembers).where(sql`${companyMembers.userId} = ${task.assignedBy}`).limit(1);
      if (companyCheck.length === 0) throw new Error("No company found");
      companyId = companyCheck[0].companyId;
    }

    // Ensure a valid project for the company
    const proj = await db.select({ id: projects.id })
      .from(projects).where(sql`${projects.companyId} = ${companyId}`).limit(1);
    if (proj.length > 0) {
      projectId = proj[0].id;
    } else {
      const created = await db.insert(projects).values({ companyId, name: "General Operations" }).returning({ id: projects.id });
      projectId = created[0].id;
    }

    // Backfill task.projectId if missing/invalid
    await db.update(tasks).set({ projectId }).where(sql`${tasks.id} = ${taskId}`);
  }

  const execContext: ExecutionContext = {
    taskId,
    taskTitle: task.title,
    taskDescription: task.description || "",
    assignedAgent: assignedAgentData || { id: "", name: "System", role: "SYSTEM" },
    companyId,
    projectId,
    agentSkills: agentSkillList,
    scratchpad: task.scratchpad || null,
  };

  await db.update(tasks).set({ execStatus: "executing" }).where(sql`${tasks.id} = ${taskId}`);
  await logAgentActivity(execContext.assignedAgent.id, taskId, "info", `🚀 Starting: "${task.title}"`);

  let result: { success: boolean; steps: ExecutionStep[]; report: string };
  try {
    result = await executeTask(execContext);
  } catch (e: any) {
    await db.update(tasks).set({
      execStatus: "failed",
      status: "blocked",
      result: `Execution Crashed: ${e.message || "Unknown error"}`,
    }).where(sql`${tasks.id} = ${taskId}`);
    throw e;
  }

  await db.update(tasks).set({
    execStatus: result.success ? "completed" : "failed",
    status: result.success ? "done" : "blocked",
    result: result.report,
  }).where(sql`${tasks.id} = ${taskId}`);

  // Chat integration: reply back to user for chat tasks
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
    console.error("[Task] Failed to send chat reply:", replyErr.message);
  }

  return { success: result.success, steps: result.steps, result: result.report };
}

// Background worker: execute ready tasks
export function startTaskWorker(intervalMs = 5000) {
  setInterval(async () => {
    try {
      const readyTasks = await db.select({ id: tasks.id })
        .from(tasks)
        .where(sql`
          ${tasks.execStatus} = 'ready'
          AND (${tasks.approvalStatus} IS NULL OR ${tasks.approvalStatus} = 'approved')
          AND (${tasks.scheduledAt} IS NULL OR ${tasks.scheduledAt} <= NOW())
        `)
        .limit(5);

      for (const t of readyTasks) {
        const updated = await db.update(tasks)
          .set({ execStatus: 'executing', status: 'in_progress' })
          .where(sql`${tasks.id} = ${t.id} AND ${tasks.execStatus} = 'ready'`)
          .returning({ id: tasks.id });
        if (updated.length === 0) continue;

        try {
          await executeTaskById(t.id);
        } catch (e: any) {
          await db.update(tasks).set({
            execStatus: "failed",
            status: "blocked",
            result: `Worker execution failed: ${e.message || "Unknown error"}`,
          }).where(sql`${tasks.id} = ${t.id}`);
        }
      }
    } catch (e: any) {
      console.error("[TaskWorker] Error:", e.message);
    }
  }, intervalMs);
}
