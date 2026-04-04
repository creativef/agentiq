import { pgTable, text, uuid, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";

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

export const connectors = pgTable("connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  platform: text("platform").notNull(),
  webhookSecret: text("webhook_secret"),
  apiKey: text("api_key"),
  apiUrl: text("api_url"),
  enabled: boolean("enabled").default(true),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  projectId: uuid("project_id").references(() => projects.id),
  platform: text("platform"),
  externalId: text("external_id"),
  name: text("name").notNull(),
  role: text("role"),
  status: text("status").default("idle"),
  heartbeatInterval: integer("heartbeat_interval"),
  lastHeartbeat: timestamp("last_heartbeat"),
  costMonthly: integer("cost_monthly").default(0),
  budgetLimit: integer("budget_limit"),
  reportsTo: uuid("reports_to"),
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
  platform: text("platform"),
  type: text("type").notNull(),
  payload: text("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  userEmail: text("user_email"),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: text("status_code").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  message: text("message"),
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

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  title: text("title").notNull(),
  date: text("date").notNull(),
  time: text("time"),
  agenda: text("agenda"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").references(() => users.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Skill definitions — instruction sets that give agents capabilities
export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Which skills each agent has
export const agentSkills = pgTable("agent_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  skillId: uuid("skill_id").notNull(),
  // Override default instructions for this specific agent
  customInstructions: text("custom_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Skill definitions — instruction sets that give agents capabilities
export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Which skills each agent has
export const agentSkills = pgTable("agent_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  skillId: uuid("skill_id").notNull(),
  // Override default instructions for this specific agent
  customInstructions: text("custom_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
});
