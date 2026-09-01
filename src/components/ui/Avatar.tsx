"use client";

import React from "react";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_MAP: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: "w-5 h-5", text: "text-[0.5rem]" },
  sm: { container: "w-7 h-7", text: "text-[0.6rem]" },
  md: { container: "w-9 h-9", text: "text-xs" },
  lg: { container: "w-12 h-12", text: "text-sm" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const colors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d"];
  return colors[Math.abs(h) % colors.length];
}

export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}) {
  const dims = SIZE_MAP[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dims.container} rounded-full object-cover ${className}`}
        style={{ flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      className={`${dims.container} ${dims.text} rounded-full inline-flex items-center justify-center font-semibold ${className}`}
      style={{
        background: hashColor(name),
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}
