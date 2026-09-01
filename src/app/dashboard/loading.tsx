export default function DashboardLoading() {
  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 16, width: 300 }} />
      </div>

      {/* Cards skeleton */}
      <div className="three-col-grid" style={{ display: "grid", gap: 14 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: 20,
          }}>
            <div className="skeleton" style={{ height: 14, width: 80, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 28, width: 60, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: 100 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
