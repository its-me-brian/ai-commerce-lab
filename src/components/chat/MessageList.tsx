"use client";

import React, { useEffect, useRef } from "react";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import { EmptyState } from "@/components/ui/EmptyState";

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
      <EmptyState
        icon="💬"
        title="Start a conversation"
        description="Send a message to begin chatting with your AI agent."
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5" aria-live="polite">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-start mb-3">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl" style={{ background: "var(--bg-sunken)", borderBottomLeftRadius: "6px" }}>
              <span className="sr-only">Loading</span>
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
