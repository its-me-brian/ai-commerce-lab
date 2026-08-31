# AI Commerce Lab — Architecture

## Overview

AI Commerce Lab is a modular platform for running AI-powered ecommerce agents.
The architecture is designed for **modularity**, **provider-agnostic AI**, and **incremental development**.

## Core Principles

1. **Agents never know about AI providers** — they go through AIModelRouter
2. **Providers implement a common interface** — easy to swap/extend
3. **Configuration from dashboard** — no code changes to switch models
4. **Everything is logged** — tasks, runs, tokens, costs
5. **Security first** — API keys server-only, permission system
6. **Backend validates, AI proposes** — financial calculations are deterministic

## Architecture Layers

```
┌─────────────────────────────────────────┐
│              FRONTEND (Next.js)         │
│         Dashboard / Configuration       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              API ROUTES                 │
│        /api/agents/run                  │
│        /api/agents/config               │
│        /api/agents/history              │
│        /api/ai/test                     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           AGENT ENGINE                  │
│     Orchestrates execution flow         │
│     Creates Tasks + Runs in Supabase    │
│     Validates input                     │
│     Checks permissions                  │
│     Resolves config from DB             │
└──────┬──────────────┬───────────────────┘
       │              │
┌──────▼──────┐ ┌─────▼──────────┐
│  AI MODEL   │ │  TOOL          │
│  ROUTER     │ │  REGISTRY      │
│  (primary/  │ │  (register,    │
│  fallback)  │ │  resolve,      │
│             │ │  execute)      │
└──────┬──────┘ └───────┬────────┘
       │                │
┌──────▼──────┐  ┌──────▼────────┐
│  PROVIDER   │  │  PERMISSIONS  │
│  ADAPTERS   │  │  (role-based  │
│             │  │  + explicit)  │
│  ┌────────┐ │  └──────────────┘
│  │Gemini  │ │
│  │Claude  │ │
│  │Grok    │ │
│  └────────┘ │
└──────┬──────┘
       │
┌──────▼──────────────────────────────────┐
│           DATABASE (Supabase)           │
│  agents | agent_configs | agent_tasks   │
│  agent_runs | ai_providers | ai_models  │
│  agent_permissions | skills | agent_skills│
└─────────────────────────────────────────┘
```

## Key Components

### AgentEngine (`src/lib/agents/core/engine.ts`)
Orchestrates agent execution end-to-end:
1. Resolves agent from AgentRegistry (never accepts arbitrary agent objects)
2. Validates input via agent's `validateInput()`
3. Loads config from Supabase with provider/model resolution via JOINs
4. Checks permissions via PermissionChecker
5. Creates Task record in Supabase
6. Executes agent
7. Creates Run record with tokens/duration/status
8. Updates Task status to completed/failed

### AIModelRouter (`src/lib/ai/router.ts`)
Central routing component:
- Selects primary provider based on agent config
- Handles automatic fallback on primary failure
- Logs all execution metrics (provider, model, tokens, duration)
- Provider-agnostic: agents only call `router.generate()`

### AIProvider (`src/lib/ai/providers/base.ts`)
Abstract class that all providers implement:
- `generate(options)` — generate text/structured output
- `testConnection(model)` — verify API key works
- `getAvailableModels()` — list available models

Implementations: `gemini.ts`, `claude.ts`, `grok.ts`

### AgentRegistry (`src/lib/agents/core/registry.ts`)
Central registry of all agent instances:
- `register(agent)` / `get(agentId)` / `list()` / `listEnabled()`
- Also manages AgentDefinitions (identity, personality, skills, rules)

### ToolRegistry (`src/lib/tools/registry.ts`)
Manages executable tools:
- `register(tool)` / `get(toolId)` / `execute(toolId, input)`
- Tools: `calculate-margin`, `search-products`

### PermissionChecker (`src/lib/permissions/checker.ts`)
Validates agent permissions before execution:
- Checks explicit grants/denies in `agent_permissions` table
- Falls back to role-based defaults (admin/full, restricted/read-only)
- `validateExecution(agentId, {tools, provider})` — validates all at once

### PromptBuilder (`src/lib/agents/core/prompt-builder.ts`)
Constructs prompts for agents:
- Injects identity, personality, expertise, rules, output instructions
- Supports communication style and decision style

## Data Flow

```
User clicks "Run" in Dashboard
    │
    ▼
POST /api/agents/run  { agentId, input }
    │
    ▼
AgentEngine.executeTask(agentId, input)
    │
    ├── AgentRegistry.get(agentId) → Agent
    ├── agent.validateInput(input)
    ├── Supabase: load agent_configs + provider/model JOINs
    ├── PermissionChecker.validateExecution()
    ├── Supabase: INSERT agent_tasks (status: running)
    │
    ▼
Agent.execute(context)
    │
    ├── router.generate(config, options)
    │       │
    │       ├── Primary provider.generate()
    │       │       (or fallback on failure)
    │       │
    │       └── Returns: { result, log }
    │
    ├── toolRegistry.execute("calculate_margin", {...})
    │       (backend validation of AI estimates)
    │
    ▼
AgentEngine
    ├── Supabase: INSERT agent_runs
    ├── Supabase: UPDATE agent_tasks (status: completed)
    │
    ▼
API Response → Dashboard shows result
```

## Directory Structure

```
src/
  app/                        # Next.js pages
    dashboard/                # Dashboard pages
      agents/                 # Agent list + detail
      models/                 # Model configuration
      settings/               # App settings
    api/                      # API routes
      ai/test/                # Provider connection test
      agents/run/             # Generic agent execution
      agents/config/          # Agent config CRUD
      agents/history/         # Task history
      agents/product-hunter/run/  # Legacy endpoint
  lib/                        # Core logic
    ai/                       # AI provider system
      providers/              # Provider implementations
        base.ts               # AIProvider abstract class
        gemini.ts             # Gemini adapter
        claude.ts             # Claude adapter
        grok.ts               # Grok adapter
      router.ts               # AIModelRouter
      bootstrap.ts            # Provider + agent registration
      types.ts                # AI types
    agents/                   # Agent system
      core/                   # Core abstractions
        agent.ts              # BaseAgent abstract class
        engine.ts             # AgentEngine
        registry.ts           # AgentRegistry
        types.ts              # AgentContext, AgentResult, etc.
        types-agent-definition.ts  # AgentDefinition, Skill
        prompt-builder.ts     # PromptBuilder
      definitions/            # Agent definitions (JSON-like)
        product-hunter.ts
        finance.ts
        marketing.ts
        ceo.ts
        secretary.ts
        store-builder.ts
      product-hunter.ts       # ProductHunterAgent implementation
      finance.ts              # FinanceAgent
      marketing.ts            # MarketingAgent
      ceo.ts                  # CEOAgent
      secretary.ts            # SecretaryAgent
      store-builder.ts        # StoreBuilderAgent
    tools/                    # Tool system
      types.ts                # Tool interface
      registry.ts             # ToolRegistry
      bootstrap.ts            # Tool registration
      calculate-margin.ts     # Margin calculator
      search-products.ts      # Product search (DummyJSON)
    permissions/              # Permission system
      types.ts                # Permission types, DEFAULT_PERMISSIONS
      checker.ts              # PermissionChecker
    database/
      supabase.ts             # Supabase client (server-only)
  components/                 # React components
supabase/
  migrations/                 # Database migrations
    001_initial_schema.sql    # Core tables + RLS
    002-010_consolidated.sql  # Permissions + agent tables
    011_agent_identity_skills.sql  # Skills + identity
```

## Database Schema

### Core Tables
- **agents** — Agent registry (id, name, status, role, identity, mission, personality, expertise, rules)
- **agent_configs** — Per-agent AI config (provider IDs, model IDs, temperature, max_tokens)
- **agent_tasks** — Execution tasks (status, input, output, error, timestamps)
- **agent_runs** — Individual runs (provider, model, tokens, duration, status)
- **ai_providers** — Provider registry (name, slug, enabled, api_key_env)
- **ai_models** — Model registry (provider_id, model_id, name, enabled)
- **agent_permissions** — Explicit permissions (action, target, granted, conditions)
- **skills** — Skill definitions (name, slug, category)
- **agent_skills** — Agent-skill associations

### RLS
All tables have Row Level Security enabled with service-role-only policies (`USING (true)`).
This means only the server-side Supabase client (with service role key) can access data.
The browser/client Supabase client cannot read or write any data.

## Security

- API keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`) exist only server-side
- `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the browser
- No `NEXT_PUBLIC_*` variables for secrets
- Permission system enforces authorization before tool execution
- All API routes validate input and return controlled error responses

## Adding a New Provider

1. Create `src/lib/ai/providers/[name].ts`
2. Extend `AIProvider` abstract class
3. Implement `generate()`, `testConnection()`, `getAvailableModels()`
4. Register in `bootstrap.ts`
5. Add environment variable for API key

## Adding a New Agent

1. Create `src/lib/agents/[name].ts`
2. Extend `BaseAgent` abstract class
3. Implement `metadata`, `validateInput()`, `execute()`
4. Create definition in `src/lib/agents/definitions/[name].ts`
5. Register in `bootstrap.ts`
6. Add to database via migration
