"use client";

import { useEffect, useState } from "react";

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  message: string;
  source: string;
  clientId?: string;
  sanitizedInput?: string;
  timestamp: number;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "var(--bg-sunken)", text: "var(--text-tertiary)" },
  medium: { bg: "#fef3c7", text: "#d97706" },
  high: { bg: "var(--error-bg)", text: "var(--error)" },
  critical: { bg: "var(--error-bg)", text: "var(--error)" },
};

const EVENT_ICONS: Record<string, string> = {
  sanitization_applied: "🧹",
  injection_detected: "🛡️",
  rate_limit_hit: "⏱️",
  validation_failed: "✗",
  size_limit_exceeded: "📦",
  unauthorized_access: "🔒",
  suspicious_input: "⚠️",
};

export default function SecurityPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        fetch("/api/ai/security?action=recent&count=100"),
        fetch("/api/ai/security?action=stats"),
      ]);
      const eventsData = await eventsRes.json();
      const statsData = await statsRes.json();
      if (eventsData.success) setEvents(eventsData.events);
      if (statsData.success) setStats(statsData.stats);
    } catch (err) {
      console.error("Failed to load security data:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filterSeverity
    ? events.filter((e) => e.severity === filterSeverity)
    : events;

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Security Audit</h1>
        <p>Security events, injection attempts, and rate limiting</p>
      </div>

      {loading ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>Loading security events...</p>
      ) : (
        <>
          {/* Stats cards */}
          {Object.keys(stats).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
              {Object.entries(stats).map(([type, count]) => (
                <div key={type} style={{
                  padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                }}>
                  <p style={{ fontSize: "0.5625rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    {type.replace(/_/g, " ")}
                  </p>
                  <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{count}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div style={{
            display: "flex", gap: 8, marginBottom: 14,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 14,
          }}>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)" }}
            >
              <option value="">All severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", alignSelf: "center" }}>
              {filtered.length} events
            </span>
          </div>

          {/* Events list */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden",
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>No security events</p>
              </div>
            ) : (
              <div>
                {filtered.map((event) => {
                  const colors = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low;
                  const icon = EVENT_ICONS[event.eventType] || "•";
                  return (
                    <div key={event.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}>
                      <span style={{ fontSize: "0.875rem", width: 24, textAlign: "center" }}>{icon}</span>
                      <span style={{
                        fontSize: "0.5625rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                        background: colors.bg, color: colors.text, textTransform: "uppercase",
                        minWidth: 50, textAlign: "center",
                      }}>
                        {event.severity}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.8125rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {event.message}
                        </p>
                        <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                          {event.source}
                          {event.clientId && ` · ${event.clientId}`}
                        </p>
                      </div>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
