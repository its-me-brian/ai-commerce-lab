import { supabase } from "@/lib/database/supabase";
import { getWorkspaceId } from "@/lib/database/supabase-server";
import { OrgChart } from "@/components/agents/OrgChart";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export const dynamic = "force-dynamic";

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  enabled: boolean;
  agent_type: string | null;
  department: string | null;
  parent_agent_id: string | null;
}

export default async function AgentsPage() {
  const workspaceId = await getWorkspaceId();

  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("name");

  if (agentsError) {
    console.error("[AgentsPage] Failed to load agents:", agentsError.message);
  }

  const { data: configs } = await supabase
    .from("agent_configs")
    .select("agent_id, primary_provider_id, primary_model_id")
    .eq("workspace_id", workspaceId);

  const { data: models } = await supabase
    .from("ai_models")
    .select("id, name");

  const { data: providers } = await supabase
    .from("ai_providers")
    .select("id, name");

  const configMap = new Map((configs || []).map((c) => [c.agent_id, c]));
  const modelMap = new Map((models || []).map((m) => [m.id, m.name]));
  const providerMap = new Map((providers || []).map((p) => [p.id, p.name]));

  const agentList = (agents || []) as AgentRow[];

  // Build hierarchy tree
  const agentMap = new Map(agentList.map((a) => [a.id, a]));
  const roots: AgentRow[] = [];
  const childrenMap = new Map<string, AgentRow[]>();

  for (const agent of agentList) {
    if (agent.parent_agent_id && agentMap.has(agent.parent_agent_id)) {
      const siblings = childrenMap.get(agent.parent_agent_id) || [];
      siblings.push(agent);
      childrenMap.set(agent.parent_agent_id, siblings);
    } else {
      roots.push(agent);
    }
  }

  // Stats
  const totalAgents = agentList.length;
  const enabledAgents = agentList.filter((a) => a.enabled).length;
  const departments = [...new Set(agentList.filter((a) => a.department).map((a) => a.department))];

  return (
    <div className="page-padding" style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ marginBottom: 3 }}>Agents</h1>
          <p>{enabledAgents} active of {totalAgents} total · {departments.length} departments</p>
        </div>
      </div>

      {agentsError && (
        <ErrorMessage
          message="Failed to load agents. Please try refreshing."
          className="mb-4"
        />
      )}

      {/* Org Chart View */}
      <OrgChart
        roots={roots}
        childrenMap={childrenMap}
        configMap={configMap}
        modelMap={modelMap}
      />

      {/* All Agents Grid */}
      <h2 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 12 }}>All Agents</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {agentList.map((a) => {
          const cfg = configMap.get(a.id);
          const modelName = cfg ? modelMap.get(cfg.primary_model_id) || "-" : "-";
          const providerName = cfg ? providerMap.get(cfg.primary_provider_id) || "-" : "-";
          const childCount = childrenMap.get(a.id)?.length || 0;

          return (
            <div key={a.id} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <h3 style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{a.name}</h3>
                    {a.agent_type && (
                      <span style={{
                        fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.04em",
                        padding: "1px 5px", borderRadius: 4,
                        background: "var(--accent-light)", color: "var(--accent)",
                      }}>
                        {a.agent_type.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{a.description || "No description"}</p>
                </div>
                <StatusBadge status={a.status} enabled={a.enabled} />
              </div>

              <div style={{ display: "flex", gap: 12, fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 10 }}>
                <span>{modelName}</span>
                <span>·</span>
                <span>{providerName}</span>
                {a.department && (
                  <>
                    <span>·</span>
                    <span style={{ color: "var(--accent)" }}>{a.department}</span>
                  </>
                )}
                {childCount > 0 && (
                  <>
                    <span>·</span>
                    <span>{childCount} report{childCount !== 1 ? "s" : ""}</span>
                  </>
                )}
              </div>

              <a href={`/dashboard/agents/${a.id}`} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: "0.75rem", color: "var(--accent)", textDecoration: "none",
              }}>
                View details →
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled) return (
    <span style={{ fontSize: "0.625rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999, background: "var(--bg-sunken)", color: "var(--text-tertiary)" }}>
      Disabled
    </span>
  );
  return (
    <span style={{
      fontSize: "0.625rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999,
      background: status === "ready" ? "var(--success-bg, #e6f9e6)" : "var(--bg-sunken)",
      color: status === "ready" ? "var(--success, #0a0)" : "var(--text-tertiary)",
    }}>
      {status === "ready" ? "Ready" : status}
    </span>
  );
}
