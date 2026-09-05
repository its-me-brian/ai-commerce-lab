"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { MessageList } from "./MessageList";
import type { ChatMessage } from "./MessageBubble";
import { ChatComposer } from "./ChatComposer";
import type { AgentRecord } from "../agents/AgentCard";

/** Full result from chat API — conversation + both messages with real DB IDs */
export interface ChatResultData {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  content: string;
}

interface ChatContainerProps {
  agents: AgentRecord[];
  selectedAgentId?: string;
  sessionId?: string;
  /** Optional override — if not provided, ChatContainer calls /api/agents/chat directly */
  onSendMessage?: (
    message: string,
    agentId: string,
    conversationId?: string
  ) => Promise<ChatResultData>;
}

export function ChatContainer({
  agents,
  selectedAgentId: propAgentId,
   
  sessionId: _sessionId,
  onSendMessage,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const loadingRef = useRef(false);

  // Derive selectedAgentId from props directly — no separate state needed
  const selectedAgentId = propAgentId || agents.find((a) => a.enabled !== false)?.id || null;

  // Reset conversation when prop agent changes
  const [prevPropAgentId, setPrevPropAgentId] = useState(propAgentId);
  useEffect(() => {
    if (propAgentId !== prevPropAgentId) {
      setPrevPropAgentId(propAgentId); // eslint-disable-line react-hooks/set-state-in-effect
      setConversationId(null);
      setMessages([]);
    }
  }, [propAgentId, prevPropAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // ─── Load messages from Supabase when conversation changes ─────
  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;
    setLoadingHistory(true); // eslint-disable-line react-hooks/set-state-in-effect

    fetch(`/api/conversations/${conversationId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.messages) {
          const mapped: ChatMessage[] = data.messages.map(
            (m: {
              id: string;
              role: string;
              content: string;
              created_at: string;
              metadata?: Record<string, unknown>;
            }) => ({
              id: m.id,
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
              agentName:
                m.role === "assistant"
                  ? selectedAgent?.name
                  : undefined,
              agentId:
                m.role === "assistant"
                  ? selectedAgentId ?? undefined
                  : undefined,
              timestamp: m.created_at,
              card: m.metadata?.card as ChatMessage["card"],
            })
          );
          setMessages(mapped);
        }
      })
      .catch(() => {
        // Silently fail — messages start empty
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, selectedAgent?.name, selectedAgentId]);

  // ─── Load existing direct conversation on mount / agent change ──
  useEffect(() => {
    if (!selectedAgentId) return;
    let cancelled = false;

    async function loadExistingConversation() {
      setLoadingHistory(true);
      try {
        // Find existing direct conversation for this agent
        const res = await fetch(`/api/conversations/direct?agentId=${encodeURIComponent(selectedAgentId!)}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.success && data.conversation) {
          setConversationId(data.conversation.id);
          // Messages will be loaded by the conversationId useEffect
        }
      } catch {
        // No existing conversation — will be created on first message
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadExistingConversation();
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  // ─── Send message ─────────────────────────────────────────────
  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedAgentId || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);

      // Optimistic user message (temporary ID until API responds)
      const tempUserId = `temp-user-${Date.now()}`;
      const userMsg: ChatMessage = {
        id: tempUserId,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        let result: ChatResultData;

        if (onSendMessage) {
          // Use parent-provided handler
          result = await onSendMessage(content, selectedAgentId, conversationId ?? undefined);
        } else {
          // Call API directly
          const res = await fetch("/api/agents/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId: selectedAgentId,
              message: content,
              conversationId: conversationId ?? undefined,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || "Failed to send message");
          }
          result = {
            conversationId: data.conversationId,
            userMessageId: data.userMessage?.id,
            assistantMessageId: data.assistantMessage?.id,
            content: data.assistantMessage?.content || "No response",
          };
        }

        // Update conversation ID (first message creates the conversation)
        if (result.conversationId && !conversationId) {
          setConversationId(result.conversationId);
        }

        // Replace optimistic user message with real DB message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempUserId
              ? { ...m, id: result.userMessageId || tempUserId }
              : m
          )
        );

        // Add assistant message with real DB ID
        const assistantMsg: ChatMessage = {
          id: result.assistantMessageId || `asst-${Date.now()}`,
          role: "assistant",
          content: result.content,
          agentName: selectedAgent?.name,
          agentId: selectedAgentId,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        // Replace optimistic message with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempUserId
              ? {
                  ...m,
                  id: `error-${Date.now()}`,
                  role: "system" as const,
                  content: "Failed to send message. Please try again.",
                }
              : m
          )
        );
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSendMessage, selectedAgentId, agents, conversationId, selectedAgent],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div
        className="px-6 py-4 shrink-0"
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
      <MessageList messages={messages} loading={loading || loadingHistory} />

      {/* Composer */}
      <ChatComposer
        onSend={handleSend}
        disabled={loading || !selectedAgentId}
        placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : "Select an agent first..."}
      />
    </div>
  );
}
