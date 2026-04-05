import { Hono } from "hono";
import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { db } from "../db/client";
import { files, companyMembers } from "../db/schema";
import { authMiddleware, UserPayload } from "../middleware/auth";

// Storage root: /app/storage/files
const STORAGE_ROOT = path.join(process.cwd(), "storage", "files");

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

export const filesRouter = new Hono();
filesRouter.use(authMiddleware);

// GET /files — list files for user's companies
filesRouter.get("/files", async (c) => {
  const user: UserPayload = c.get("user");
  const companyId = c.req.query("companyId") || null;

  let query = db
    .select({
      id: files.id,
      companyId: files.companyId,
      fileName: files.fileName,
      fileType: files.fileType,
      fileSize: files.fileSize,
      createdAt: files.createdAt,
    })
    .from(files)
    .leftJoin(companyMembers, sql`${files.companyId} = ${companyMembers.companyId}`)
    .where(sql`${companyMembers.userId} = ${user.userId}`)
    .orderBy(files.createdAt);

  if (companyId) {
    const result = await query;
    return c.json({ files: result.filter(f => f.companyId === companyId) });
  }

  const result = await query;
  return c.json({ files: result });
});

// POST /files — upload a file (multipart)
filesRouter.post("/files", async (c) => {
  const user: UserPayload = c.get("user");
  const formData = await c.req.formData().catch(() => null);
  
  if (!formData) return c.json({ error: "Invalid multipart form data" }, 400);
  
  const file = formData.get("file");
  if (!file || typeof file === "string") return c.json({ error: "No file provided" }, 400);

  const companyId = formData.get("companyId");
  if (!companyId) return c.json({ error: "companyId required" }, 400);

  const access = await db.select()
    .from(companyMembers)
    .where(sql`${companyMembers.companyId} = ${companyId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);
  if (access.length === 0) return c.json({ error: "Unauthorized" }, 403);

  // Cast file to File-like object (Deno/Hono style)
  const fileData = file as File;
  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Security: 50MB file size limit
  const MAX_SIZE = 50 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    return c.json({ error: "File too large (max 50MB)" }, 413);
  }

  const fileName = fileData.name;
  const fileType = fileData.type || "application/octet-stream";
  const fileSize = buffer.length;

  // Generate unique filename to avoid collisions
  const extension = path.extname(fileName);
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizedName}`;
  const filePath = path.join(STORAGE_ROOT, uniqueFileName);

  // Write to disk
  fs.writeFileSync(filePath, buffer);

  // Save metadata
  const fileRecord = await db.insert(files).values({
    companyId: String(companyId),
    fileName: sanitizedName,
    fileType,
    fileSize,
    filePath: uniqueFileName, // Store relative path
  }).returning();

  return c.json({ file: fileRecord[0] });
});

// GET /files/:fileId/download — download a file
filesRouter.get("/files/:fileId/download", async (c) => {
  const fileId = c.req.param("fileId");
  const user: UserPayload = c.get("user");

  const fileCheck = await db
    .select()
    .from(files)
    .leftJoin(companyMembers, sql`${files.companyId} = ${companyMembers.companyId}`)
    .where(sql`${files.id} = ${fileId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);

  if (fileCheck.length === 0) return c.json({ error: "Not found" }, 404);

  const storedPath = path.join(STORAGE_ROOT, fileCheck[0].files.filePath);

  if (!fs.existsSync(storedPath)) {
    return c.json({ error: "File deleted from disk" }, 404);
  }

  return c.body(await fs.promises.readFile(storedPath), 200, {
    "Content-Type": fileCheck[0].files.fileType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${fileCheck[0].files.fileName}"`,
  });
});

// DELETE /files/:fileId
filesRouter.delete("/files/:fileId", async (c) => {
  const fileId = c.req.param("fileId");
  const user: UserPayload = c.get("user");

  const fileCheck = await db
    .select({ filePath: files.filePath, companyId: files.companyId })
    .from(files)
    .leftJoin(companyMembers, sql`${files.companyId} = ${companyMembers.companyId}`)
    .where(sql`${files.id} = ${fileId} AND ${companyMembers.userId} = ${user.userId}`)
    .limit(1);

  if (fileCheck.length === 0) return c.json({ error: "Not found" }, 404);

  // Delete from disk
  const storedPath = path.join(STORAGE_ROOT, fileCheck[0].filePath);
  if (fs.existsSync(storedPath)) {
    fs.unlinkSync(storedPath);
  }

  // Delete metadata
  await db.delete(files).where(sql`${files.id} = ${fileId}`);
  return c.json({ ok: true });
});
