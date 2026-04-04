// ============================================================
// Skill Matcher — Core Routing Brain
// ============================================================

import type { AgentCapability, AgentMatch, TaskRequirement } from "./types";

const MAX_ACTIVE_TASKS = 5;

export function matchAgentToTask(task: TaskRequirement, agents: AgentCapability[]): AgentMatch[] {
  if (agents.length === 0) return [];

  if (task.inferredSkills.length === 0) {
    // No specific skills required — assign to least-loaded agent
    const sorted = [...agents].sort((a, b) => a.activeTaskCount - b.activeTaskCount);
    return sorted.map((agent) => ({
      agent,
      score: MAX_ACTIVE_TASKS - agent.activeTaskCount,
      matchingSkills: [],
      missingSkills: [],
      matchPercentage: 100,
      overloaded: agent.activeTaskCount >= MAX_ACTIVE_TASKS,
      hasFailedRecently: agent.failedTaskCount > 0,
    }));
  }

  const matches: AgentMatch[] = [];

  for (const agent of agents) {
    const agentSkillSet = new Set(agent.skills);
    const required = task.inferredSkills;

    const matching = required.filter((s) => agentSkillSet.has(s));
    const missing = required.filter((s) => !agentSkillSet.has(s));

    const matchPct = required.length > 0 ? (matching.length / required.length) * 100 : 0;

    // Score: 40% skill match, 25% capacity, 20% reliability, 15% role alignment
    const capacityScore = Math.max(0, ((MAX_ACTIVE_TASKS - agent.activeTaskCount) / MAX_ACTIVE_TASKS) * 25);
    const reliabilityScore = Math.max(0, ((10 - agent.failedTaskCount) / 10) * 20);
    const roleScore = calculateRoleAffinity(task, agent) * 15;

    const totalScore = ((matchPct / 100) * 40) + capacityScore + reliabilityScore + roleScore;

    matches.push({
      agent,
      score: totalScore,
      matchingSkills: matching,
      missingSkills: missing,
      matchPercentage: matchPct,
      overloaded: agent.activeTaskCount >= MAX_ACTIVE_TASKS,
      hasFailedRecently: agent.failedTaskCount > 0,
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function shouldCreateNewAgent(task: TaskRequirement, bestMatch: AgentMatch | undefined): boolean {
  // No agents at all
  if (!bestMatch || !bestMatch.agent) return true;

  // Best match has less than 40% of required skills AND task requires 2+ skills
  if (task.inferredSkills.length >= 2 && bestMatch.matchPercentage < 40) return true;

  // Best match is overloaded AND missing 2+ skills
  if (bestMatch.agent.activeTaskCount >= MAX_ACTIVE_TASKS && bestMatch.missingSkills.length >= 2) return true;

  return false;
}

function calculateRoleAffinity(task: TaskRequirement, agent: AgentCapability): number {
  const roleHierarchy: Record<string, number> = {
    FOUNDER: 5,
    CEO: 4,
    MANAGER: 3,
    AGENT: 1,
  };
  const agentLevel = roleHierarchy[agent.role] || 1;

  const strategicKeywords = ["plan", "strategy", "hire", "budget", "review", "roadmap"];
  const isStrategic = strategicKeywords.some(
    (k) => task.title.toLowerCase().includes(k) || task.description?.toLowerCase().includes(k),
  );

  if (isStrategic && agentLevel >= 3) return 1.0;
  if (isStrategic && agentLevel < 3) return 0.3;
  if (!isStrategic && agentLevel >= 3) return 0.4;
  return 0.8;
}
