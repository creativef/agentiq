  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return c.json({ error: "Company name is required" }, 400);
  }
  if (body.name.length > 200) {
    return c.json({ error: "Company name too long (max 200 chars)" }, 400);
  }

  const name = body.name.trim();
  const goal = (body.goal || body.description) && typeof (body.goal || body.description) === "string"
    ? (body.goal || body.description)
    : "Building something amazing";

  // Support new wizard payload with projects[] and agents[]
  const projectNames: string[] = body.projects?.filter((p: string) => p.trim())
    .map((p: string) => p.trim()) || [];
  const agentDefs: { name: string; role: string }[] = body.agents || [];

  const newComp = await db.insert(companies).values({ name, goal }).returning();
  const companyId = newComp[0].id;

  // Wrap entire company setup in a transaction for data integrity
  await db.transaction(async (tx) => {
    // 1. Add member (Owner)
    await tx.insert(companyMembers).values({ companyId, userId: user.userId, role: "OWNER" });

    // 2. Create projects
    const createdProjectIds: string[] = [];
    if (projectNames.length > 0) {
      for (const projName of projectNames) {
        const proj = await tx.insert(projects).values({ companyId, name: projName }).returning();
        createdProjectIds.push(proj[0].id);
      }
    } else {
      const proj = await tx.insert(projects).values({ companyId, name: "General Operations" }).returning();
      createdProjectIds.push(proj[0].id);
    }

    // 3. Create agents with reporting hierarchy
    const firstProjectId = createdProjectIds[0];
    if (agentDefs && agentDefs.length > 0) {
      const createdAgents = new Map();
      for (const agent of agentDefs) {
        const result = await tx.insert(agents).values({
          companyId,
          projectId: firstProjectId,
          name: agent.name || "Agent",
          role: agent.role || "AGENT",
          status: "idle",
        }).returning();
        createdAgents.set(agent.templateKey || agent.name, result[0]);
      }

      // Second pass: resolve reportsTo and assign skills
      for (const agent of agentDefs) {
        const thisAgent = createdAgents.get(agent.templateKey || agent.name);
        if (!thisAgent) continue;
        // Resolve reporting
        if (agent.reportsToRole) {
          const managerAgent = createdAgents.get(agent.reportsToRole);
          if (managerAgent) {
            await tx.update(agents)
              .set({ reportsTo: managerAgent.id })
              .where(sql`${agents.id} = ${thisAgent.id}`);
          }
        }
      }
    } else {
      // Fallback: create default Founder agent
      await tx.insert(agents).values({
        companyId,
        projectId: firstProjectId,
        name: "Founder",
        role: "FOUNDER",
        status: "idle",
      });
    }
  });

  return c.json({ company: { id: companyId, name, goal, role: "OWNER", projectCount: createdProjectIds.length } });
