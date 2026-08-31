// Permission Types
// Defines what agents can and cannot do.

export type PermissionAction =
  | "execute"
  | "read_data"
  | "write_data"
  | "call_tool"
  | "use_provider"
  | "access_agent"
  | "delegate_to";              // FASE 17: Can delegate tasks to another agent

export interface Permission {
  id: string;
  agentId: string;
  action: PermissionAction;
  target: string; // tool ID, provider slug, agent ID, or "*" for all
  granted: boolean;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: "max_tokens" | "max_cost" | "time_window" | "rate_limit" | "max_depth";
  value: number;
  unit?: string;
}

export interface AgentPermissions {
  agentId: string;
  permissions: Permission[];
  role: "admin" | "agent" | "restricted";
}

// Default permissions for each agent role
export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    { id: "*", agentId: "*", action: "execute", target: "*", granted: true },
    { id: "*", agentId: "*", action: "read_data", target: "*", granted: true },
    { id: "*", agentId: "*", action: "write_data", target: "*", granted: true },
    { id: "*", agentId: "*", action: "call_tool", target: "*", granted: true },
    { id: "*", agentId: "*", action: "use_provider", target: "*", granted: true },
    { id: "*", agentId: "*", action: "access_agent", target: "*", granted: true },
    { id: "*", agentId: "*", action: "delegate_to", target: "*", granted: true },
  ],
  agent: [
    { id: "*", agentId: "*", action: "execute", target: "*", granted: true },
    { id: "*", agentId: "*", action: "read_data", target: "*", granted: true },
    { id: "*", agentId: "*", action: "call_tool", target: "*", granted: true },
    { id: "*", agentId: "*", action: "use_provider", target: "*", granted: true },
    { id: "*", agentId: "*", action: "delegate_to", target: "*", granted: true },
  ],
  restricted: [
    { id: "*", agentId: "*", action: "read_data", target: "*", granted: true },
    // restricted agents cannot delegate
  ],
};

// FASE 17: Delegation rules — who can delegate to whom
export interface DelegationRule {
  id: string;
  fromAgentId: string;          // Agent doing the delegating ("*" = any)
  toAgentId: string;            // Target agent ("*" = any)
  allowed: boolean;
  maxDepth?: number;            // Max delegation chain depth (e.g., A→B→C = depth 2)
  conditions?: PermissionCondition[];
}

// Default delegation rules: CEO can delegate to anyone, departments to specialists
export const DEFAULT_DELEGATION_RULES: DelegationRule[] = [
  // CEO can delegate to any department
  { id: "ceo-to-dept", fromAgentId: "ceo", toAgentId: "*", allowed: true },
  // Departments can delegate to specialists in their department
  { id: "product-hunter-to-specialists", fromAgentId: "product-hunter", toAgentId: "market-research", allowed: true },
  { id: "product-hunter-to-supplier", fromAgentId: "product-hunter", toAgentId: "supplier-research", allowed: true },
  { id: "product-hunter-to-opportunity", fromAgentId: "product-hunter", toAgentId: "opportunity-scoring", allowed: true },
  // Specialists cannot delegate
  { id: "specialists-no-delegate", fromAgentId: "market-research", toAgentId: "*", allowed: false },
  { id: "supplier-no-delegate", fromAgentId: "supplier-research", toAgentId: "*", allowed: false },
  { id: "opportunity-no-delegate", fromAgentId: "opportunity-scoring", toAgentId: "*", allowed: false },
];
