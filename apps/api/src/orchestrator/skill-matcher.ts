// ============================================================
// Skill Matcher — scores agents against task requirements
// ============================================================
import type { AgentCapability, TaskRequirement, AgentMatch } from "./types";

function normalize(list: string[]): string[] {
  return list.map((s) => s.toLowerCase().trim()).filter(Boolean);
}

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

export function matchAgentToTask(task: TaskRequirement, agents: AgentCapability[]): AgentMatch[] {
  const required = normalize(task.inferredSkills || []);

  const matches = agents.map((agent) => {
    const agentSkills = normalize(agent.skills || []);
    const matchingSkills = intersect(required, agentSkills);
    const missingSkills = required.filter((s) => !agentSkills.includes(s));

    const matchPercentage = required.length > 0
      ? Math.round((matchingSkills.length / required.length) * 100)
      : 60; // default if no inferred skills

    const overloaded = agent.activeTaskCount >= 5;
    const capacityScore = Math.max(0, 100 - agent.activeTaskCount * 20);
    const reliabilityScore = Math.max(0, 100 - agent.failedTaskCount * 15);
    const roleAlignment = task.title.toLowerCase().includes(agent.role.toLowerCase()) ? 100 : 60;

    const score =
      matchPercentage * 0.4 +
      capacityScore * 0.25 +
      reliabilityScore * 0.2 +
      roleAlignment * 0.15;

    return {
      agent,
      score,
      matchingSkills,
      missingSkills,
      matchPercentage,
      overloaded,
      hasFailedRecently: agent.failedTaskCount > 0,
    } as AgentMatch;
  });

  return matches.sort((a, b) => b.score - a.score);
}

export function shouldCreateNewAgent(task: TaskRequirement, bestMatch: AgentMatch): boolean {
  if (!bestMatch) return true;
  if (bestMatch.overloaded) return true;
  if (bestMatch.missingSkills.length > 0 && bestMatch.matchPercentage < 60) return true;
  if (bestMatch.matchPercentage < 30) return true;
  return false;
}
