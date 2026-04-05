// ============================================================
// CEO LLM DECISION ENGINE
// Replaces rule-based keyword matching with actual LLM reasoning.
// Uses the company's active LLM provider to make delegation decisions.
// Supports: OpenAI, Anthropic, self-hosted OpenAI-compatible, Ollama/local
// ============================================================

import { createLLMProvider, type LLMProviderConfig, type LLMMessage } from "../llm/provider";
import type { CEOContext, CEOAction, ActionTypeName } from "./types";

// ---------- System Prompt ----------
const CEO_SYSTEM_PROMPT = `You are the CEO of an autonomous company. Your sole purpose is to organize the team and get work done.

DECISION TYPES YOU CAN MAKE:
1. "assign_task" — Assign a pending task to an existing agent
2. "create_agent" — Create a new agent when no suitable one exists
3. "escalate" — Escalate a persistently blocked task to founders
4. "retry" — Retry a failed task with a different approach

RESPONSE FORMAT (JSON array only, no markdown, no explanation text):
[
  { "action": "assign_task", "taskId": "...", "agentId": "...", "reason": "..." },
  { "action": "create_agent", "role": "CTO", "skills": ["code-review","architecture"], "reason": "..." },
  { "action": "escalate", "taskId": "...", "reason": "..." },
  { "action": "retry", "taskId": "...", "reason": "..." }
]

RULES:
- Only assign tasks to agents that exist and are not overloaded
- If all agents are busy or lack skills, suggest creating a new agent
- Escalate tasks that have failed 3+ times
- Be specific about which agent to use
- Return ONLY the JSON array, nothing else`;

// ---------- Build LLM Context ----------
function buildLLMPrompt(context: CEOContext): LLMMessage[] {
  const { company, agents, pendingTasks, blockedTasks, brief } = context;

  const teamSummary = agents.map((a) => 
    `- ${a.name} (${a.role}): Skills: [${a.skills.join(", ") || "none"}] | Active: ${a.activeTaskCount} | Failed: ${a.failedTaskCount}`
  ).join("\n");

  const pendingSummary = pendingTasks.map((t) => 
    `- [${t.taskId}] "${t.title}": Needs [${t.inferredSkills.join(", ") || "general"}] | Priority: ${t.priority}`
  ).join("\n") || "None";

  const blockedSummary = blockedTasks.map((t) => 
    `- [${t.taskId}] "${t.title}": Failed ${t.retryCount}x | Error: ${t.lastError || "unknown"}`
  ).join("\n") || "None";

  const briefText = brief 
    ? `Vision: ${brief.vision}\nConstraints: ${brief.constraints || "None"}\nPriorities: ${brief.priorities || "None"}`
    : "No formal brief. Company goal: " + (company.goal || "undefined");

  const systemContent = [
    CEO_SYSTEM_PROMPT,
    "",
    `=== COMPANY: ${company.name} ===`,
    `BRIEF:`,
    briefText,
    "",
    `TEAM:`,
    teamSummary,
    "",
    `PENDING TASKS (need assignment):`,
    pendingSummary,
    "",
    `BLOCKED TASKS (need retry/escalate):`,
    blockedSummary,
  ].join("\n");

  return [
    { role: "system", content: systemContent },
    { 
      role: "user", 
      content: "Review the current state and decide what actions to take. Return ONLY a JSON array." 
    },
  ];
}

// ---------- Parse LLM Response ----------
function parseLLMDecision(rawContent: string): Array<Record<string, any>> {
  let cleaned = rawContent.trim();
  
  // Strip markdown code blocks
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) cleaned = jsonMatch[1].trim();

  // Find JSON array boundaries
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart === -1 || arrEnd === -1 || arrEnd <= arrStart) {
    console.warn("[CEO-LLM] No JSON array found:", cleaned.slice(0, 200));
    return [];
  }

  try {
    const decisions = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
    return Array.isArray(decisions) ? decisions : [];
  } catch (e) {
    console.warn("[CEO-LLM] JSON parse failed:", cleaned.slice(0, 200));
    return [];
  }
}

// ---------- Map LLM Response to CEOAction ----------
function mapToAction(decision: Record<string, any>): CEOAction | null {
  const action = decision.action?.toLowerCase() || "";
  const reason = decision.reason || "LLM decision";
  
  if (action === "assign_task" && decision.taskId && decision.agentId) {
    return {
      type: "assign_task" as ActionTypeName,
      payload: { taskId: decision.taskId, agentId: decision.agentId },
      reason,
      confidence: "high",
    };
  }
  
  if (action === "create_agent" && decision.role) {
    return {
      type: "create_agent" as ActionTypeName,
      payload: { role: decision.role, skills: decision.skills || [] },
      reason,
      confidence: "medium",
    };
  }
  
  if (action === "escalate" && decision.taskId) {
    return {
      type: "escalate_to_founders" as ActionTypeName,
      payload: { taskId: decision.taskId },
      reason,
      confidence: "high",
    };
  }
  
  if (action === "retry" && decision.taskId) {
    return {
      type: "retry_task" as ActionTypeName,
      payload: { taskId: decision.taskId },
      reason,
      confidence: "medium",
    };
  }

  return null;
}

// ---------- Main Decision Engine ----------
export async function makeLLMDecisions(
  context: CEOContext,
  llmConfig: LLMProviderConfig | null,
): Promise<CEOAction[]> {
  if (!llmConfig) {
    return []; // No LLM — orchestrator will use rule-based fallback
  }

  const start = Date.now();
  
  try {
    const provider = createLLMProvider(llmConfig);
    const messages = buildLLMPrompt(context);
    const response = await provider.chat(messages);
    const latency = Date.now() - start;
    const tokens = response.usage?.totalTokens || 0;

    console.log(`[CEO-LLM ${llmConfig.provider}/${llmConfig.model}] Decision in ${latency}ms (${tokens} tokens)`);
    console.log(`[CEO-LLM] Response: ${response.content.slice(0, 300)}`);

    const decisions = parseLLMDecision(response.content);
    const actions: CEOAction[] = [];

    for (const d of decisions) {
      const action = mapToAction(d);
      if (action) actions.push(action);
    }

    return actions;
  } catch (e: any) {
    console.error("[CEO-LLM] Engine error:", e.message);
    return []; // Empty = orchestrator falls back to rules
  }
}
