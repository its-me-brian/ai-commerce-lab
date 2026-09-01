"use client";

import React, { useState, useEffect } from "react";

interface WorkspaceLayoutProps {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}

export function WorkspaceLayout({
  sidebar,
  header,
  children,
  rightPanel,
}: WorkspaceLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  // Close mobile sidebar when viewport becomes desktop-sized
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 769px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setMobileOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* ===== MOBILE OVERLAY ===== */}
      {/* Only renders DOM when mobileOpen=true; CSS hides on desktop anyway */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="mobile-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 45,
          }}
        />
      )}

      {/* ===== SIDEBAR — DESKTOP ===== */}
      {/* CSS: .sidebar-desktop { display: flex; } / @media <768px { display: none !important; } */}
      {/* NO inline display — CSS controls visibility */}
      <aside
        className="sidebar-desktop"
        style={{
          width: "var(--sidebar-w)",
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border)",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {sidebar}
      </aside>

      {/* ===== SIDEBAR — MOBILE DRAWER ===== */}
      {/* CSS: .sidebar-mobile { display: none; } / @media <768px { display: flex !important; } */}
      {/* NO inline display — CSS controls visibility */}
      <aside
        className="sidebar-mobile"
        style={{
          width: 240,
          background: "var(--bg-card)",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: mobileOpen ? 0 : -260,
          flexDirection: "column",
          overflowY: "auto",
          zIndex: 50,
          transition: "left 200ms ease",
          boxShadow: mobileOpen ? "4px 0 24px rgba(0,0,0,0.1)" : "none",
        }}
      >
        {sidebar}
      </aside>

      {/* ===== MAIN CONTENT AREA ===== */}
      {/* CSS: .main-content { margin-left: var(--sidebar-w); } / @media <768px { margin-left: 0 !important; } */}
      {/* NO inline display — CSS controls visibility */}
      <div className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile header — hidden on desktop by CSS */}
        <div
          className="mobile-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            height: 56,
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--border)",
            alignItems: "center",
            padding: "0 16px",
            gap: 12,
          }}
        >
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
            )}
          </button>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
            AI Commerce Lab
          </span>
        </div>

        {/* Desktop header */}
        {header && (
          <header
            style={{
              height: 56,
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-card)",
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              flexShrink: 0,
            }}
          >
            {header}
          </header>
        )}

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </main>
      </div>

      {/* ===== RIGHT PANEL — CHAT ===== */}
      {rightPanel && (
        <aside
          className="right-panel"
          style={{
            width: 380,
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-card)",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          {rightPanel}
        </aside>
      )}
    </div>
  );
}
