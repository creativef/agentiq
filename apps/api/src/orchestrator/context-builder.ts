import { db } from "../db/client";
import { agents, agentSkills, skills, tasks, agentLogs, companies, projects, companyBriefs } from "../db/schema";
import { sql } from "drizzle-orm";
import type { CEOContext, AgentCapability, TaskRequirement, InProgressTask, BlockedTask } from "./types";
import { logAgentActivity } from "../utils/agentLogger";

export async function buildCEOContext(companyId: string): Promise<CEOContext> {
  // 1. Company info
  const company = await db
    .select({ id: companies.id, name: companies.name, goal: companies.goal })
    .from(companies)
    .where(sql`${companies.id} = ${companyId}`)
    .limit(1);

  if (company.length === 0) throw new Error(`Company ${companyId} not found`);

  // 2. Agent capabilities with skills
  const agentRows = await db
    .select({
      agent: agents,
      skillName: skills.name,
    })
    .from(agents)
    .leftJoin(agentSkills, sql`${agents.id} = ${agentSkills.agentId}`)
    .leftJoin(skills, sql`${agentSkills.skillId} = ${skills.id}`)
    .where(sql`${agents.companyId} = ${companyId}`);

  const agentMap = new Map<string, AgentCapability>();
  for (const row of agentRows) {
    const a = row.agent;
    if (!agentMap.has(a.id)) {
      agentMap.set(a.id, {
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        skills: [],
        activeTaskCount: 0,
        failedTaskCount: 0,
      });
    }
    if (row.skillName && !agentMap.get(a.id)!.skills.includes(row.skillName)) {
      agentMap.get(a.id)!.skills.push(row.skillName);
    }
  }

  // 3. Count active/failed tasks per agent
  for (const taskRow of await db
    .select({ agentId: tasks.agentId, status: tasks.status })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`(${projects.companyId} = ${companyId}) AND (${tasks.status} = 'in_progress' OR ${tasks.status} = 'failed')`)) {
    const agent = agentMap.get(taskRow.agentId!);
    if (!agent) continue;
    if (taskRow.status === "in_progress") agent.activeTaskCount++;
    if (taskRow.status === "failed") agent.failedTaskCount++;
  }

  const agentsList = [...agentMap.values()];

  // 4. Pending tasks (backlog, ready, or todo)
  const pending = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      status: tasks.status,
      execStatus: tasks.execStatus,
    })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`(${projects.companyId} = ${companyId}) 
      AND (${tasks.status} = 'backlog' OR ${tasks.status} = 'ready' OR ${tasks.status} = 'todo')`)
    .orderBy(sql`CASE ${tasks.priority}
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4 END`);

  const pendingTasks: TaskRequirement[] = pending.map((t) => ({
    taskId: t.id,
    title: t.title,
    description: t.description || "",
    inferredSkills: extractRequiredSkills(t.title, t.description || ""),
    priority: t.priority || "medium",
    isUrgent: t.priority === "high",
  }));

  // 5. In-progress tasks
  const inProgressRaw = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      agentId: tasks.agentId,
      status: tasks.status,
      execStatus: tasks.execStatus,
    })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`(${projects.companyId} = ${companyId}) AND ${tasks.status} = 'in_progress'`);

  const inProgressTasks: InProgressTask[] = inProgressRaw.map((t) => ({
    id: t.id,
    title: t.title,
    agentId: t.agentId,
    status: t.status,
    execStatus: t.execStatus || "",
  }));

  // 6. Blocked tasks
  const blockedRaw = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
    })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`(${projects.companyId} = ${companyId}) AND ${tasks.status} = 'blocked'`);

  const blockedTasks: BlockedTask[] = blockedRaw.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
  }));

  const budgetRemaining = 100 - agentsList.reduce((sum, a) => sum + (a.costMonthly || 0), 0);

  return {
    companyId,
    companyName: company[0].name,
    companyGoal: company[0].goal,
    agents: agentsList,
    pendingTasks,
    inProgressTasks,
    blockedTasks,
    budgetRemaining,
    lastReportAt: null,
  };
}

// Skill extraction from task text — keyword-based, replace with LLM later
function extractRequiredSkills(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();

  const skillMap: Record<string, string[]> = {
    "deploy": ["deployment"],
    "authentication": ["authentication"],
    "oauth": ["authentication"],
    "frontend": ["frontend-development"],
    "ui": ["frontend-development"],
    "database": ["database-design"],
    "api": ["api-design", "backend"],
    "test": ["testing"],
    "review": ["code-review"],
    "document": ["documentation"],
    "monitor": ["monitoring"],
    "security": ["security"],
    "encrypt": ["security"],
    "budget": ["financial-analysis"],
    "report": ["reporting"],
    "marketing": ["content-strategy", "social-media"],
    "write": ["copywriting"],
    "design": ["system-design"],
    "architecture": ["system-design"],
    "hire": ["strategic-planning"],
    "fire": ["strategic-planning"],
    "meeting": ["project-management"],
    "plan": ["project-management"],
  };

  const found = new Set<string>();
  for (const [keyword, skillList] of Object.entries(skillMap)) {
    if (text.includes(keyword)) {
      for (const s of skillList) found.add(s);
    }
  }
  return [...found];
}
