"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const nav = [
  { label: "Workspace", href: "/workspace", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M2 8h12M2 13h12"/><circle cx="5" cy="3" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><circle cx="7" cy="13" r="1" fill="currentColor"/></svg> },
  { label: "Overview", href: "/dashboard", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg> },
  { label: "Agents", href: "/dashboard/agents", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/></svg> },
  { label: "Catalog", href: "/dashboard/catalog", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M2 6.5h12M2 10h8M2 13h5"/></svg> },
  { label: "Runs", href: "/dashboard/runs", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8h12M8 2v12"/></svg> },
  { label: "Models", href: "/dashboard/models", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2v12M8 4v8M12 2v12"/></svg> },
  { label: "Test Center", href: "/dashboard/test-center", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3l6 5-6 5V3z"/></svg> },
  { label: "Observability", href: "/dashboard/observability", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/></svg> },
  { label: "Evaluation", href: "/dashboard/evaluation", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l3 3 7-7"/></svg> },
  { label: "Budgets", href: "/dashboard/budgets", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4v4l2.5 1.5"/></svg> },
  { label: "Security", href: "/dashboard/security", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z"/></svg> },
  { label: "Activity", href: "/dashboard/activity", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h2l2-5 2 10 2-5h2"/></svg> },
  { label: "Settings", href: "/dashboard/settings", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M13.2 10l1 .6-.8 1.3-1.2-.4c-.5.4-1 .7-1.6.9l-.2 1.2H7.6l-.2-1.2c-.6-.2-1.1-.5-1.6-.9l-1.2.4-.8-1.3 1-.6c0-.3-.1-.6-.1-.9s0-.6.1-.9l-1-.6.8-1.3 1.2.4c.5-.4 1-.7 1.6-.9L7.3 3h1.4l.2 1.2c.6.2 1.1.5 1.6.9l1.2-.4.8 1.3-1 .6c0 .3-.1.6-.1.9s0 .6.1.9z"/></svg> },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/30"
        />
      )}

      {/* Sidebar — desktop */}
      <aside className="sidebar-desktop flex flex-col fixed inset-y-0 left-0 z-40 w-[var(--sidebar-w)] bg-[var(--bg-card)] border-r border-[var(--border-subtle)] overflow-y-auto">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside
        className="sidebar-mobile flex flex-col fixed inset-y-0 left-0 z-50 w-[var(--sidebar-w)] bg-[var(--bg-card)] overflow-y-auto transition-[left] duration-200 ease-in-out"
        style={{
          left: mobileOpen ? 0 : "calc(var(--sidebar-w) * -1)",
          boxShadow: mobileOpen ? "4px 0 24px rgba(0,0,0,0.1)" : "none",
        }}
      >
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Main */}
      <div className="main-content flex-1">
        {/* Mobile header */}
        <div className="mobile-header sticky top-0 z-30 h-[var(--header-h)] bg-[var(--bg-card)] border-b border-[var(--border-subtle)] flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-9 h-9 flex items-center justify-center bg-transparent border border-[var(--border-subtle)] rounded-[var(--r-md)] cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>
            )}
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">AI Commerce Lab</span>
        </div>

        {children}
      </div>
    </div>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <>
      <div className="h-[var(--header-h)] flex items-center px-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-[var(--r-md)] bg-[var(--accent)] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">AI Commerce Lab</span>
        </div>
      </div>

      <nav className="flex-1 p-2 flex flex-col gap-px">
        {nav.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2 px-[10px] py-[7px] rounded-[var(--r-md)] text-sm no-underline transition-colors ${
                active
                  ? "font-medium text-[var(--accent)] bg-[var(--accent-light)]"
                  : "font-normal text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span className={active ? "opacity-100" : "opacity-60"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-[10px] border-t border-[var(--border-subtle)]">
        <p className="text-[0.6875rem] text-[var(--text-tertiary)]">v0.1.0</p>
      </div>
    </>
  );
}
