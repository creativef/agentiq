// ============================================================
// CEO Orchestrator — Main Entry Point
// Autonomous decision loop: LLM reasoning + rule-based fallback
// ============================================================

import { db } from "../db/client";
import { companies, llmProviders } from "../db/schema";
import { sql } from "drizzle-orm";
import { buildCEOContext } from "./context-builder";
import { monitorTasks } from "./task-monitor";
import { routeTasks } from "./task-router";
import { assessTeam } from "./team-assessor";
import { generateReport } from "./report-generator";
import { executeAction } from "./action-executor";
import { makeLLMDecisions } from "./llm-decider";
import type { CEOAction } from "./types";
import type { LLMProviderConfig } from "../llm/provider";

// ---------- config ----------
interface Config {
  tickMs: number;           // main loop interval (default 30 000)
  reportHours: number;      // founder-report interval  (default 24)
  enabled: boolean;
}

const DEFAULTS: Config = { tickMs: 30_000, reportHours: 24, enabled: true };

// ---------- singleton ----------
let orch: CEOOrchestrator | null = null;

class CEOOrchestrator {
  private cfg: Config;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastReport = new Map<string, number>();
  private tickCount = 0;

  constructor(partial?: Partial<Config>) {
    this.cfg = { ...DEFAULTS, ...partial };
  }

  // ----- start / stop -----
  start() {
    if (!this.cfg.enabled) {
      console.log("[CEO] orchestrator disabled");
      return;
    }
    console.log("[CEO] orchestrator starting");
    this.timer = setInterval(() => this.tickAll(), this.cfg.tickMs);
    // fire the first tick immediately
    this.tickAll();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    console.log("[CEO] orchestrator stopped");
  }

  // ----- main loop -----
  private async tickAll() {
    try {
      const rows = await db.select({ id: companies.id, name: companies.name }).from(companies);
      for (const row of rows) await this.tickOne(row.id, row.name);
    } catch (e: any) {
      console.error("[CEO] tickAll error:", e);
    }
  }

  private async tickOne(companyId: string, name: string) {
    try {
      // 0 – build context and fetch LLM config
      const ctx = await buildCEOContext(companyId);
      
      // Get active LLM provider for this company
      const llmRow = await db
        .select({
          id: llmProviders.id,
          provider: llmProviders.provider,
          model: llmProviders.model,
          baseUrl: llmProviders.baseUrl,
          apiKey: llmProviders.apiKey,
          maxTokens: llmProviders.maxTokens,
          temperature: llmProviders.temperature,
        })
        .from(llmProviders)
        .where(sql`${llmProviders.companyId} = ${companyId} AND ${llmProviders.isActive} = true`)
        .limit(1);

      const llmConfig: import("../llm/provider").LLMProviderConfig | null = llmRow.length > 0
        ? {
            id: llmRow[0].id,
            provider: llmRow[0].provider as any,
            model: llmRow[0].model,
            baseUrl: llmRow[0].baseUrl || undefined,
            apiKey: llmRow[0].apiKey || undefined,
            maxTokens: llmRow[0].maxTokens || 4000,
            temperature: llmRow[0].temperature || 0.3,
          }
        : null;

      const actions: CEOAction[] = [];

      // 1 – LLM decision engine (if configured)
      if (llmConfig) {
        const llmActions = await makeLLMDecisions(ctx, llmConfig);
        actions.push(...llmActions);
        if (llmActions.length > 0) {
          console.log(`[CEO ${name} LLM] ${llmActions.length} decisions`);
        }
      }

      // 2 – rule-based triage (always runs, handles what LLM missed)
      actions.push(...await monitorTasks(ctx));

      // 3 – rule-based routing (fallback for unassigned tasks)
      actions.push(...await routeTasks(ctx));

      // 4 – team assessment every 20 ticks
      if (this.tickCount % 20 === 0) {
        actions.push(...await assessTeam(ctx));
      }

      // 5 – founder report on schedule
      const now = Date.now();
      const last = this.lastReport.get(companyId) || 0;
      const hrs = (now - last) / 3_600_000;
      if (hrs >= this.cfg.reportHours) {
        actions.push(await generateReport(ctx));
        this.lastReport.set(companyId, now);
      }

      // 6 – execute ALL CEO actions IN PARALLEL (up to 5 at once)
      this.tickCount++;
      let ok = 0, fail = 0;
      
      // Split actions into batches of 5 for safe parallel execution
      const BATCH_SIZE = 5;
      for (let i = 0; i < actions.length; i += BATCH_SIZE) {
        const batch = actions.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(a => executeAction(a, ctx).then(r => ({ action: a, result: r })))
        );
        
        for (const settled of results) {
          if (settled.status === 'fulfilled' && settled.value.result.success) {
            ok++;
            console.log(`[CEO Tool OK] ${settled.value.action.type}: ${settled.value.result.detail}`);
          } else {
            fail++;
            const detail = settled.status === 'rejected' ? settled.reason : settled.value.result.detail;
            console.error(`[CEO FAIL] ${settled.status === 'rejected' ? 'error' : detail}`);
          }
        }
      }

      // Auto-execute tasks that are ready (if CEO assigned them this tick)
      const newlyAssigned = actions.filter(a => a.type === 'assign_task' || (a.type === 'ceo_tool' && a.payload.tool === 'create_task'));
      if (newlyAssigned.length > 0) {
        console.log(`[CEO ${name}] Assigned ${newlyAssigned.length} new task(s) — next tick will auto-execute`);
      }

      if (actions.length > 0) console.log(`[CEO ${name}] ${ok} ok, ${fail} fail (${actions.length} actions)`);

    } catch (e: any) {
      console.error(`[CEO ${name}] tick error:`, e);
    }
  }
}

export function startCEOOrchestrator(cfg?: Partial<Config>) {
  if (orch) { console.log("[CEO] already running"); return orch; }
  orch = new CEOOrchestrator(cfg);
  orch.start();
  return orch;
}

export function stopCEOOrchestrator() { if (orch) { orch.stop(); orch = null; } }
