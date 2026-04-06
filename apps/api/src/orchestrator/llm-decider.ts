// ============================================================
// CEO LLM DECISION ENGINE
// Replaces rule-based keyword matching with actual LLM reasoning.
// Uses the company's active LLM provider to make delegation decisions.
// Supports: OpenAI, Anthropic, self-hosted OpenAI-compatible, Ollama/local
// ============================================================

import { createLLMProvider, type LLMProviderConfig, type LLMMessage } from "../llm/provider";
import type { CEOContext, CEOAction, ActionTypeName } from "./types";

// ---------- System Prompt ----------
const CEO_SYSTEM_PROMPT = `You are the CEO of an autonomous company. Your sole purpose is to organize the team, execute strategy, and report to the Founders.

You have TWO types of actions available:

## 1. Task Management (assigning existing tasks to agents)
- "assign_task" — Assign a pending task to an agent
- "retry_task" — Retry a failed task
- "escalate_to_founders" — Escalate a persistently blocked task

## 2. CEO Tools (proactive command actions)
These are your primary tools for driving the company forward.

### TOOL: create_task (type: ceo_tool)
Create a new task for a specific agent. Use this to delegate work.
Action format: { "action": "ceo_tool", "tool": "create_task", "agentId": "uuid", "title": "string", "description": "string", "priority": "low|medium|high|critical", "scratchpad": "optional context" }

### TOOL: update_scratchpad (type: ceo_tool)
Inject shared context into a task or agent's memory. Align agents on strategy.
Action format: { "action": "ceo_tool", "tool": "update_scratchpad", "taskId": "uuid" OR "agentId": "uuid", "content": "string", "append": true }

### TOOL: stop_task (type: ceo_tool)
Cancel a task that is no longer needed or going wrong.
Action format: { "action": "ceo_tool", "tool": "stop_task", "taskId": "uuid", "reason": "string" }

### TOOL: follow_up (type: ceo_tool)
Append new instructions to an in-progress task.
Action format: { "action": "ceo_tool", "tool": "follow_up", "taskId": "uuid", "message": "new instructions" }

### TOOL: report (type: ceo_tool)
Send a status update to the Founders.
Action format: { "action": "ceo_tool", "tool": "report", "companyId": "uuid", "message": "string" }

### TOOL: set_goal (type: ceo_tool)
Create or update a strategic company goal.
Action format: { "action": "ceo_tool", "tool": "set_goal", "title": "string", "description": "string", "priority": "medium" }

---

## CRITICAL RULES:
1. SYNTHESIS FIRST: Before delegating, read all data and decide the STRATEGY. Don't just forward raw info.
2. PARALLELISM IS YOUR SUPERPOWER: Launch multiple tasks at once when they are independent.
3. SCRATCHPADS MATTER: Use scratchpad to inject brief context, constraints, and goals into tasks.
4. STRICT OUTPUT FORMAT: Return ONLY a JSON array. No explanation text, no markdown.
5. EVERY DECISION NEEDS A REASON: Include a "reason" field explaining your strategic thinking.

## RESPONSE FORMAT (JSON array only, no markdown):
[
  { "action": "assign_task", "taskId": "...", "agentId": "...", "reason": "..." },
  { "action": "ceo_tool", "tool": "create_task", "agentId": "...", "title": "...", "description": "...", "reason": "..." },
  { "action": "ceo_tool", "tool": "update_scratchpad", "agentId": "...", "content": "...", "reason": "..." },
  { "action": "ceo_tool", "tool": "report", "message": "...", "reason": "..." }
]`;

// ---------- Build LLM Context ----------
function buildLLMPrompt(context: CEOContext): LLMMessage[] {
  const { company, agents, pendingTasks, blockedTasks, brief } = context;

  const teamSummary = agents.map((a) => 
    `- ${a.name} (${a.role}): Skills: [${a.skills.join(", ") || "none"}] | Active: ${a.activeTaskCount} | Failed: ${a.failedTaskCount}${a.scratchpad ? ` | Scratchpad: ${a.scratchpad}` : ""}`
  ).join("\n");

  const pendingSummary = pendingTasks.map((t) => 
    `- [${(t as any).taskId}] "${t.title}": Needs [${t.inferredSkills.join(", ") || "general"}] | Priority: ${t.priority}${(t as any).scratchpad ? ` | Context: ${(t as any).scratchpad}` : ""}`
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
  const action = decision.action?.toLowerCase() || decision.type?.toLowerCase() || "";
  const reason = decision.reason || "LLM decision";

  // NEW: Handle CEO Tool actions
  if (action === "ceo_tool" && decision.tool) {
    return {
      type: "ceo_tool" as ActionTypeName,
      payload: { tool: decision.tool, ...decision },
      reason,
      confidence: "high",
    };
  }

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
    const tokens = (response.usage as any)?.totalTokens ?? (response.usage as any)?.total_tokens ?? 0;

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
