import { z } from "zod";

// ============================================================
// Auth schemas
// ============================================================

export const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain an uppercase letter").regex(/[a-z]/, "Password must contain a lowercase letter").regex(/[0-9]/, "Password must contain a number"),
  companyName: z.string().min(1, "Company name is required"),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

// ============================================================
// Company schemas
// ============================================================

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  goal: z.string().max(500).optional().default("Building something amazing"),
});

// ============================================================
// Agent schemas
// ============================================================

export const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required").max(200),
  role: z.string().optional().default("AGENT"),
  budgetLimit: z.number().optional().nullable(),
  heartbeatInterval: z.number().int().optional().default(3600),
  platform: z.string().optional(),
  externalId: z.string().optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.string().optional(),
  budgetLimit: z.number().optional().nullable(),
  heartbeatInterval: z.number().int().optional(),
});

// ============================================================
// Task schemas
// ============================================================

export const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(500),
  description: z.string().optional().nullable(),
  status: z.string().optional().default("backlog"),
  priority: z.string().optional().default("medium"),
  agentId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
  priority: z.string().optional(),
  agentId: z.string().uuid().optional().nullable(),
});

// ============================================================
// Connector schemas
// ============================================================

export const createConnectorSchema = z.object({
  companyId: z.string().uuid("Valid companyId is required"),
  platform: z.string().min(1, "Platform is required"),
  webhookSecret: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  apiUrl: z.string().url().optional().nullable(),
  config: z.record(z.unknown()).optional().nullable(),
});

// ============================================================
// Generic validation helper
// ============================================================

export function validateBody(schema: z.ZodSchema, body: unknown): { data: any; error?: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { data: null, error: errors };
  }
  return { data: result.data };
}
