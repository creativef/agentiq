import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  isTemplate: boolean("is_template").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentSkills = pgTable("agent_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  skillId: uuid("skill_id").notNull(),
  customInstructions: text("custom_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
});
