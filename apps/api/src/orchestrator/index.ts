// ============================================================
// CEO Orchestrator — Main Entry Point
// Replaces the dead startTaskScheduler() with a real autonomous loop.
// ============================================================

import { db } from "../db/client";
import { companies } from "../db/schema";
import { buildCEOContext } from "./context-builder";
import { monitorTasks } from "./task-monitor";
import { routeTasks } from "./task-router";
import { assessTeam } from "./team-assessor";
import { generateReport } from "./report-generator";
import { executeAction } from "./action-executor";
import type { CEOAction } from "./types";

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
      const ctx = await buildCEOContext(companyId);
      const actions: CEOAction[] = [];

      // 1 – triage stalled / errored tasks
      actions.push(...await monitorTasks(ctx));

      // 2 – route pending tasks
      actions.push(...await routeTasks(ctx));

      // 3 – light team assessment every 20 ticks
      if (this.tickCount % 20 === 0) actions.push(...await assessTeam(ctx));

      // 4 – founder report on schedule
      const now = Date.now();
      const last = this.lastReport.get(companyId) || 0;
      const hrs = (now - last) / 3_600_000;
      if (hrs >= this.cfg.reportHours) {
        actions.push(await generateReport(ctx));
        this.lastReport.set(companyId, now);
      }

      // 5 – execute
      this.tickCount++;
      let ok = 0, fail = 0;
      for (const a of actions) {
        const r = await executeAction(a, ctx);
        if (r.success) ok++; else { fail++; console.error(`[CEO ${name}] FAIL ${a.type}: ${r.detail}`); }
      }

      if (actions.length > 0) console.log(`[CEO ${name}] ${ok} ok, ${fail} fail (${actions.length} actions)`);

    } catch (e: any) {
      console.error(`[CEO ${name}] tick error:`, e);
    }
  }

  private tickCount = 0;
}

export function startCEOOrchestrator(cfg?: Partial<Config>) {
  if (orch) { console.log("[CEO] already running"); return orch; }
  orch = new CEOOrchestrator(cfg);
  orch.start();
  return orch;
}

export function stopCEOOrchestrator() { if (orch) { orch.stop(); orch = null; } }
