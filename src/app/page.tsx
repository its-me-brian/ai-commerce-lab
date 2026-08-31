export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400, padding: "0 24px" }}>
        {/* Logo */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r-lg)",
            background: "var(--accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <h1 style={{ marginBottom: 6 }}>AI Commerce Lab</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>
          AI-powered ecommerce agent platform
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              background: "var(--accent)",
              color: "white",
              borderRadius: "var(--r-md)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Dashboard
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 2.5l4 3.5-4 3.5" />
            </svg>
          </a>
          <a
            href="/dashboard/agents"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "9px 18px",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Agents
          </a>
        </div>
      </div>
    </div>
  );
}
