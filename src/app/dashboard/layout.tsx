"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const nav = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  },
  {
    label: "Agents",
    href: "/dashboard/agents",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/></svg>,
  },
  {
    label: "Catalog",
    href: "/dashboard/catalog",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M2 6.5h12M2 10h8M2 13h5"/></svg>,
  },
  {
    label: "Runs",
    href: "/dashboard/runs",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8h12M8 2v12"/></svg>,
  },
  {
    label: "Models",
    href: "/dashboard/models",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2v12M8 4v8M12 2v12"/></svg>,
  },
  {
    label: "Test Center",
    href: "/dashboard/test-center",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3l6 5-6 5V3z"/></svg>,
  },
  {
    label: "Observability",
    href: "/dashboard/observability",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/></svg>,
  },
  {
    label: "Activity",
    href: "/dashboard/activity",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h2l2-5 2 10 2-5h2"/></svg>,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M13.2 10l1 .6-.8 1.3-1.2-.4c-.5.4-1 .7-1.6.9l-.2 1.2H7.6l-.2-1.2c-.6-.2-1.1-.5-1.6-.9l-1.2.4-.8-1.3 1-.6c0-.3-.1-.6-.1-.9s0-.6.1-.9l-1-.6.8-1.3 1.2.4c.5-.4 1-.7 1.6-.9L7.3 3h1.4l.2 1.2c.6.2 1.1.5 1.6.9l1.2-.4.8 1.3-1 .6c0 .3-.1.6-.1.9s0 .6.1.9z"/></svg>,
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 45,
          }}
        />
      )}

      {/* Sidebar — desktop */}
      <aside className="sidebar-desktop" style={{
        width: "var(--sidebar-w)",
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        position: "fixed",
        top: 0, bottom: 0, left: 0,
        flexDirection: "column",
        zIndex: 40,
      }}>
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside className="sidebar-mobile" style={{
        width: 240,
        background: "var(--bg-card)",
        position: "fixed",
        top: 0, bottom: 0, left: mobileOpen ? 0 : -260,
        flexDirection: "column",
        zIndex: 50,
        transition: "left 200ms ease",
        boxShadow: mobileOpen ? "4px 0 24px rgba(0,0,0,0.1)" : "none",
      }}>
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Main */}
      <div className="main-content" style={{ flex: 1 }}>
        {/* Mobile header */}
        <div className="mobile-header" style={{
          position: "sticky", top: 0, zIndex: 30,
          height: "var(--header-h)",
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
        }}>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              width: 36, height: 36,
              alignItems: "center", justifyContent: "center",
              background: "none", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
              cursor: "pointer", color: "var(--text-primary)",
            }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>
            )}
          </button>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>AI Commerce Lab</span>
        </div>

        {children}
      </div>
    </div>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <>
      <div style={{ height: "var(--header-h)", display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "var(--r-md)", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "-0.02em" }}>AI Commerce Lab</span>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", gap: 1 }}>
        {nav.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: "var(--r-md)",
                fontSize: "0.8125rem", fontWeight: active ? 500 : 400,
                color: active ? "var(--accent)" : "var(--text-secondary)",
                background: active ? "var(--accent-light)" : "transparent",
                textDecoration: "none",
              }}
            >
              <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)" }}>
        <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>v0.1.0</p>
      </div>
    </>
  );
}
