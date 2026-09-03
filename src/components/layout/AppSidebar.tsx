"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  {
    label: "Workspace",
    href: "/workspace",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h12M2 8h12M2 13h12" />
        <circle cx="5" cy="3" r="1" fill="currentColor" />
        <circle cx="10" cy="8" r="1" fill="currentColor" />
        <circle cx="7" cy="13" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="6" height="6" rx="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Agents",
    href: "/dashboard/agents",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="5" r="3" />
        <path d="M2.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      </svg>
    ),
  },
  {
    label: "Catalog",
    href: "/dashboard/catalog",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h12M2 6.5h12M2 10h8M2 13h5" />
      </svg>
    ),
  },
  {
    label: "Runs",
    href: "/dashboard/runs",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 8h12M8 2v12" />
      </svg>
    ),
  },
  {
    label: "Approvals",
    href: "/dashboard/approvals",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12l2 2 4-4" />
        <path d="M13 8a5 5 0 11-10 0 5 5 0 0110 0z" />
      </svg>
    ),
  },
  {
    label: "Observability",
    href: "/dashboard/observability",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 1.5" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="2" />
        <path d="M13.2 10l1 .6-.8 1.3-1.2-.4c-.5.4-1 .7-1.6.9l-.2 1.2H7.6l-.2-1.2c-.6-.2-1.1-.5-1.6-.9l-1.2.4-.8-1.3 1-.6c0-.3-.1-.6-.1-.9s0-.6.1-.9l-1-.6.8-1.3 1.2.4c.5-.4 1-.7 1.6-.9L7.3 3h1.4l.2 1.2c.6.2 1.1.5 1.6.9l1.2-.4.8 1.3-1 .6c0 .3-.1.6-.1.9s0 .6.1.9z" />
      </svg>
    ),
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Logo */}
      <div className="h-[var(--header-h)] flex items-center px-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-[var(--r-md)] bg-[var(--accent)] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            AI Commerce Lab
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 flex flex-col gap-px overflow-y-auto">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
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
              <span className={active ? "opacity-100" : "opacity-60"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-[10px] border-t border-[var(--border-subtle)]">
        <p className="text-[0.6875rem] text-[var(--text-tertiary)]">v0.1.0</p>
      </div>
    </>
  );
}
