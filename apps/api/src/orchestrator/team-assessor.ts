// ============================================================
// Team Assessor — Decision Type 1: Evaluate team composition
// ============================================================

import type { CEOContext, CEOAction, AgentCapability } from "./types";

export async function assessTeam(context: CEOContext): Promise<CEOAction[]> {
  const actions: CEOAction[] = [];
  const { agents } = context;

  // 1. Check if CEO exists
  const hasCEO = agents.some((a) => a.role === "CEO");
  if (!hasCEO) {
    actions.push({
      type: "escalate_to_founders",
      payload: { reason: "No CEO agent found. Company cannot operate without an orchestrator." },
      reason: "Critical: Company has no CEO to manage operations.",
      confidence: "high",
    });
    return actions;
  }

  // 2. Check role distribution
  const roleCounts: Record<string, number> = {};
  for (const a of agents) {
    roleCounts[a.role] = (roleCounts[a.role] || 0) + 1;
  }

  // 3. Check for overloaded roles
  for (const [role, count] of Object.entries(roleCounts)) {
    if (role === "FOUNDER" || role === "CEO") continue;
    if (count > 3) {
      actions.push({
        type: "escalate_to_founders",
        payload: { reason: `${count} agents share role "${role}". Consider splitting into sub-roles.` },
        reason: `Role "${role}" has ${count} agents — may need task specialization.`,
        confidence: "low",
      });
    }
  }

  // 4. Check for agents with no skills (excluding founders)
  const unskilledAgents = agents.filter((a) => a.skills.length === 0 && a.role !== "FOUNDER");
  if (unskilledAgents.length > 0) {
    for (const agent of unskilledAgents) {
      actions.push({
        type: "assign_bundle_to_agent",
        payload: { agentId: agent.id, agentName: agent.name, role: agent.role },
        reason: `Agent "${agent.name}" (${agent.role}) has no skills. Assigning default bundle.`,
        confidence: "high",
      });
    }
  }

  return actions;
}
