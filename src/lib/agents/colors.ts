// Agent Colors
// Shared color constants for agent avatars and UI elements.
// Consolidates AGENT_COLORS from CompanyRoom.tsx and workspace/page.tsx.

export interface AgentColor {
  bg: string;
  text: string;
  border: string;
}

export const AGENT_COLORS: Record<string, AgentColor> = {
  ceo: { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
  producthunter: { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
  "product-hunter": { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
  marketresearch: { bg: "#fce7f3", text: "#9d174d", border: "#ec4899" },
  "market-research": { bg: "#fce7f3", text: "#9d174d", border: "#ec4899" },
  supplierresearch: { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
  "supplier-research": { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
  opportunitiescoring: { bg: "#ede9fe", text: "#5b21b6", border: "#8b5cf6" },
  "opportunity-scoring": { bg: "#ede9fe", text: "#5b21b6", border: "#8b5cf6" },
  storebuilder: { bg: "#ccfbf1", text: "#0f766e", border: "#14b8a6" },
  "store-builder": { bg: "#ccfbf1", text: "#0f766e", border: "#14b8a6" },
  marketing: { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
  secretary: { bg: "#f3f4f6", text: "#374151", border: "#6b7280" },
  finance: { bg: "#ecfdf5", text: "#065f46", border: "#22c55e" },
};

const DEFAULT_COLOR: AgentColor = { bg: "#f3f4f6", text: "#374151", border: "#6b7280" };

/**
 * Get agent color by ID.
 * Returns the full color object with bg, text, and border.
 */
export function getAgentColor(agentId: string): AgentColor {
  return AGENT_COLORS[agentId.toLowerCase()] || DEFAULT_COLOR;
}

/**
 * Get agent color as a single hex string (for simple use cases).
 */
export function getAgentHexColor(agentId: string): string {
  return getAgentColor(agentId).border;
}
