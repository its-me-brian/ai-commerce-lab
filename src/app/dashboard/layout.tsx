"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMobileOpen(false);
          }}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30"
        />
      )}

      {/* Sidebar — desktop */}
      <aside className="sidebar-desktop flex flex-col fixed inset-y-0 left-0 z-40 w-[var(--sidebar-w)] bg-[var(--bg-card)] border-r border-[var(--border-subtle)] overflow-y-auto">
        <AppSidebar />
      </aside>

      {/* Sidebar — mobile drawer */}
      <aside
        className="sidebar-mobile flex flex-col fixed inset-y-0 left-0 z-50 w-[var(--sidebar-w)] bg-[var(--bg-card)] overflow-y-auto transition-[left] duration-200 ease-in-out"
        style={{
          left: mobileOpen ? 0 : "calc(var(--sidebar-w) * -1)",
          boxShadow: mobileOpen ? "4px 0 24px rgba(0,0,0,0.1)" : "none",
        }}
      >
        <AppSidebar />
      </aside>

      {/* Main */}
      <main className="main-content flex-1">
        {/* Mobile header */}
        <div className="mobile-header sticky top-0 z-30 h-[var(--header-h)] bg-[var(--bg-card)] border-b border-[var(--border-subtle)] flex items-center px-4 gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-9 h-9 flex items-center justify-center bg-transparent border border-[var(--border-subtle)] rounded-[var(--r-md)] cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
            )}
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">AI Commerce Lab</span>
        </div>

        {children}
      </main>
    </div>
  );
}
