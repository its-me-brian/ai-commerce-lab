export default function TestCenterLoading() {
  return (
    <div className="page-padding" style={{ maxWidth: 900 }} role="status" aria-label="Loading test center">
      {/* Header skeleton */}
      <div className="mb-7">
        <div className="skeleton" style={{ height: 26, width: 160, marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 14, width: 280 }} />
      </div>

      {/* 2-column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Agent selector + Input */}
        <div className="flex flex-col gap-4">
          {/* Agent selector */}
          <div
            className="rounded-[var(--r-lg)] border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
          >
            <div className="skeleton" style={{ height: 16, width: 100, marginBottom: 12 }} />
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 48, width: "100%", borderRadius: "var(--r-md)" }}
                />
              ))}
            </div>
          </div>

          {/* Input */}
          <div
            className="rounded-[var(--r-lg)] border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
          >
            <div className="skeleton" style={{ height: 16, width: 120, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 180, width: "100%", borderRadius: "var(--r-md)" }} />
            <div className="flex gap-2 mt-3">
              <div className="skeleton" style={{ height: 34, width: 100, borderRadius: "var(--r-md)" }} />
              <div className="skeleton" style={{ height: 34, width: 80, borderRadius: "var(--r-md)" }} />
            </div>
          </div>
        </div>

        {/* Right: Results + History */}
        <div className="flex flex-col gap-4">
          {/* Results */}
          <div
            className="rounded-[var(--r-lg)] border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
          >
            <div className="skeleton" style={{ height: 16, width: 80, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 200, width: "100%", borderRadius: "var(--r-md)" }} />
          </div>

          {/* History */}
          <div
            className="rounded-[var(--r-lg)] border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", padding: 20 }}
          >
            <div className="skeleton" style={{ height: 16, width: 100, marginBottom: 12 }} />
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 40, width: "100%", borderRadius: "var(--r-md)" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
