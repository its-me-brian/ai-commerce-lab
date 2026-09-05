export default function AgentDetailLoading() {
  return (
    <div className="page-padding max-w-[1200px]" role="status" aria-label="Loading agent details">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="skeleton" style={{ height: 12, width: 80, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 26, width: 200, marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 14, width: 300 }} />
      </div>

      {/* Agent profile card skeleton */}
      <div
        className="rounded-[var(--r-lg)] border mb-4"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="skeleton" style={{ height: 36, width: 36, borderRadius: "50%" }} />
          <div>
            <div className="skeleton" style={{ height: 16, width: 140, marginBottom: 4 }} />
            <div className="skeleton" style={{ height: 12, width: 100 }} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="skeleton" style={{ height: 12, width: "80%" }} />
          <div className="skeleton" style={{ height: 12, width: "60%" }} />
        </div>
        <div className="flex gap-2 mt-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 22, width: 60, borderRadius: 9999 }} />
          ))}
        </div>
      </div>

      {/* 2-column grid skeleton: Config + Test */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Left: Config */}
        <div
          className="rounded-[var(--r-lg)] border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
        >
          <div className="skeleton" style={{ height: 16, width: 120, marginBottom: 16 }} />
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="skeleton" style={{ height: 10, width: 60, marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 34, width: "100%", borderRadius: "var(--r-md)" }} />
              </div>
            ))}
          </div>
          <div className="skeleton mt-4" style={{ height: 34, width: 80, borderRadius: "var(--r-md)" }} />
        </div>

        {/* Right: Test */}
        <div
          className="rounded-[var(--r-lg)] border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
        >
          <div className="skeleton" style={{ height: 16, width: 100, marginBottom: 16 }} />
          <div className="skeleton mb-3" style={{ height: 14, width: 160 }} />
          <div className="skeleton" style={{ height: 120, width: "100%", borderRadius: "var(--r-md)" }} />
          <div className="flex gap-2 mt-3">
            <div className="skeleton" style={{ height: 34, width: 100, borderRadius: "var(--r-md)" }} />
            <div className="skeleton" style={{ height: 34, width: 80, borderRadius: "var(--r-md)" }} />
          </div>
        </div>
      </div>

      {/* Model Routes skeleton */}
      <div
        className="rounded-[var(--r-lg)] border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
      >
        <div className="skeleton" style={{ height: 16, width: 110, marginBottom: 16 }} />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 36, width: "100%", borderRadius: "var(--r-md)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
