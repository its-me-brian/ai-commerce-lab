"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DayBucket } from "@/types/dashboard";

// ─── Color palette (matches CSS vars) ──────────────────────────────
const COLORS = {
  completed: "var(--success)",
  failed: "var(--error)",
  running: "var(--accent)",
};

// ─── Custom Tooltip ────────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
    >
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span style={{ color: "var(--text-tertiary)" }}>{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────
interface TasksByDayChartProps {
  data: DayBucket[];
  height?: number;
}

export const TasksByDayChart = React.memo(function TasksByDayChart({
  data,
  height = 260,
}: TasksByDayChartProps) {
  const hasData = useMemo(() => data.some((d) => d.completed + d.failed + d.running > 0), [data]);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          No task data for the last 7 days
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-sunken)", opacity: 0.5 }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: "var(--text-tertiary)" }}
        />
        <Bar
          dataKey="completed"
          name="Completed"
          stackId="tasks"
          fill={COLORS.completed}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="failed"
          name="Failed"
          stackId="tasks"
          fill={COLORS.failed}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="running"
          name="Running"
          stackId="tasks"
          fill={COLORS.running}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
});
