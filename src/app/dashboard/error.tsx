"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-padding" style={{ maxWidth: 600, margin: "0 auto", paddingTop: 60 }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", padding: 32, textAlign: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "var(--error-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h1 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Dashboard Error</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 16 }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "8px 18px", background: "var(--accent)", color: "white",
              border: "none", borderRadius: "var(--r-md)", fontSize: "0.8125rem",
              fontWeight: 500, cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            style={{
              padding: "8px 18px", background: "var(--bg-sunken)", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem",
              fontWeight: 500, textDecoration: "none",
            }}
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
