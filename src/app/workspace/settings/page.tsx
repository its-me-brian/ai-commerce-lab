"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

interface CompanySettings {
  id: string;
  name: string;
  industry: string;
  target_market: string;
  budget_limit: number;
  currency: string;
  timezone: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/workspaces");
        const data = await res.json();
        if (data.success) {
          setWorkspaces(data.workspaces || []);
          if (data.workspaces?.length > 0) {
            setSettings(data.workspaces[0]);
          }
        }
      } catch {
        console.error("Failed to load workspace settings");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/workspaces", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    } catch {
      console.error("Failed to save workspace settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Company Settings
        </h1>
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          Configure your company profile and workspace settings
        </p>
      </div>

      {settings ? (
        <div className="space-y-6">
          {/* Company Profile */}
          <Card>
            <CardHeader title="Company Profile" />
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{
                      background: "var(--bg-sunken)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Industry
                  </label>
                  <input
                    type="text"
                    value={settings.industry}
                    onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{
                      background: "var(--bg-sunken)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Target Market
                  </label>
                  <input
                    type="text"
                    value={settings.target_market}
                    onChange={(e) => setSettings({ ...settings, target_market: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{
                      background: "var(--bg-sunken)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Currency
                  </label>
                  <input
                    type="text"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{
                      background: "var(--bg-sunken)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Budget Limit
                  </label>
                  <input
                    type="number"
                    value={settings.budget_limit}
                    onChange={(e) => setSettings({ ...settings, budget_limit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{
                      background: "var(--bg-sunken)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Timezone
                  </label>
                  <input
                    type="text"
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{
                      background: "var(--bg-sunken)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Workspaces */}
          <Card>
            <CardHeader title="Workspaces" />
            <CardContent>
              {workspaces.length === 0 ? (
                <EmptyState
                  icon="📁"
                  title="No workspaces"
                  description="Create a workspace to organize your agents and tasks"
                />
              ) : (
                <div className="space-y-2">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "var(--bg-sunken)" }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {ws.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {ws.description || "No description"}
                        </p>
                      </div>
                      <Badge variant="info">Active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon="⚙️"
          title="No settings found"
          description="Company settings will appear here once configured"
        />
      )}
    </div>
  );
}
