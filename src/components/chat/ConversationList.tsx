"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

interface Conversation {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
  agents?: { name: string } | null;
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

export function ConversationList({ limit = 10 }: { limit?: number }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch(`/api/conversations?limit=${limit}`);
        const data = await res.json();
        if (data.success) {
          setConversations(data.conversations);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, [limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Recent Conversations" />
        <CardContent>
          <div className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Recent Conversations" />
      <CardContent>
        {conversations.length === 0 ? (
          <EmptyState icon="💬" title="No conversations yet" description="Start chatting with an agent" />
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between p-2 rounded-[var(--r-md)]"
                style={{ background: "var(--bg-sunken)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {conv.agents?.name || conv.agent_id}
                  </span>
                  <Badge variant={conv.status === "active" ? "success" : "outline"}>
                    {conv.status}
                  </Badge>
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {formatDate(conv.created_at)} {formatTime(conv.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
