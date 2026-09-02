"use client";

import React from "react";
import { formatTime } from "@/lib/utils/format";

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
      className="mt-2 rounded-lg border-l-3 overflow-hidden"
      style={{ borderLeftColor: style.border, background: style.bg }}
    >
      {card.type === "product" ? (
        <ProductCard data={card.data} />
      ) : card.type === "task" ? (
        <TaskCard data={card.data} />
      ) : card.type === "operation" ? (
        <OperationCard data={card.data} />
      ) : (
        <GenericCard type={card.type} data={card.data} />
      )}
    </div>
  );
}

function ProductCard({ data }: { data: Record<string, unknown> }) {
  const name = String(data.name || data.title || "Product");
  const price = data.price != null ? `$${Number(data.price).toFixed(2)}` : null;
  const score = data.score != null ? Number(data.score) : null;
  const source = String(data.source || data.supplier || "");
  const url = String(data.url || data.product_url || "");

  return (
    <div className="p-2.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
          {name}
        </p>
        {price && (
          <span className="text-[12px] font-bold shrink-0" style={{ color: "var(--success)" }}>
            {price}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {score != null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            Score: {score}
          </span>
        )}
        {source && (
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            via {source}
          </span>
        )}
        {url && url !== "undefined" && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] underline"
            style={{ color: "var(--accent)" }}
          >
            View →
          </a>
        )}
      </div>
    </div>
  );
}

function TaskCard({ data }: { data: Record<string, unknown> }) {
  const taskType = String(data.task_type || data.type || "task");
  const status = String(data.status || "pending");
  const agent = String(data.agent_id || data.agent || "");
  const goal = String(data.goal || data.input || "");

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "var(--bg-sunken)", text: "var(--text-tertiary)" },
    running: { bg: "var(--warning-bg)", text: "var(--warning)" },
    completed: { bg: "var(--success-bg)", text: "var(--success)" },
    failed: { bg: "var(--error-bg)", text: "var(--error)" },
  };
  const sc = statusColors[status] || statusColors.pending;

  return (
    <div className="p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize"
          style={{ background: sc.bg, color: sc.text }}
        >
          {status}
        </span>
        <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>
          {taskType}
        </span>
      </div>
      {agent && (
        <p className="text-[10px] mb-0.5" style={{ color: "var(--text-tertiary)" }}>
          Agent: {agent}
        </p>
      )}
      {goal && (
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {goal.length > 120 ? goal.slice(0, 120) + "…" : goal}
        </p>
      )}
    </div>
  );
}

function OperationCard({ data }: { data: Record<string, unknown> }) {
  const op = String(data.operation || data.type || "operation");
  const status = String(data.status || "in_progress");
  const detail = String(data.detail || data.description || "");

  return (
    <div className="p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>
          {op}
        </span>
        <span className="text-[10px] capitalize" style={{ color: "var(--text-tertiary)" }}>
          {status.replace("_", " ")}
        </span>
      </div>
      {detail && (
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {detail.length > 120 ? detail.slice(0, 120) + "…" : detail}
        </p>
      )}
    </div>
  );
}

function GenericCard({ type, data }: { type: string; data: Record<string, unknown> }) {
  return (
    <div className="p-2.5">
      <p className="text-[11px] font-semibold capitalize mb-1" style={{ color: "var(--text-primary)" }}>
        {type}
      </p>
      <pre
        className="text-[10px] whitespace-pre-wrap leading-relaxed"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
      >
        {JSON.stringify(data, null, 2)}
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
          className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${isUser ? "font-medium" : ""}`}
          style={{
            background: isUser
              ? "var(--accent)"
              : isSystem
                ? "var(--error-bg)"
                : "var(--bg-sunken)",
            color: isUser
              ? "#ffffff"
              : isSystem
                ? "var(--error)"
                : "var(--text-primary)",
            borderBottomRightRadius: isUser ? "6px" : undefined,
            borderBottomLeftRadius: !isUser ? "6px" : undefined,
            boxShadow: isUser ? "0 1px 3px rgba(37, 99, 235, 0.25)" : undefined,
          }}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          <MessageCard card={message.card} />
        </div>

        {/* Timestamp */}
        <p
          className="text-[11px] mt-1.5 px-1"
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
