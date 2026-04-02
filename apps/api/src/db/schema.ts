import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("OWNER"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  goal: text("goal").notNull().default("Building something amazing"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companyMembers = pgTable("company_members", {
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  projectId: uuid("project_id").references(() => projects.id),
  name: text("name").notNull(),
  role: text("role"),
  status: text("status").default("idle"),
  heartbeatInterval: integer("heartbeat_interval"),
  lastHeartbeat: timestamp("last_heartbeat"),
  costMonthly: integer("cost_monthly").default(0),
  budgetLimit: integer("budget_limit"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  agentId: uuid("agent_id").references(() => agents.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("backlog"),
  priority: text("priority").default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id),
  projectId: uuid("project_id").references(() => projects.id),
  agentId: uuid("agent_id").references(() => agents.id),
  type: text("type").notNull(),
  payload: text("payload"), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  title: text("title").notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),
  progress: integer("progress").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
