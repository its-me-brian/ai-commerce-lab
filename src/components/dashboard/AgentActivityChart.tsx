"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { AgentActivityRow } from "@/types/dashboard";

// ─── Color palette ─────────────────────────────────────────────────
const COLORS = {
  completed: "var(--success)",
  failed: "var(--error)",
};

// ─── Custom Tooltip ────────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: AgentActivityRow;
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
  const row = payload[0]?.payload;
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
      {row && (
        <div className="space-y-0.5" style={{ color: "var(--text-tertiary)" }}>
          <p>
            Completed: <span className="font-medium" style={{ color: "var(--success)" }}>{row.completed}</span>
          </p>
          <p>
            Failed: <span className="font-medium" style={{ color: "var(--error)" }}>{row.failed}</span>
          </p>
          <p>
            Total: <span className="font-medium">{row.total}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────
interface AgentActivityChartProps {
  data: AgentActivityRow[];
  height?: number;
}

export const AgentActivityChart = React.memo(function AgentActivityChart({
  data,
  height = 260,
}: AgentActivityChartProps) {
  // Truncate long agent IDs for display
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        agentName: d.agentName.length > 14 ? d.agentName.slice(0, 12) + "…" : d.agentName,
      })),
    [data],
  );

  if (!data.length) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          No agent activity data
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 0, bottom: 0 }}
        barSize={14}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="agentName"
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-sunken)", opacity: 0.5 }} />
        <Bar dataKey="completed" name="Completed" fill={COLORS.completed} stackId="agent" radius={[0, 0, 0, 0]} />
        <Bar dataKey="failed" name="Failed" fill={COLORS.failed} stackId="agent" radius={[0, 3, 3, 0]}>
          <LabelList
            dataKey="total"
            position="right"
            style={{ fontSize: 10, fill: "var(--text-tertiary)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
