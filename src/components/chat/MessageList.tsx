"use client";

import React, { useEffect, useRef } from "react";
import { MessageBubble, type ChatMessage } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  loading?: boolean;
}

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Empty state
  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "var(--bg-sunken)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          Start a conversation
        </p>
        <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
          Send a message to begin working with your agent
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-start mb-3">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl" style={{ background: "var(--bg-sunken)", borderBottomLeftRadius: "6px" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)", animationDelay: "-0.3s" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)", animationDelay: "-0.15s" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)" }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
