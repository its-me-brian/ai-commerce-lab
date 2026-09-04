import { z } from "zod";

// ============================================
// Common reusable fields
// ============================================

export const workspaceIdSchema = z.string().min(1, "workspaceId is required");
export const agentIdSchema = z.string().min(1, "agentId is required");
export const taskIdSchema = z.string().min(1, "taskId is required");

// ============================================
// API Input Schemas
// ============================================

/**
 * POST /api/events
 */
export const createEventSchema = z.object({
  eventType: z.string().min(1, "eventType is required"),
  severity: z.enum(["info", "warning", "error", "critical"]).default("info"),
  source: z.string().min(1, "source is required"),
  message: z.string().min(1, "message is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/conversations/[id]/messages
 */
export const sendMessageSchema = z.object({
  content: z.string().min(1, "message content is required").max(10000),
  role: z.enum(["user", "assistant"]).default("user"),
});

/**
 * PATCH /api/approvals/[id]
 */
export const reviewApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().max(5000).optional(),
});

/**
 * POST /api/user/change-password
 */
export const changePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  userId: z.string().optional(),
});

/**
 * PATCH /api/ai/providers
 */
export const updateProviderSchema = z.object({
  slug: z.string().min(1),
  enabled: z.boolean().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

/**
 * PATCH /api/ai/models
 */
export const updateModelSchema = z.object({
  id: z.string().min(1, "model id is required"),
  enabled: z.boolean().optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * POST /api/agents/[agentId]/model-routes
 */
export const createModelRouteSchema = z.object({
  modelId: z.string().min(1, "modelId is required"),
  priority: z.number().int().min(0).max(100).default(50),
  enabled: z.boolean().default(true),
  conditions: z
    .object({
      maxTokens: z.number().positive().optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      taskTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Generic query params with pagination
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Agent query params
 */
export const agentQuerySchema = z.object({
  agentId: z.string().min(1, "agentId query param is required"),
});

// ============================================
// Validation helper
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: z.ZodError };

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    details: result.error,
  };
}
