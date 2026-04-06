import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { skills, agentSkills, agents, companyMembers, skillBundles, bundleSkills, agentBundles } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";
import { parseSkillsMarkdown } from "../utils/skillParser";

export const skillsRouter = new Hono();
skillsRouter.use(authMiddleware);

// GET /skills — list all available skill templates
skillsRouter.get("/skills", async (c) => {
  const rows = await db.select().from(skills).orderBy(skills.category, skills.name);
  return c.json({ skills: rows });
});

// POST /skills — create a new skill template
skillsRouter.post("/skills", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.name || !body.category || !body.instructions) {
    return c.json({ error: "name, category, and instructions are required" }, 400);
  }

  const existing = await db.select().from(skills).where(sql`${skills.name} = ${body.name}`).limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Skill already exists" }, 400);
  }

  const created = await db.insert(skills).values({
    name: body.name,
    category: body.category,
    description: body.description || null,
    instructions: body.instructions,
    icon: body.icon || null,
  }).returning();

  return c.json({ skill: created[0] });
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

// POST /skills/import — parse a skills.md file and bulk-import skills
skillsRouter.post("/skills/import", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  
  if (!body.content || typeof body.content !== "string") {
    return c.json({ error: "Missing 'content' field (raw markdown string)" }, 400);
  }

  const parsed = parseSkillsMarkdown(body.content);
  
  if (parsed.length === 0) {
    return c.json({ error: "No skills found. Use ## SkillName headings with metadata.", created: [] }, 400);
  }

  const created: any[] = [];
  const skipped: string[] = [];

  for (const skill of parsed) {
    // Check if skill with same name already exists
    const existing = await db.select().from(skills).where(sql`${skills.name} = ${skill.name}`).limit(1);
    if (existing.length > 0) {
      skipped.push(skill.name);
      continue;
    }

    const result = await db.insert(skills).values({
      name: skill.name,
      category: skill.category,
      description: skill.description || null,
      instructions: skill.instructions,
      icon: skill.icon || null,
    }).returning();
    created.push(result[0]);
  }

  return c.json({
    parsed: parsed.length,
    created: created.map(s => ({ id: s.id, name: s.name, category: s.category })),
    skipped,
  });
});

// POST /companies/:companyId/skills/import — import and assign all skills to company agents
skillsRouter.post("/companies/:companyId/skills/import", async (c) => {
  const companyId = c.req.param("companyId");
  const user: UserPayload = c.get("user");
  
  const access = await db.select().from(companyMembers).where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`).limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  const body = await c.req.json().catch(() => ({}));
  
  if (!body.content || typeof body.content !== "string") {
    return c.json({ error: "Missing 'content' field" }, 400);
  }

  const parsed = parseSkillsMarkdown(body.content);
  
  // Create skills not yet in DB
  const skillIdMap = new Map<string, string>(); // name → id
  for (const skill of parsed) {
    const existing = await db.select().from(skills).where(sql`${skills.name} = ${skill.name}`).limit(1);
    if (existing.length > 0) {
      skillIdMap.set(skill.name, existing[0].id);
    } else {
      const result = await db.insert(skills).values({
        name: skill.name,
        category: skill.category,
        description: skill.description || null,
        instructions: skill.instructions,
        icon: skill.icon || null,
      }).returning();
      skillIdMap.set(skill.name, result[0].id);
    }
  }

  // Assign ALL parsed skills to ALL agents in this company
  const companyAgents = await db.select({ id: agents.id }).from(agents).where(sql`${agents.companyId} = ${companyId}`);
  let assigned = 0;
  for (const agent of companyAgents) {
    for (const [name, skillId] of skillIdMap) {
      const exists = await db.select().from(agentSkills).where(sql`${agentSkills.agentId} = ${agent.id} AND ${agentSkills.skillId} = ${skillId}`).limit(1);
      if (exists.length === 0) {
        await db.insert(agentSkills).values({ agentId: agent.id, skillId });
        assigned++;
      }
    }
  }

  return c.json({
    skills: parsed.length,
    agents: companyAgents.length,
    assigned,
    skillIds: Object.fromEntries(skillIdMap),
  });
});

// ============================================================
// SKILL BUNDLES — Role-based skill collections
// ============================================================

// GET /skill-bundles — list all available bundles
skillsRouter.get("/skill-bundles", async (c) => {
  const rows = await db
    .select()
    .from(skillBundles)
    .where(sql`${skillBundles.isActive} = true`)
    .orderBy(skillBundles.role, skillBundles.name);

  // Enrich each bundle with its skills
  const enriched = await Promise.all(
    rows.map(async (bundle) => {
      const bSkills = await db
        .select({ skillId: bundleSkills.skillId, name: skills.name, category: skills.category, sortOrder: bundleSkills.sortOrder })
        .from(bundleSkills)
        .innerJoin(skills, sql`${bundleSkills.skillId} = ${skills.id}`)
        .where(sql`${bundleSkills.bundleId} = ${bundle.id}`)
        .orderBy(bundleSkills.sortOrder);

      return { ...bundle, skills: bSkills };
    }),
  );

  return c.json({ bundles: enriched });
});

// GET /skill-bundles/:bundleId/skills — get skills in a specific bundle
skillsRouter.get("/skill-bundles/:bundleId/skills", async (c) => {
  const bundleId = c.req.param("bundleId");

  const bundleCheck = await db.select().from(skillBundles).where(sql`${skillBundles.id} = ${bundleId}`).limit(1);
  if (bundleCheck.length === 0) return c.json({ error: "Bundle not found" }, 404);

  const bSkills = await db
    .select({
      skillId: bundleSkills.skillId,
      name: skills.name,
      category: skills.category,
      description: skills.description,
      instructions: skills.instructions,
      icon: skills.icon,
      sortOrder: bundleSkills.sortOrder,
      isRequired: bundleSkills.isRequired,
    })
    .from(bundleSkills)
    .innerJoin(skills, sql`${bundleSkills.skillId} = ${skills.id}`)
    .where(sql`${bundleSkills.bundleId} = ${bundleId}`)
    .orderBy(bundleSkills.sortOrder);

  return c.json({ bundle: bundleCheck[0], skills: bSkills });
});

// POST /agents/:agentId/bundles/:bundleId — assign a skill bundle to an agent
skillsRouter.post("/agents/:agentId/bundles/:bundleId", async (c) => {
  const { agentId, bundleId } = c.req.param();
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  // Verify agent access
  const agentCheck = await db.select({ companyId: agents.companyId }).from(agents).where(sql`${agents.id} = ${agentId}`).limit(1);
  if (agentCheck.length === 0) return c.json({ error: "Agent not found" }, 404);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${agentCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // Verify bundle exists
  const bundleCheck = await db.select().from(skillBundles).where(sql`${skillBundles.id} = ${bundleId}`).limit(1);
  if (bundleCheck.length === 0) return c.json({ error: "Bundle not found" }, 404);

  // Record the bundle assignment
  try {
    await db.insert(agentBundles).values({
      agentId,
      bundleId,
      assignedBy: user.userId,
      status: "active",
    });
  } catch {
    // Bundle may have been previously assigned — that's OK, continue
  }

  // Look up skills in this bundle
  const bSkills = await db
    .select({ skillId: bundleSkills.skillId, sortOrder: bundleSkills.sortOrder })
    .from(bundleSkills)
    .where(sql`${bundleSkills.bundleId} = ${bundleId}`)
    .orderBy(bundleSkills.sortOrder);

  // Get already-assigned skills to avoid duplicates
  const existing = await db
    .select({ skillId: agentSkills.skillId })
    .from(agentSkills)
    .where(sql`${agentSkills.agentId} = ${agentId}`);
  const existingSkillIds = new Set(existing.map((e) => e.skillId));

  // Add new skills (skip duplicates)
  let assigned = 0;
  let skipped = 0;
  for (const bs of bSkills) {
    if (existingSkillIds.has(bs.skillId)) {
      skipped++;
      continue;
    }
    await db.insert(agentSkills).values({
      agentId,
      skillId: bs.skillId,
      customInstructions: body.customInstructions || null,
    });
    assigned++;
  }

  return c.json({
    bundle: bundleCheck[0].name,
    assigned,
    skipped,
    total: bSkills.length,
  });
});

// DELETE /agents/:agentId/bundles/:bundleId — remove a bundle from an agent
skillsRouter.delete("/agents/:agentId/bundles/:bundleId", async (c) => {
  const { agentId, bundleId } = c.req.param();
  const user: UserPayload = c.get("user");

  // Verify agent access
  const agentCheck = await db.select({ companyId: agents.companyId }).from(agents).where(sql`${agents.id} = ${agentId}`).limit(1);
  if (agentCheck.length === 0) return c.json({ error: "Agent not found" }, 404);

  const access = await db
    .select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${agentCheck[0].companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // Mark bundle as removed
  await db
    .update(agentBundles)
    .set({ status: "removed" })
    .where(sql`${agentBundles.agentId} = ${agentId} AND ${agentBundles.bundleId} = ${bundleId}`);

  // Get the skills that came from this bundle
  const bSkills = await db
    .select({ skillId: bundleSkills.skillId })
    .from(bundleSkills)
    .where(sql`${bundleSkills.bundleId} = ${bundleId}`);

  const bundleSkillIds = bSkills.map((bs) => bs.skillId);

  // Remove skills ONLY if no other active bundle also provides them
  let removed = 0;
  const otherBundles = await db
    .select({ bundleId: agentBundles.bundleId })
    .from(agentBundles)
    .where(sql`${agentBundles.agentId} = ${agentId} AND ${agentBundles.status} = 'active' AND ${agentBundles.bundleId} != ${bundleId}`);

  const otherBundleIds = otherBundles.map((ob) => ob.bundleId);
  const otherProvided = new Set<string>();

  for (const obId of otherBundleIds) {
    const otherSkills = await db
      .select({ skillId: bundleSkills.skillId })
      .from(bundleSkills)
      .where(sql`${bundleSkills.bundleId} = ${obId}`);
    for (const os of otherSkills) otherProvided.add(os.skillId);
  }

  for (const skillId of bundleSkillIds) {
    if (!otherProvided.has(skillId)) {
      await db
        .delete(agentSkills)
        .where(sql`${agentSkills.agentId} = ${agentId} AND ${agentSkills.skillId} = ${skillId}`);
      removed++;
    }
  }

  return c.json({ removed, kept: bundleSkillIds.length - removed });
});

// POST /skill-bundles — create a custom skill bundle
skillsRouter.post("/skill-bundles", async (c) => {
  const user: UserPayload = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  if (!body.name || !body.role || !body.skillIds || !Array.isArray(body.skillIds)) {
    return c.json({ error: "name, role, and skillIds[] are required" }, 400);
  }

  // Create the bundle
  const [bundle] = await db
    .insert(skillBundles)
    .values({
      name: body.name,
      role: body.role,
      description: body.description || null,
      icon: body.icon || "📦",
      companyId: body.companyId || null,
    })
    .returning();

  // Link skills
  for (let i = 0; i < body.skillIds.length; i++) {
    await db.insert(bundleSkills).values({
      bundleId: bundle.id,
      skillId: body.skillIds[i],
      sortOrder: i,
      isRequired: body.requiredIds?.includes(body.skillIds[i]) ?? true,
    });
  }

  return c.json({ bundle: { ...bundle, skillCount: body.skillIds.length } });
});
