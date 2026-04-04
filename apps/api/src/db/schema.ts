import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  goal: text("goal").notNull().default("Build something great"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companyMembers = pgTable("company_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("MEMBER"),
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
  role: text("role").notNull().default("AGENT"),
  status: text("status").notNull().default("idle"),
  lastHeartbeat: timestamp("last_heartbeat"),
  costMonthly: integer("cost_monthly").default(0),
  budgetLimit: integer("budget_limit"),
  heartbeatInterval: integer("heartbeat_interval").default(3600),
  platform: text("platform"),
  externalId: text("external_id"),
  reportsTo: uuid("reports_to").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  agentId: uuid("agent_id").references(() => agents.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo -> in_progress -> done
  priority: text("priority").default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
  dueDate: timestamp("due_date"),
  // Execution Engine Fields
  execStatus: text("exec_status").default("idle"), // idle -> scheduled -> pending_approval -> executing -> completed -> failed
  scheduledAt: timestamp("scheduled_at"),
  approverRole: text("approver_role"), // e.g., "FOUNDER", "CEO"
  approvalStatus: text("approval_status"), // null -> pending -> approved -> rejected
  result: text("result"), // Agent's output/report
  assignedBy: text("assigned_by"), // User ID of creator
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  projectId: uuid("project_id").references(() => projects.id),
  type: text("type").notNull(),
  actor: text("actor"),
  description: text("description"),
  meta: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const connectors = pgTable("connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  platform: text("platform").notNull(),
  config: text("config"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  parentId: uuid("parent_id").references(() => goals.id),
  title: text("title").notNull(),
  progress: integer("progress").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  projectId: uuid("project_id").references(() => projects.id),
  agentId: uuid("agent_id").references(() => agents.id),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  allDay: boolean("all_day").default(false),
  type: text("type").default("meeting"), // meeting, reminder, deadline
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
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  skillId: uuid("skill_id").notNull().references(() => skills.id),
  customInstructions: text("custom_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentLogs = pgTable("agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  taskId: uuid("task_id").references(() => tasks.id),
  level: text("level").default("info"), // info, action, success, error
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  agentId: uuid("agent_id").references(() => agents.id),
  userId: uuid("user_id").references(() => users.id),
  content: text("content").notNull(),
  role: text("role").notNull().default("user"), // 'user', 'agent', 'system'
  createdAt: timestamp("created_at").defaultNow(),
});
