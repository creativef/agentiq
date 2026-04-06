import { eq, and, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db/client";
import { companies, llmProviders } from "../db/schema";
import { buildCEOContext } from "./context-builder";
import { monitorTasks } from "./task-monitor";
import { routeTasks } from "./task-router";
import { assessTeam } from "./team-assessor";
import { generateReport } from "./report-generator";
import { executeAction } from "./action-executor";
import { makeLLMDecisions } from "./llm-decider";
import { runTaskExecution } from "../utils/task-runner";
import { tasks, projects, agents, agentSkills, skills as skillsTable } from "../db/schema";
import type { CEOAction } from "./types";
import type { LLMProviderConfig } from "../llm/provider";

// ---------- config ----------
interface Config {
  intervalMs: number;
  reportHours: number;
  tickCount: number;
  lastReport: Map<string, number>;
  loopId: NodeJS.Timeout | null;
}

class CEOOrchestrator {
  private cfg: Config;

  constructor(cfg?: Partial<Config>) {
    this.cfg = {
      intervalMs: 30_000,
      reportHours: cfg?.reportHours || 24,
      tickCount: 0,
      lastReport: new Map(),
      loopId: null,
    };
  }

  start() {
    if (this.cfg.loopId) return;
    // Run immediately once, then schedule
    this.tickAll();
    this.cfg.loopId = setInterval(() => this.tickAll(), this.cfg.intervalMs);
    console.log(`[CEO] Orchestrator started (every ${this.cfg.intervalMs / 1000}s)`);
  }

  stop() {
    if (this.cfg.loopId) clearInterval(this.cfg.loopId);
    this.cfg.loopId = null;
    console.log("[CEO] Orchestrator stopped.");
  }

  async tickAll() {
    try {
      const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies);
      for (const company of allCompanies) {
        await this.tickCompany(company.id, company.name);
      }
    } catch (e: any) {
      console.error("[CEO] Critical tick error:", e.message);
    }
  }

  async tickCompany(companyId: string, name: string) {
    try {
      // 1. Build context
      const ctx = await buildCEOContext(companyId);
      
      // 2. Resolve active LLM
      const llmRow = await db.select().from(llmProviders)
        .where(and(eq(llmProviders.companyId, companyId), eq(llmProviders.isActive, true)))
        .limit(1);
      const llmConfig: LLMProviderConfig | null = llmRow.length > 0
        ? {
            provider: llmRow[0].provider as any,
            model: llmRow[0].model,
            apiKey: llmRow[0].apiKey || undefined,
            maxTokens: llmRow[0].maxTokens || 4000,
            temperature: llmRow[0].temperature || 0.3,
            baseUrl: llmRow[0].baseUrl || undefined,
          }
        : null;

      const actions: CEOAction[] = [];

      // 3. LLM Decision Engine
      if (llmConfig) {
        const llmActions = await makeLLMDecisions(ctx, llmConfig);
        actions.push(...llmActions);
      }

      // 4. Rule-based Triage (Monitor & Route)
      actions.push(...await monitorTasks(ctx));
      actions.push(...await routeTasks(ctx));

      // 5. Team Assessment
      if (this.cfg.tickCount % 20 === 0) {
        actions.push(...await assessTeam(ctx));
      }

      // 6. Founder Report
      const now = Date.now();
      const last = this.cfg.lastReport.get(companyId) || 0;
      const hrs = (now - last) / 3_600_000;
      if (hrs >= this.cfg.reportHours) {
        actions.push(await generateReport(ctx));
        this.cfg.lastReport.set(companyId, now);
      }

      // 7. Execute Actions
      this.cfg.tickCount++;
      let ok = 0, fail = 0;
      for (const a of actions) {
        const r = await executeAction(a, ctx);
        if (r.success) ok++; else { fail++; console.error(`[CEO ${name}] FAIL ${a.type}: ${r.detail}`); }
      }
      if (actions.length > 0) console.log(`[CEO ${name}] ${ok} ok, ${fail} fail (${actions.length} actions)`);

      // 8. CEO SELF-EXECUTION DISABLED (Hermes handles execution)
      // await this.executeCEOInbox(companyId, name, ctx);

    } catch (e: any) {
      console.error(`[CEO ${name}] tick error:`, e.message);
    }
  }

  /**
   * CEO Inbox: The CEO looks for tasks assigned to itself and executes them directly.
   * FIXED: Now handles cases where tasks don't have a specific project assigned.
   */
  async executeCEOInbox(companyId: string, name: string, ctx: any) {
    const ceoAgent = ctx.agents.find((a: any) => a.role === 'CEO');
    if (!ceoAgent) {
      console.warn(`[CEO ${name}] No CEO agent found in context.`);
      return;
    }

    console.log(`[CEO ${name}] Checking inbox for agent ID: ${ceoAgent.id}...`);

    // Find CEO's ready tasks
    // NOTE: We search for tasks where projectId IS NULL OR matches a project in this company
    const ceoReadyTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        scratchpad: tasks.scratchpad,
        projectId: tasks.projectId
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(tasks.agentId, ceoAgent.id),
        inArray(tasks.status, ['ready', 'in_progress']),
        eq(tasks.execStatus, 'ready'),
        or(
          isNull(projects.companyId), // Covers tasks with null projectId
          eq(projects.companyId, companyId)
        )
      ))
      .limit(3); // Max 3 tasks per tick

    if (ceoReadyTasks.length === 0) {
      console.log(`[CEO ${name}] Inbox is empty.`);
      return;
    }

    console.log(`[CEO ${name}] Found ${ceoReadyTasks.length} task(s) to self-execute:`, ceoReadyTasks.map(t => t.title));

    for (const t of ceoReadyTasks) {
      try {
        // Fetch skills for the CEO
        const skillRows = await db
          .select({
            name: skillsTable.name,
            category: skillsTable.category,
            instructions: skillsTable.instructions
          })
          .from(agentSkills)
          .innerJoin(skillsTable, eq(agentSkills.skillId, skillsTable.id))
          .where(eq(agentSkills.agentId, ceoAgent.id));

        // Mark as executing
        await db.update(tasks)
          .set({ execStatus: "executing" })
          .where(eq(tasks.id, t.id));

        console.log(`[CEO ${name}] Executing task: "${t.title}"...`);

        // Ensure a valid projectId
        let resolvedProjectId = t.projectId || null;
        if (!resolvedProjectId) {
          const proj = await db.select({ id: projects.id })
            .from(projects)
            .where(eq(projects.companyId, companyId))
            .limit(1);
          if (proj.length > 0) {
            resolvedProjectId = proj[0].id;
          } else {
            const created = await db.insert(projects)
              .values({ companyId, name: "General Operations" })
              .returning({ id: projects.id });
            resolvedProjectId = created[0].id;
          }
          await db.update(tasks).set({ projectId: resolvedProjectId }).where(eq(tasks.id, t.id));
        }

        // Run the execution engine
        const result = await runTaskExecution({
          taskId: t.id,
          taskTitle: t.title,
          taskDescription: t.description || "",
          assignedAgent: { id: ceoAgent.id, name: ceoAgent.name, role: ceoAgent.role },
          companyId,
          projectId: resolvedProjectId,
          agentSkills: skillRows,
          scratchpad: t.scratchpad,
        });

        // Update task result
        await db.update(tasks).set({
          execStatus: result.success ? "completed" : "failed",
          status: result.success ? "done" : "blocked",
          result: (result.report || "No output").substring(0, 2000),
        }).where(eq(tasks.id, t.id));

        if (result.success) {
          console.log(`[CEO-EXEC] ✅ Done: "${t.title}"`);
        } else {
          console.error(`[CEO-EXEC] ❌ Failed: "${t.title}"`);
        }

      } catch (e: any) {
        console.error(`[CEO-EXEC] Failed: "${t.title}"`, e.message);
        await db.update(tasks)
          .set({ execStatus: "failed", status: "blocked", result: e.message })
          .where(eq(tasks.id, t.id));
      }
    }
  }
}

// Singleton
let orch: CEOOrchestrator | null = null;

export function startCEOOrchestrator(cfg?: Partial<Config>) {
  if (orch) return orch;
  orch = new CEOOrchestrator(cfg);
  orch.start();
  return orch;
}

export function stopCEOOrchestrator() {
  if (orch) { orch.stop(); orch = null; }
}
