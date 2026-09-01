"use client";

import React from "react";
import { TasksByDayChart } from "./TasksByDayChart";
import { AgentActivityChart } from "./AgentActivityChart";
import type { DayBucket, AgentActivityRow } from "@/types/dashboard";

/**
 * Client-side wrapper for chart components.
 * This boundary exists because Recharts requires `"use client"`.
 */
export function DashboardCharts({
  tasksByDay,
  agentActivity,
}: {
  tasksByDay: DayBucket[];
  agentActivity: AgentActivityRow[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Tasks by Day" subtitle="Last 7 days">
        <TasksByDayChart data={tasksByDay} />
      </ChartCard>
      <ChartCard title="Activity by Agent" subtitle="Top agents by task count">
        <AgentActivityChart data={agentActivity} />
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--r-lg)] p-5"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
