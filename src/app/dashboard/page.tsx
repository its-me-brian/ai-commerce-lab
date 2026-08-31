export default function DashboardPage() {
  return (
    <div className="page-padding" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Overview</h1>
        <p>Your AI commerce agents at a glance</p>
      </div>

      <div className="kpi-grid" style={{ display: "grid", gap: 14, marginBottom: 28 }}>
        <KpiCard label="Active Agents" value="1" delta="+1" deltaType="positive" sub="of 6 total" />
        <KpiCard label="Tasks Run" value="0" sub="All time" />
        <KpiCard label="Success Rate" value="—" sub="No data yet" />
        <KpiCard label="AI Cost" value="$0.00" sub="Free tier" />
      </div>

      <div className="content-grid" style={{ display: "grid", gap: 14 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2>Activity</h2>
            <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>Last 7 days</span>
          </div>
          <EmptyState
            icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>}
            title="No activity yet"
            description="Run your first agent task and it will appear here."
            action={{ label: "Go to Agents", href: "/dashboard/agents" }}
          />
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 16 }}>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <QuickAction href="/dashboard/agents" label="Run Product Hunter" description="Analyze a new product opportunity" />
            <QuickAction href="/dashboard/models" label="Configure Models" description="Set up AI providers and API keys" />
            <QuickAction href="/dashboard/settings" label="Environment Variables" description="Check API key configuration" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, deltaType, sub }: {
  label: string; value: string; delta?: string; deltaType?: "positive" | "negative"; sub?: string;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "16px 18px" }}>
      <p style={{ fontSize: "0.6875rem", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</span>
        {delta && <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: deltaType === "positive" ? "var(--success)" : "var(--error)" }}>{delta}</span>}
      </div>
      {sub && <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description: string; action?: { label: string; href: string };
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "36px 0", textAlign: "center" }}>
      <div style={{ marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 16, maxWidth: 280 }}>{description}</p>
      {action && (
        <a href={action.href} style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--accent)", textDecoration: "none" }}>
          {action.label} →
        </a>
      )}
    </div>
  );
}

function QuickAction({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <a href={href} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)", textDecoration: "none",
    }}>
      <div style={{ width: 32, height: 32, borderRadius: "var(--r-md)", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
      <div>
        <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
        <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{description}</p>
      </div>
    </a>
  );
}
