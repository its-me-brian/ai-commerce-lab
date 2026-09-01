"use client";

import React, { useState, useCallback } from "react";
import { MessageList } from "./MessageList";
import type { ChatMessage } from "./MessageBubble";
import { ChatComposer } from "./ChatComposer";
import type { AgentRecord } from "../agents/AgentCard";

interface ChatContainerProps {
  agents: AgentRecord[];
  selectedAgentId?: string;
  sessionId?: string;
  onSendMessage?: (message: string, agentId: string) => Promise<string>;
}

export function ChatContainer({
  agents,
  selectedAgentId: propAgentId,
  sessionId,
  onSendMessage,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    propAgentId || agents.find((a) => a.enabled !== false)?.id || null,
  );
  const [loading, setLoading] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedAgentId) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        if (onSendMessage) {
          const response = await onSendMessage(content, selectedAgentId);
          const agent = agents.find((a) => a.id === selectedAgentId);
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: response,
            agentName: agent?.name,
            agentId: selectedAgentId,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "Backend not connected yet.",
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "system",
          content: "Failed to send message. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [onSendMessage, selectedAgentId, agents],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          {/* Agent avatar */}
          {selectedAgent && (
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              {selectedAgent.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {selectedAgent?.name || "Select Agent"}
            </h2>
            <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
              {selectedAgent?.role || "Choose from sidebar"}
            </p>
          </div>
          {/* Online indicator */}
          {selectedAgent?.enabled && (
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--success)" }} />
          )}
        </div>
      </div>

      {/* Messages */}
      <MessageList messages={messages} loading={loading} />

      {/* Composer */}
      <ChatComposer
        onSend={handleSend}
        disabled={loading || !selectedAgentId}
        placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : "Select an agent first..."}
      />
    </div>
  );
}
