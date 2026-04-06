import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { tasks, projects, agents, companyMembers } from "../src/db/schema";

async function ensureProject(companyId: string): Promise<string> {
  const existing = await db.select({ id: projects.id })
    .from(projects)
    .where(sql`${projects.companyId} = ${companyId}`)
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const created = await db.insert(projects)
    .values({ companyId, name: "General Operations" })
    .returning({ id: projects.id });
  return created[0].id;
}

async function main() {
  // Find tasks whose projectId does not exist
  const badTasks = await db
    .select({ id: tasks.id, projectId: tasks.projectId, agentId: tasks.agentId })
    .from(tasks)
    .leftJoin(projects, sql`${tasks.projectId} = ${projects.id}`)
    .where(sql`${projects.id} IS NULL`);

  if (badTasks.length === 0) {
    console.log("No invalid task.projectId rows found.");
    return;
  }

  let fixed = 0;
  for (const t of badTasks) {
    let companyId: string | undefined;

    if (t.agentId) {
      const agentRow = await db.select({ companyId: agents.companyId })
        .from(agents)
        .where(sql`${agents.id} = ${t.agentId}`)
        .limit(1);
      if (agentRow.length > 0) companyId = agentRow[0].companyId;
    }

    if (!companyId) {
      console.warn(`Skipping task ${t.id} (unable to determine companyId — no agentId)`);
      continue;
    }

    const projectId = await ensureProject(companyId);
    await db.update(tasks).set({ projectId }).where(sql`${tasks.id} = ${t.id}`);
    fixed++;
  }

  console.log(`Repaired ${fixed} task(s).`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});
