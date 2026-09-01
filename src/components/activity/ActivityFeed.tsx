"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface Event {
  id: string;
  event_type: string;
  severity: string;
  message: string | null;
  agent_id: string | null;
  created_at: string;
}

const SEVERITY_BADGES: Record<string, "info" | "success" | "warning" | "error"> = {
  debug: "info",
  info: "info",
  warning: "warning",
  error: "error",
  critical: "error",
};

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch(`/api/events?limit=${limit}`);
        const data = await res.json();
        if (data.success) {
          setEvents(data.events);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [limit]);

  return (
    <Card>
      <CardHeader title="Recent Activity" />
      <CardContent>
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Loading...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No activity yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Badge variant={SEVERITY_BADGES[event.severity] || "info"}>
                  {event.event_type}
                </Badge>
                <p className="flex-1 text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  {event.message || event.event_type}
                </p>
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  {formatTime(event.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
