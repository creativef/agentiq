// Audit logging middleware
// Logs all mutating operations (POST, PUT, DELETE) with user context
// Stores to audit_log table for compliance and debugging

import type { Context, Next } from "hono";
import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { db } from "../db/client";

// Audit log table definition
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  email: text("email"),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: text("status_code").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  meta: text("meta"),
  createdAt: timestamp("created_at").defaultNow(),
});

export async function auditMiddleware(c: Context, next: Next) {
  const method = c.req.method;

  // Only log mutations (skip GET/HEAD/OPTIONS)
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    await next();
    return;
  }

  const startTime = Date.now();
  await next();

  const statusCode = c.res.status;
  const path = c.req.path;

  // Extract user info from context (set by authMiddleware)
  const user = c.get("user") as { userId?: string; email?: string } | undefined;

  // Extract resource info from path
  const parts = path.split("/").filter(Boolean);
  const resourceType = parts[1] || "unknown";
  const resourceId = parts[2] || null;

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")
    || "127.0.0.1";

  try {
    await db.insert(auditLog).values({
      userId: user?.userId ?? null,
      email: user?.email ?? null,
      method,
      path,
      statusCode: String(statusCode),
      userAgent: c.req.header("user-agent") ?? null,
      ip,
    });
  } catch (e) {
    // Don't let audit logging failures break the response
    console.error("Audit log write failed:", e);
  }
}
