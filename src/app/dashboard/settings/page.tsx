// Settings Page — Tabbed interface for AI Providers, Models, and Integrations
// Server component that renders env var status + client-side tab navigation

import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default function SettingsPage() {
  // Server-side env var checks (never expose values to client)
  const envStatus = [
    { name: "GEMINI_API_KEY", desc: "Google Gemini", set: !!process.env.GEMINI_API_KEY, category: "providers" },
    { name: "ANTHROPIC_API_KEY", desc: "Anthropic Claude", set: !!process.env.ANTHROPIC_API_KEY, category: "providers" },
    { name: "XAI_API_KEY", desc: "xAI Grok", set: !!process.env.XAI_API_KEY, category: "providers" },
    { name: "QWEN_API_KEY", desc: "Alibaba Qwen", set: !!process.env.QWEN_API_KEY, category: "providers" },
    { name: "DEEPSEEK_API_KEY", desc: "DeepSeek", set: !!process.env.DEEPSEEK_API_KEY, category: "providers" },
    { name: "SUPABASE_URL", desc: "Project URL", set: !!process.env.SUPABASE_URL, category: "database" },
    { name: "SUPABASE_ANON_KEY", desc: "Anonymous key", set: !!process.env.SUPABASE_ANON_KEY, category: "database" },
    { name: "EBAY_CLIENT_ID", desc: "eBay Browse API", set: !!process.env.EBAY_CLIENT_ID, category: "sources" },
  ];

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Settings</h1>
        <p>Manage AI providers, models, and integrations</p>
      </div>

      <SettingsTabs envStatus={envStatus} />
    </div>
  );
}
