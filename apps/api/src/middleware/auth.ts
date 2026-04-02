import { Context, Next } from "hono";
import { jwt, verify } from "hono/jwt";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.cookie("token");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const payload = await verify(token, JWT_SECRET, "HS256");
    c.set("user", payload);
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
