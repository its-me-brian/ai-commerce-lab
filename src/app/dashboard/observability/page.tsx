"use client";

import { useEffect, useState } from "react";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

interface AppEvent {
  id: string;
  event_type: string;
  severity: string;
  source: string | null;
  agent_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  debug: { bg: "var(--bg-sunken)", text: "var(--text-tertiary)" },
  info: { bg: "var(--accent-bg)", text: "var(--accent)" },
  warning: { bg: "var(--warning-bg, #fef3c7)", text: "var(--warning, #d97706)" },
  error: { bg: "var(--error-bg)", text: "var(--error)" },
  critical: { bg: "var(--error-bg)", text: "var(--error)" },
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  "agent.run": "▶",
  "agent.config_change": "⚙",
  "agent.error": "✗",
  "provider.test": "⚡",
  "system.startup": "●",
  "approval.requested": "⏳",
  "approval.resolved": "✓",
  "handoff.created": "→",
  "handoff.completed": "✓",
};

export default function ObservabilityPage() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const pageSize = 25;

  useEffect(() => {
    fetchEvents();
  }, [filterType, filterSeverity, page]);

  async function fetchEvents() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterSeverity) params.set("severity", filterSeverity);
      params.set("limit", pageSize.toString());
      params.set("offset", (page * pageSize).toString());

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
        setTotal(data.total || 0);
      } else {
        setError(data.error || "Failed to load events");
      }
    } catch (err) {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Extract unique event types for filter
  const eventTypes = [...new Set(events.map(e => e.event_type))].sort();
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Observability</h1>
        <p>Event log across all agents and system components</p>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          onRetry={fetchEvents}
          className="mb-6"
        />
      )}

      {/* Summary cards */}
      <div className="stats-grid" style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {(["info", "warning", "error", "critical"] as const).map((sev) => {
          const count = events.filter(e => e.severity === sev).length;
          const colors = SEVERITY_COLORS[sev];
          return (
            <div key={sev} style={{
              padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}>
              <p style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                {sev}
              </p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: colors.text }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Execution History Chart — Agent Activity */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: 16, marginBottom: 20,
      }}>
        <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 12 }}>Agent Activity (from events)</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
          {(() => {
            const agentCounts: Record<string, number> = {};
            for (const event of events) {
              const agent = event.agent_id || "system";
              agentCounts[agent] = (agentCounts[agent] || 0) + 1;
            }
            const agents = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
            const maxCount = Math.max(...agents.map(([, c]) => c), 1);
            return agents.map(([agent, count]) => (
              <div key={agent} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: `${(count / maxCount) * 60}px`,
                  background: agent === "system" ? "var(--text-tertiary)" : "var(--accent)",
                  borderRadius: "3px 3px 0 0",
                  minHeight: 2,
                }} />
                <p style={{ fontSize: "0.5625rem", color: "var(--text-tertiary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {agent.length > 10 ? agent.slice(0, 10) + "…" : agent}
                </p>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 14,
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 14,
      }}>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
          style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)" }}
        >
          <option value="">All types</option>
          {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => { setFilterSeverity(e.target.value); setPage(0); }}
          style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)" }}
        >
          <option value="">All severities</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", alignSelf: "center" }}>
          {total} events
        </span>
      </div>

      {/* Event list */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>No events found</p>
          </div>
        ) : (
          <div>
            {events.map((event) => {
              const colors = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.info;
              const icon = EVENT_TYPE_ICONS[event.event_type] || "•";
              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    background: selectedEvent?.id === event.id ? "var(--accent-light)" : "transparent",
                  }}
                >
                  <span style={{ fontSize: "0.875rem", width: 20, textAlign: "center" }}>{icon}</span>
                  <span style={{
                    fontSize: "0.5625rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                    background: colors.bg, color: colors.text, textTransform: "uppercase",
                    minWidth: 50, textAlign: "center",
                  }}>{event.severity}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {event.message}
                    </p>
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      {event.event_type}
                      {event.source && ` · ${event.source}`}
                      {event.agent_id && ` · ${event.agent_id}`}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 14px", borderTop: "1px solid var(--border-subtle)",
          }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: "4px 10px", fontSize: "0.75rem",
                background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1,
              }}
            >Prev</button>
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: "4px 10px", fontSize: "0.75rem",
                background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1,
              }}
            >Next</button>
          </div>
        )}
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <div style={{
          marginTop: 14, background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: "0.875rem" }}>Event Detail</h2>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: "0.875rem" }}
            >×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 12px", fontSize: "0.75rem" }}>
            <span style={{ color: "var(--text-tertiary)" }}>Type</span>
            <span style={{ fontWeight: 500 }}>{selectedEvent.event_type}</span>
            <span style={{ color: "var(--text-tertiary)" }}>Severity</span>
            <span style={{ fontWeight: 500 }}>{selectedEvent.severity}</span>
            <span style={{ color: "var(--text-tertiary)" }}>Source</span>
            <span style={{ fontWeight: 500 }}>{selectedEvent.source || "—"}</span>
            <span style={{ color: "var(--text-tertiary)" }}>Agent</span>
            <span style={{ fontWeight: 500 }}>{selectedEvent.agent_id || "—"}</span>
            <span style={{ color: "var(--text-tertiary)" }}>Message</span>
            <span style={{ fontWeight: 500 }}>{selectedEvent.message}</span>
            <span style={{ color: "var(--text-tertiary)" }}>Time</span>
            <span style={{ fontWeight: 500 }}>{new Date(selectedEvent.created_at).toLocaleString()}</span>
          </div>
          {Object.keys(selectedEvent.metadata).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 4 }}>Metadata</p>
              <pre className="mono" style={{
                fontSize: "0.6875rem", background: "var(--bg-sunken)", padding: 10,
                borderRadius: "var(--r-md)", overflow: "auto", maxHeight: 200, lineHeight: 1.5,
              }}>
                {JSON.stringify(selectedEvent.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
