// Permission Types
// Defines what agents can and cannot do.

export type PermissionAction =
  | "execute"
  | "read_data"
  | "write_data"
  | "call_tool"
  | "use_provider"
  | "access_agent";

export interface Permission {
  id: string;
  agentId: string;
  action: PermissionAction;
  target: string; // tool ID, provider slug, agent ID, or "*" for all
  granted: boolean;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: "max_tokens" | "max_cost" | "time_window" | "rate_limit";
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
  ],
  agent: [
    { id: "*", agentId: "*", action: "execute", target: "*", granted: true },
    { id: "*", agentId: "*", action: "read_data", target: "*", granted: true },
    { id: "*", agentId: "*", action: "call_tool", target: "*", granted: true },
    { id: "*", agentId: "*", action: "use_provider", target: "*", granted: true },
  ],
  restricted: [
    { id: "*", agentId: "*", action: "read_data", target: "*", granted: true },
  ],
};
