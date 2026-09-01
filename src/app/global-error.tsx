"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0, padding: 0,
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "var(--bg-page, #fafafa)",
        color: "var(--text-primary, #1a1a1a)",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh",
      }}>
        <div style={{
          maxWidth: 480, padding: 40,
          background: "var(--bg-card, white)",
          border: "1px solid var(--border, #e5e5e5)",
          borderRadius: "var(--r-lg, 12px)",
          textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--error-bg, #fef2f2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error, #ef4444)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary, #666)", marginBottom: 20, lineHeight: 1.5 }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary, #999)", marginBottom: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "8px 20px", background: "var(--accent, #3b82f6)", color: "white",
              border: "none", borderRadius: "var(--r-md, 8px)", fontSize: "0.8125rem",
              fontWeight: 500, cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
