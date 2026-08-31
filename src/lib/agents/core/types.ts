// Agent Core Types
// Defines the contract every agent must follow.

import type { AIProviderSlug, AITaskType } from "../../ai/types";

export type AgentStatus = "development" | "ready" | "disabled";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  enabled: boolean;
  version: string;
  capabilities: string[];
}

export interface AgentContext {
  taskId: string;
  taskType: AITaskType;
  input: Record<string, unknown>;
  configuration: AgentConfiguration;
  previousResults?: unknown[];
  tools: string[];
}

export interface AgentConfiguration {
  agentId: string;
  primaryProvider: AIProviderSlug;
  primaryModel: string;
  fallbackProvider?: AIProviderSlug;
  fallbackModel?: string;
  temperature: number;
  maxTokens: number;
  // Model pricing (per million tokens) — from ai_models table
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export interface AgentResult {
  success: boolean;
  output: string;
  structuredData?: unknown;
  reasoningSummary?: string;
  errors: string[];
  metadata: {
    providerUsed: AIProviderSlug;
    modelUsed: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    cached: boolean;
  };
}

export interface TaskRecord {
  id: string;
  agentId: string;
  status: TaskStatus;
  taskType: AITaskType;
  input: Record<string, unknown>;
  output?: AgentResult;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface RunRecord {
  id: string;
  taskId: string;
  agentId: string;
  provider: AIProviderSlug;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "success" | "error";
  error?: string;
  createdAt: Date;
}
