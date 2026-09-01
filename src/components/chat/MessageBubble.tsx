"use client";

import React from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentName?: string;
  agentId?: string;
  timestamp: string;
  card?: {
    type: string;
    data: Record<string, unknown>;
  };
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const CARD_STYLES: Record<string, { border: string; bg: string }> = {
  task: { border: "var(--accent)", bg: "var(--info-bg)" },
  operation: { border: "#8b5cf6", bg: "#f5f3ff" },
  product: { border: "var(--success)", bg: "var(--success-bg)" },
  approval: { border: "var(--warning)", bg: "var(--warning-bg)" },
  evidence: { border: "#14b8a6", bg: "#f0fdfa" },
};

function MessageCard({ card }: { card: ChatMessage["card"] }) {
  if (!card) return null;
  const style = CARD_STYLES[card.type] ?? { border: "var(--border-strong)", bg: "var(--bg-sunken)" };

  return (
    <div
      className="mt-2 p-2.5 rounded-lg border-l-3"
      style={{ borderLeftColor: style.border, background: style.bg }}
    >
      <p className="text-[11px] font-semibold capitalize mb-1" style={{ color: "var(--text-primary)" }}>
        {card.type}
      </p>
      <pre
        className="text-[11px] whitespace-pre-wrap leading-relaxed"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
      >
        {JSON.stringify(card.data, null, 2)}
      </pre>
    </div>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? "order-2" : "order-1"}`}>
        {/* Agent name */}
        {!isUser && !isSystem && message.agentName && (
          <p className="text-[11px] font-medium mb-1 px-1" style={{ color: "var(--text-tertiary)" }}>
            {message.agentName}
          </p>
        )}

        {/* Message bubble */}
        <div
          className="px-3 py-2 rounded-2xl text-[13px] leading-relaxed"
          style={{
            background: isUser
              ? "var(--accent)"
              : isSystem
                ? "var(--error-bg)"
                : "var(--bg-sunken)",
            color: isUser
              ? "var(--text-inverse)"
              : isSystem
                ? "var(--error)"
                : "var(--text-primary)",
            borderBottomRightRadius: isUser ? "6px" : undefined,
            borderBottomLeftRadius: !isUser ? "6px" : undefined,
          }}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          <MessageCard card={message.card} />
        </div>

        {/* Timestamp */}
        <p
          className="text-[10px] mt-1 px-1"
          style={{
            color: "var(--text-tertiary)",
            textAlign: isUser ? "right" : "left",
          }}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
