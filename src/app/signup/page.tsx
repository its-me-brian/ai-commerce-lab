"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/database/supabase-browser";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
 
  const _router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase not configured. Check environment variables.");
      setLoading(false);
      return;
    }

    // Use env var for production redirect, fallback to window.location.origin
    const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectUrl}/dashboard`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Check your email
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
            We sent a confirmation link to <strong>{email}</strong>
          </p>
          <a
            href="/login"
            className="text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            AI Commerce Lab
          </h1>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Create your account
          </p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
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
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-[var(--r-md)] border bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              placeholder="Repeat your password"
            />
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--error-bg)", color: "var(--error)" }}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full"
          >
            Create account
          </Button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-tertiary)" }}>
          Already have an account?{" "}
          <a href="/login" className="font-medium" style={{ color: "var(--accent)" }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
