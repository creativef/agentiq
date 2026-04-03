import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/utils/jwt/jwt";
import { db } from "../db/client";
import { users } from "../db/schema";
import { sql } from "drizzle-orm";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

if (JWT_SECRET === "dev-secret-change-in-production" && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production. Generate one with: openssl rand -hex 32");
}

export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

export const authMiddleware = async (c: Context, next: Next) => {
  const token = getCookie(c, "token");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const payload = await verify(token, JWT_SECRET, "HS256");
    c.set("user", payload as UserPayload);

    // Guard: verify the user still exists in the database
    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.id} = ${(payload as UserPayload).userId}`)
      .limit(1);
    if (userExists.length === 0) {
      // Cookie exists but user doesn't — stale session, return special code so frontend clears cookie and redirects
      return c.json({ error: "Session expired", code: "USER_MISSING" }, 401);
    }

    await next();
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const user: UserPayload | undefined = c.get("user");
    if (!user || !allowedRoles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
};
