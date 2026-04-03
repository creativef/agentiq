import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";

import { db } from "../db/client";
import { users, companies, companyMembers, projects, agents } from "../db/schema";
import { authMiddleware, JWT_SECRET } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { sql } from 'drizzle-orm';

const auth = new Hono();

function getClientIp(c: any): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")
    || c.req.raw.headers.get("cf-connecting-ip")
    || "127.0.0.1";
}

auth.post("/auth/register", async (c) => {
  const ip = getClientIp(c);
  const limit = rateLimitMiddleware(ip);
  if (!limit.allowed) {
    return c.json({ error: `Too many attempts. Try again in ${limit.retryAfter} seconds` }, 429);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const { email, password, companyName } = body;

    // Validate email format
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return c.json({ error: "Valid email is required" }, 400);
    }

    // Validate password strength
    if (!password || typeof password !== "string" || password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }
    if (!/[A-Z]/.test(password)) {
      return c.json({ error: "Password must contain an uppercase letter" }, 400);
    }
    if (!/[a-z]/.test(password)) {
      return c.json({ error: "Password must contain a lowercase letter" }, 400);
    }
    if (!/[0-9]/.test(password)) {
      return c.json({ error: "Password must contain a number" }, 400);
    }

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

    const token = await sign({ userId, email, role: "OWNER", exp: Math.floor(Date.now() / 1000) + 86400 * 30 }, JWT_SECRET);

    setCookie(c, "token", token, { httpOnly: true, sameSite: "Strict", path: "/" });

    return c.json({ user: { id: userId, email }, company: companyId });
  } catch (e: any) {
    console.error("Registration error:", e);
    return c.json({ error: e.message || "Registration failed" }, 500);
  }
});

auth.post("/auth/login", async (c) => {
  const ip = getClientIp(c);
  const limit = rateLimitMiddleware(ip);
  if (!limit.allowed) {
    return c.json({ error: `Too many attempts. Try again in ${limit.retryAfter} seconds` }, 429);
  }

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

    const token = await sign({ userId: userRes[0].id, email: userRes[0].email, role: userRes[0].role, exp: Math.floor(Date.now() / 1000) + 86400 * 30 }, JWT_SECRET);
    
    setCookie(c, "token", token, { httpOnly: true, sameSite: "Strict", path: "/" });

    return c.json({ user: { id: userRes[0].id, email: userRes[0].email }, company: companyId });
  } catch (e: any) {
    console.error("Login error:", e);
    return c.json({ error: e.message }, 500);
  }
});

auth.post("/auth/logout", async (c) => {
    deleteCookie(c, "token", { path: "/" });
    return c.json({ ok: true });
});

auth.use(authMiddleware);

auth.get("/auth/me", async (c) => {
  const user = c.get("user");
  return c.json({ user });
});

export default auth;
