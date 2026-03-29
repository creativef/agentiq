import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  projectId: uuid("project_id"),
  name: text("name").notNull(),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull(),
  agentId: uuid("agent_id"),
  status: text("status"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id"),
  projectId: uuid("project_id"),
  agentId: uuid("agent_id"),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
