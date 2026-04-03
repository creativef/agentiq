import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { skills, agentSkills, agents, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

export const skillsRouter = new Hono();
skillsRouter.use(authMiddleware);

// GET /skills — list all available skill templates
skillsRouter.get("/skills", async (c) => {
  const rows = await db.select().from(skills).orderBy(skills.category, skills.name);
  return c.json({ skills: rows });
});

// GET /agents/:agentId/skills — get skills for a specific agent
skillsRouter.get("/agents/:agentId/skills", async (c) => {
  const agentId = c.req.param("agentId");
  const user: UserPayload = c.get("user");

  const agentCheck = await db.select({ companyId: agents.companyId }).from(agents).where(sql`${agents.id} = ${agentId}`).limit(1);
  if (agentCheck.length === 0) return c.json({ error: "Agent not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${agentCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const result = await db
    .select({
      id: agentSkills.id,
      skillId: agentSkills.skillId,
      name: skills.name,
      category: skills.category,
      description: skills.description,
      instructions: skills.instructions,
      icon: skills.icon,
      customInstructions: agentSkills.customInstructions,
    })
    .from(agentSkills)
    .innerJoin(skills, sql`${agentSkills.skillId} = ${skills.id}`)
    .where(sql`${agentSkills.agentId} = ${agentId}`)
    .orderBy(skills.name);

  return c.json({ skills: result });
});

// POST /agents/:agentId/skills — assign a skill to an agent
skillsRouter.post("/agents/:agentId/skills", async (c) => {
  const agentId = c.req.param("agentId");
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const agentCheck = await db.select({ companyId: agents.companyId }).from(agents).where(sql`${agents.id} = ${agentId}`).limit(1);
  if (agentCheck.length === 0) return c.json({ error: "Agent not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${agentCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // Get the skill from the template library
  const skillCheck = await db.select().from(skills).where(sql`${skills.id} = ${body.skillId}`).limit(1);
  if (skillCheck.length === 0) return c.json({ error: "Skill not found" }, 404);

  // Check if already assigned
  const existing = await db.select().from(agentSkills).where(sql`${agentSkills.agentId} = ${agentId} AND ${agentSkills.skillId} = ${body.skillId}`).limit(1);
  if (existing.length > 0) return c.json({ error: "Skill already assigned" }, 400);

  const result = await db.insert(agentSkills).values({
    agentId,
    skillId: body.skillId,
    customInstructions: body.customInstructions || null,
  }).returning();

  return c.json({ agentSkill: result[0] });
});

// PUT /agents/:agentId/skills/:agentSkillId — update custom instructions
skillsRouter.put("/agents/:agentId/skills/:agentSkillId", async (c) => {
  const { agentId, agentSkillId } = c.req.param();
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const check = await db.select({ companyId: agents.companyId }).from(agentSkills).innerJoin(agents, sql`${agentSkills.agentId} = ${agents.id}`).where(sql`${agentSkills.id} = ${agentSkillId}`).limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${check[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.update(agentSkills).set({
    customInstructions: body.customInstructions || null,
  }).where(sql`${agentSkills.id} = ${agentSkillId}`);

  return c.json({ ok: true });
});

// DELETE /agents/:agentId/skills/:agentSkillId — remove a skill
skillsRouter.delete("/agents/:agentId/skills/:agentSkillId", async (c) => {
  const { agentId, agentSkillId } = c.req.param();
  const user: UserPayload = c.get("user");

  const check = await db.select({ companyId: agents.companyId }).from(agentSkills).innerJoin(agents, sql`${agentSkills.agentId} = ${agents.id}`).where(sql`${agentSkills.id} = ${agentSkillId}`).limit(1);
  if (check.length === 0) return c.json({ error: "Not found" }, 404);

  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${check[0].companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  await db.delete(agentSkills).where(sql`${agentSkills.id} = ${agentSkillId}`);
  return c.json({ ok: true });
});
