"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", padding: 40,
    }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <p style={{
          fontSize: "3rem", fontWeight: 700, letterSpacing: "-0.04em",
          color: "var(--border-strong, #ccc)", marginBottom: 8,
        }}>404</p>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>Page not found</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary, #666)", marginBottom: 20, lineHeight: 1.5 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block", padding: "8px 20px",
            background: "var(--accent, #3b82f6)", color: "white",
            borderRadius: "var(--r-md, 8px)", fontSize: "0.8125rem",
            fontWeight: 500, textDecoration: "none",
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
