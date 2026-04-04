File unchanged since last read. The content from the earlier read_file result in this conversation is still current — refer to that instead of re-reading.

// ============================================================
// CEO ORCHESTRATOR — Autonomous Company Operating Layer
// ============================================================

export const companyBriefs = pgTable("company_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  vision: text("vision").notNull(),
  marketContext: text("market_context"),
  constraints: text("constraints"),
  priorities: text("priorities"),
  reportingCadence: text("reporting_cadence").default("daily"),
  createdBy: uuid("created_by").notNull(),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ceoDecisions = pgTable("ceo_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  agentId: uuid("agent_id").references(() => agents.id),
  decision: text("decision").notNull(),
  reasoning: text("reasoning"),
  action: text("action").notNull(),
  targetId: uuid("target_id"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentPerformance = pgTable("agent_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  taskId: uuid("task_id").references(() => tasks.id),
  score: integer("score"),
  outcome: text("outcome"),
  notes: text("notes"),
  flaggedByCeo: boolean("flagged_by_ceo").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
