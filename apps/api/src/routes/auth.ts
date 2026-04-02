import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";

import { db } from "../db/client";
import { users, companies, companyMembers, projects, agents } from "../db/schema";
import { authMiddleware, JWT_SECRET } from "../middleware/auth";
import { sql } from 'drizzle-orm';

const auth = new Hono();

auth.post("/auth/register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, companyName } = body;

    // Check existing
    const existing = await db.select().from(users).where(sql`email = ${email}`).limit(1);
    if (existing.length > 0) {
      return c.json({ error: "User already exists" }, 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create User
    const newUser = await db.insert(users).values({ email, passwordHash }).returning();
    const userId = newUser[0].id;

    // Create Company (if provided)
    let companyId: string | undefined = undefined;
    if (companyName) {
        const newComp = await db.insert(companies).values({ name: companyName, goal: "Default Goal" }).returning();
        companyId = newComp[0].id;
        
        // Link Member
        await db.insert(companyMembers).values({ companyId, userId, role: "OWNER" });
        
        // Seed Default Project & Agent
        const proj = await db.insert(projects).values({ companyId, name: "General Operations" }).returning();
        const projId = proj[0].id;
        await db.insert(agents).values({ companyId, projectId: projId, name: "Ops Agent", role: "AGENT" }).returning();
    }

    const token = await sign({ userId, email, role: "OWNER", "exp": Math.floor(Date.now() / 1000) + 86400 * 30 }, JWT_SECRET);

    c.cookie("token", token, { httpOnly: true, sameSite: "Strict", path: "/" });

    return c.json({ user: { id: userId, email }, company: companyId });
  } catch (e: any) {
    return c.json({ error: e.message || "Registration failed" }, 500);
  }
});

auth.post("/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    const userRes = await db.select().from(users).where(sql`email = ${email}`).limit(1);
    if (userRes.length === 0) return c.json({ error: "Invalid credentials" }, 401);

    const valid = await bcrypt.compare(password, userRes[0].passwordHash);
    if (!valid) return c.json({ error: "Invalid credentials" }, 401);

    // Get first company as default active context
    const memberRes = await db.select().from(companyMembers).where(sql`user_id = ${userRes[0].id}`).limit(1);
    const companyId = memberRes[0]?.companyId;

    const token = await sign({ userId: userRes[0].id, email: userRes[0].email, role: userRes[0].role, "exp": Math.floor(Date.now() / 1000) + 86400 * 30 }, JWT_SECRET);
    
    c.cookie("token", token, { httpOnly: true, sameSite: "Strict", path: "/" });

    return c.json({ user: { id: userRes[0].id, email: userRes[0].email }, company: companyId });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

auth.post("/auth/logout", async (c) => {
    c.cookie("token", "", { expires: new Date(0) });
    return c.json({ ok: true });
});

auth.use(authMiddleware);

auth.get("/auth/me", async (c) => {
  const user = c.get("user");
  return c.json({ user });
});

export default auth;
