export default function DashboardLoading() {
  return (
    <div className="page-padding max-w-[1200px]" role="status" aria-label="Loading dashboard">
      {/* Header skeleton */}
      <div className="mb-7">
        <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 16, width: 280 }} />
      </div>

      {/* KPI Grid skeleton — 6 cards, 3 cols on lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-[var(--r-lg)] border px-4 py-3.5"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div className="skeleton" style={{ height: 10, width: 70, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 22, width: 40, marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 10, width: 60 }} />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div
        className="skeleton mb-5"
        style={{ height: 200, borderRadius: "var(--r-lg)" }}
      />

      {/* Agent Health + Recent Activity skeleton — 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[var(--r-lg)] border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
          >
            <div className="skeleton" style={{ height: 14, width: 100, marginBottom: 16 }} />
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((j) => (
                <div key={j}>
                  <div className="skeleton" style={{ height: 10, width: "100%", marginBottom: 4 }} />
                  <div className="skeleton" style={{ height: 4, width: "60%" }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Event Log + Quick Actions skeleton — 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[var(--r-lg)] border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
          >
            <div className="skeleton" style={{ height: 14, width: 110, marginBottom: 16 }} />
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="skeleton" style={{ height: 32, borderRadius: "var(--r-md)" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
