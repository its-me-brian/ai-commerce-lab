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

## Architecture Layers

```
┌─────────────────────────────────────────┐
│              FRONTEND (Next.js)         │
│         Dashboard / Configuration       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              API ROUTES                 │
│        CRUD / Webhooks / Auth           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           AGENT ENGINE                  │
│     Orchestrates execution flow         │
│     Manages tasks, results, logs        │
└──────┬──────────────┬───────────────────┘
       │              │
┌──────▼──────┐ ┌─────▼──────────┐
│  AI MODEL   │ │  TOOL          │
│  ROUTER     │ │  REGISTRY      │
│             │ │  (future)      │
└──────┬──────┘ └────────────────┘
       │
┌──────▼──────────────────────────────────┐
│         PROVIDER ADAPTERS               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Gemini  │ │ Claude  │ │  Grok   │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│           DATABASE (Supabase)           │
│  agents | tasks | runs | configs | ...  │
└─────────────────────────────────────────┘
```

## Key Components

### AIProvider (interface)
Abstract class that all providers implement.
- `generate()` — generate text/structured output
- `testConnection()` — verify API key works
- `getAvailableModels()` — list models

### AIModelRouter
Central routing component.
- Selects primary provider
- Handles fallback on failure
- Logs execution metrics

### AgentEngine
Orchestrates agent execution.
- Creates task records
- Validates input
- Coordinates with router
- Records results and metrics

### BaseAgent (interface)
Abstract class all agents implement.
- `metadata` — agent info
- `execute()` — run the agent
- `validateInput()` — check inputs

### AgentRegistry
Central registry of all agents.
- `register()` — add agent
- `get()` — retrieve agent
- `list()` — all agents

## Data Flow

```
User clicks "Run" in Dashboard
    ↓
API Route creates task
    ↓
AgentEngine.executeTask()
    ↓
Agent.execute(context)
    ↓
Agent calls AIModelRouter.generate()
    ↓
Router selects provider (primary/fallback)
    ↓
ProviderAdapter.generate()
    ↓
API call to Gemini/Claude/Grok
    ↓
Response validated (Zod schema)
    ↓
Result stored in database
    ↓
Dashboard shows result
```

## Directory Structure

```
src/
  app/                    # Next.js pages
    dashboard/            # Dashboard pages
      agents/             # Agent management
      models/             # Model configuration
      settings/           # App settings
    api/                  # API routes
      ai/                 # AI endpoints
      agents/             # Agent endpoints
  components/             # React components
    dashboard/            # Dashboard components
    agents/               # Agent UI components
    models/               # Model config components
    ui/                   # Shared UI components
  lib/                    # Core logic
    ai/                   # AI provider system
      providers/          # Provider implementations
        base.ts           # AIProvider interface
        gemini.ts         # Gemini adapter
        claude.ts         # Claude adapter
        grok.ts           # Grok adapter
      router.ts           # AIModelRouter
      types.ts            # AI types
    agents/               # Agent system
      core/               # Agent engine
        agent.ts          # BaseAgent interface
        engine.ts         # AgentEngine
        registry.ts       # AgentRegistry
        types.ts          # Agent types
    config/               # Configuration
    database/             # Supabase client
    logging/              # Structured logging
    types/                # Shared types
supabase/
  migrations/             # Database migrations
```

## Adding a New Provider

1. Create `src/lib/ai/providers/[name].ts`
2. Extend `AIProvider` abstract class
3. Implement `generate()`, `testConnection()`, `getAvailableModels()`
4. Register in `AIModelRouter`
5. Add environment variable for API key

## Adding a New Agent

1. Create `src/lib/agents/[name].ts`
2. Extend `BaseAgent` abstract class
3. Implement `metadata` and `execute()`
4. Register in `AgentRegistry`
5. Add configuration UI in dashboard
