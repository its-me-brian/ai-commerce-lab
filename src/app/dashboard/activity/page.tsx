"use client";

import { useEffect, useState } from "react";

interface ActivityEntry {
  id: string;
  event_type: string;
  severity: string;
  source: string | null;
  agent_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface TimelineGroup {
  date: string;
  entries: ActivityEntry[];
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  "agent.run": { icon: "▶", color: "var(--accent)", label: "Agent Run" },
  "agent.config_change": { icon: "⚙", color: "var(--warning, #d97706)", label: "Config Change" },
  "agent.error": { icon: "✗", color: "var(--error)", label: "Agent Error" },
  "provider.test": { icon: "⚡", color: "var(--success)", label: "Provider Test" },
  "system.startup": { icon: "●", color: "var(--accent)", label: "System" },
  "approval.requested": { icon: "⏳", color: "var(--warning, #d97706)", label: "Approval Needed" },
  "approval.resolved": { icon: "✓", color: "var(--success)", label: "Approval Resolved" },
  "handoff.created": { icon: "→", color: "var(--accent)", label: "Handoff" },
  "handoff.completed": { icon: "✓", color: "var(--success)", label: "Handoff Done" },
};

function getConfig(eventType: string) {
  return TYPE_CONFIG[eventType] || { icon: "•", color: "var(--text-tertiary)", label: eventType };
}

function groupByDate(entries: ActivityEntry[]): TimelineGroup[] {
  const groups: Record<string, ActivityEntry[]> = {};
  for (const entry of entries) {
    const date = new Date(entry.created_at).toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(entry);
  }
  return Object.entries(groups).map(([date, entries]) => ({ date, entries }));
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState("");
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchEntries();
  }, [filterAgent]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterAgent) params.set("agentId", filterAgent);

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.events);

        // Extract unique agents for filter
        const agentMap = new Map<string, string>();
        for (const e of data.events) {
          if (e.agent_id && !agentMap.has(e.agent_id)) {
            agentMap.set(e.agent_id, e.agent_id);
          }
        }
        setAgents([...agentMap.entries()].map(([id, name]) => ({ id, name })));
      }
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setLoading(false);
    }
  }

  const groups = groupByDate(entries);

  return (
    <div className="page-padding" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Activity Log</h1>
        <p>Chronological timeline of all platform actions</p>
      </div>

      {/* Filter */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 20,
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 14,
      }}>
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)" }}
        >
          <option value="">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", alignSelf: "center" }}>
          {entries.length} events
        </span>
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>Loading activity...</p>
        </div>
      ) : entries.length === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
          padding: 40, textAlign: "center",
        }}>
          <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>No activity yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {groups.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
              }}>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-secondary)",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {group.date}
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              {/* Entries */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {group.entries.map((entry, idx) => {
                  const config = getConfig(entry.event_type);
                  const time = new Date(entry.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                  });
                  return (
                    <div key={entry.id} style={{
                      display: "flex", gap: 12, position: "relative",
                      paddingBottom: idx < group.entries.length - 1 ? 14 : 0,
                    }}>
                      {/* Timeline line + dot */}
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        width: 24, flexShrink: 0,
                      }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: config.color, flexShrink: 0, zIndex: 1,
                          boxShadow: `0 0 0 3px var(--bg-page)`,
                        }} />
                        {idx < group.entries.length - 1 && (
                          <div style={{
                            width: 1, flex: 1, background: "var(--border)", marginTop: 4,
                          }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{
                        flex: 1, padding: "0 14px 0 0",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: "0.625rem", fontWeight: 600, color: config.color }}>
                            {config.label}
                          </span>
                          {entry.agent_id && (
                            <span style={{
                              fontSize: "0.5625rem", padding: "1px 5px", borderRadius: 4,
                              background: "var(--accent-bg)", color: "var(--accent)",
                            }}>
                              {entry.agent_id}
                            </span>
                          )}
                          <span style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", marginLeft: "auto" }}>
                            {time}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", lineHeight: 1.4 }}>
                          {entry.message}
                        </p>
                        {entry.source && (
                          <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                            from {entry.source}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
