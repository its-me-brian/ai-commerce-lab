"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/database/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase not configured. Check environment variables.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/workspace");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            AI Commerce Lab
          </h1>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Sign in to your workspace
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-[var(--r-md)] border bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-[var(--r-md)] border bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              placeholder="Your password"
            />
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--error-bg)", color: "var(--error)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-sm font-medium rounded-[var(--r-md)] transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "var(--text-inverse)",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-tertiary)" }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-medium" style={{ color: "var(--accent)" }}>
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
