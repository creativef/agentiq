import { sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  ceoDecisions,
  tasks,
  agents,
  agentSkills,
  skills,
  companyBriefs,
  agentPerformance,
} from "../db/schema";
import { logAgentActivity } from "../utils/agentLogger";

// ============================================================
// CEO ORCHESTRATOR ENGINE
// Autonomous decision-making layer for the CEO agent.
// Reads the company brief, evaluates pending tasks, makes
// delegation decisions, and creates subtasks.
// ============================================================

interface CEOContext {
  companyId: string;
  brief: { vision: string; marketContext: string | null; constraints: string | null; priorities: string | null } | null;
  ceoAgentId: string | null;
}

interface DelegationDecision {
  taskId: string;
  agentId: string | null;
  decision: string;
  reasoning: string;
  action: "assign" | "create_agent" | "escalate" | "retry";
}

// Find or create the CEO agent for a company
async function getCEO(companyId: string): Promise<{ id: string; name: string } | null> {
  const ceo = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(sql`${agents.companyId} = ${companyId} AND UPPER(${agents.role}) = 'CEO'`)
    .limit(1);
  return ceo[0] || null;
}

// Get company briefing document
async function getBrief(companyId: string) {
  const brief = await db
    .select({
      vision: companyBriefs.vision,
      marketContext: companyBriefs.marketContext,
      constraints: companyBriefs.constraints,
      priorities: companyBriefs.priorities,
    })
    .from(companyBriefs)
    .where(sql`${companyBriefs.companyId} = ${companyId} AND ${companyBriefs.status} = 'active'`)
    .limit(1);
  return brief[0] || null;
}

// Evaluate what agents exist and their skills
async function getAgentCapabilities(companyId: string) {
  const agentRows = await db
    .select({
      id: agents.id, name: agents.name, role: agents.role, status: agents.status,
    })
    .from(agents)
    .where(sql`${agents.companyId} = ${companyId}`);

  const agentSkillsList = new Map<string, string[]>();
  for (const agent of agentRows) {
    const skillRows = await db
      .select({ name: skills.name })
      .from(agentSkills)
      .innerJoin(skills, sql`${agentSkills.skillId} = ${skills.id}`)
      .where(sql`${agentSkills.agentId} = ${agent.id}`);
    agentSkillsList.set(agent.id, skillRows.map((s) => s.name));
  }

  return { agents: agentRows, skills: agentSkillsList };
}

// Find the best agent for a task based on title/description keywords vs agent roles and skills
function findBestAgent(
  taskTitle: string,
  taskDesc: string,
  agentCaps: { agents: Array<{ id: string; name: string; role: string; status: string }>; skills: Map<string, string[]> },
  ceoId: string | null
): { agentId: string | null; reasoning: string } {
  const text = `${taskTitle} ${taskDesc}`.toLowerCase();

  // Rule-based matching against agent roles
  const roleKeywords: Record<string, string[]> = {
    CTO: ["code", "tech", "api", "database", "server", "frontend", "backend", "deploy", "architecture", "stack"],
    CFO: ["finance", "budget", "revenue", "cost", "pricing", "financial", "invoice", "profit"],
    CMO: ["marketing", "brand", "campaign", "content", "social", "growth", "seo", "ads"],
    COO: ["operations", "process", "workflow", "efficiency", "logistics"],
    MANAGER: ["manage", "coordinate", "team", "organize", "schedule"],
    AGENT: ["research", "write", "analyze", "review", "test"],
  };

  // Find best matching role
  let bestRole = null;
  let bestScore = 0;

  for (const [role, keywords] of Object.entries(roleKeywords)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  // If a role matched, find an agent with that role
  if (bestRole) {
    const matching = agentCaps.agents.filter((a) => a.role === bestRole && a.id !== ceoId && a.status !== "failed");
    if (matching.length > 0) {
      return {
        agentId: matching[0].id,
        reasoning: `Matched role: ${bestRole} (${bestScore} keyword matches). Assigned to "${matching[0].name}".`,
      };
    }
  }

  // Fall back: assign to first available non-CEO agent
  const available = agentCaps.agents.filter((a) => a.id !== ceoId && a.status !== "failed");
  if (available.length > 0) {
    return {
      agentId: available[0].id,
      reasoning: `No strong role match. Assigned to available agent "${available[0].name}" (${available[0].role}).`,
    };
  }

  return { agentId: null, reasoning: "No available agents found. Agent creation needed." };
}

// Main CEO orchestration loop — call this from the task scheduler
export async function runCEOLoop(companyId: string): Promise<{ processed: number; decisions: string[] }> {
  const decisions: string[] = [];
  const ceo = await getCEO(companyId);
  const brief = await getBrief(companyId);
  const agentCaps = await getAgentCapabilities(companyId);

  // Find pending tasks that need CEO attention
  const pendingTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      execStatus: tasks.execStatus,
      agentId: tasks.agentId,
      approvalStatus: tasks.approvalStatus,
    })
    .from(tasks)
    .leftJoin(agents, sql`${tasks.agentId} = ${agents.id}`)
    .where(sql`${agents.companyId} = ${companyId} OR ${tasks.agentId} IS NULL`)
    .and(sql`(
      ${tasks.execStatus} = 'ready' AND ${tasks.agentId} IS NULL
      OR ${tasks.approvalStatus} = 'pending'
      OR (${tasks.execStatus} = 'failed' AND ${tasks.status} = 'blocked')
    )`);

  for (const task of pendingTasks) {
    const title = task.title;
    const desc = task.description || "";

    // 1. Unassigned ready tasks — CEO assigns them
    if (task.execStatus === "ready" && !task.agentId) {
      const match = findBestAgent(title, desc, agentCaps, ceo?.id || null);
      if (match.agentId) {
        await db.update(tasks).set({ agentId: match.agentId }).where(sql`${tasks.id} = ${task.id}`);
        decisions.push(`Assigned "${title}" → ${match.reasoning}`);
        if (ceo) {
          await logAgentActivity(ceo.id, task.id, "action", `[CEO] Assigned task: "${title}". ${match.reasoning}`);
        }
      } else {
        decisions.push(`Cannot assign "${title}": ${match.reasoning}`);
      }
    }

    // 2. Pending approval — CEO approves
    if (task.approvalStatus === "pending") {
      await db.update(tasks).set({ approvalStatus: "approved", execStatus: "ready" }).where(sql`${tasks.id} = ${task.id}`);
      decisions.push(`Approved task: "${title}"`);
      if (ceo) {
        await logAgentActivity(ceo.id, task.id, "action", `[CEO] Approved task: "${title}"`);
      }
    }

    // 3. Failed tasks — CEO decides: retry or escalate
    if (task.execStatus === "failed" && task.status === "blocked") {
      // Simple retry logic: if it failed once, try again
      const retries = await db
        .select({ id: ceoDecisions.id })
        .from(ceoDecisions)
        .where(sql`${ceoDecisions.targetId} = ${task.id} AND ${ceoDecisions.action} = 'retry'`)
        .limit(2);

      if (retries.length < 2) {
        await db.update(tasks).set({ execStatus: "ready", status: "backlog" }).where(sql`${tasks.id} = ${task.id}`);
        decisions.push(`Retrying "${title}" (attempt ${retries.length + 1})`);
        if (ceo) {
          await db.insert(ceoDecisions).values({
            companyId,
            agentId: ceo.id,
            decision: `Retrying "${title}"`,
            reasoning: "Task failed once, attempting retry",
            action: "retry",
            targetId: task.id,
          });
          await logAgentActivity(ceo.id, task.id, "action", `[CEO] Retrying failed task: "${title}"`);
        }
      } else {
        decisions.push(`Escalating "${title}" to founders (too many failures)`);
        await db.update(tasks).set({ status: "blocked" }).where(sql`${tasks.id} = ${task.id}`);
        if (ceo) {
          await db.insert(ceoDecisions).values({
            companyId,
            agentId: ceo.id,
            decision: `Escalating "${title}" to founders`,
            reasoning: "Task failed 2+ retries, needs human intervention",
            action: "escalate",
            targetId: task.id,
          });
          await logAgentActivity(ceo.id, task.id, "error", `[CEO] Escalating to founders: "${title}"`);
        }
      }
    }
  }

  return { processed: decisions.length, decisions };
}
