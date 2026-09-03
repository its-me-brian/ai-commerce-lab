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
│        /api/workspaces                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           ORCHESTRATOR V2               │
│     LLM-based intent classification    │
│     Dynamic plan building              │
│     Approval integration               │
└──────┬──────────────┬───────────────────┘
       │              │
┌──────▼──────┐ ┌─────▼──────────┐
│  AGENT      │ │  MINI-AI       │
│  ENGINE     │ │  ENGINE        │
│  (tasks,    │ │  (lightweight  │
│   runs,     │ │   building     │
│   costs)    │ │   blocks)      │
└──────┬──────┘ └───────┬────────┘
       │                │
┌──────▼──────┐  ┌──────▼────────┐
│  WORKFLOW   │  │  TOOL          │
│  EXECUTOR   │  │  REGISTRY      │
│  (DAG,      │  │  (register,    │
│   mixed     │  │  resolve,      │
│   nodes)    │  │  execute)      │
└──────┬──────┘  └───────┬────────┘
       │                 │
┌──────▼──────┐  ┌───────▼────────┐
│  AI MODEL   │  │  PERMISSIONS   │
│  ROUTER     │  │  (role-based   │
│  (primary/  │  │  + explicit)   │
│  fallback)  │  └────────────────┘
└──────┬──────┘
       │
┌──────▼──────┐
│  PROVIDER   │
│  ADAPTERS   │
│  ┌────────┐ │
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
│  workspaces | conversations | messages  │
│  approvals | agent_events | agent_memory│
│  agent_model_routes | task_events       │
│  workflow_definitions | knowledge_docs  │
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

**F12: Mini-AI Delegation** — Agents can directly invoke mini-IAs:
- `delegateToMiniAI(agentId, miniAIId, input)` — single mini-AI invocation
- `delegateChainToMiniAI(agentId, steps)` — sequential chain execution

### MiniAIEngine (`src/lib/ai/mini-ai/engine.ts`)
Lightweight building blocks for AI operations:
- 6 built-in mini-IAs: researcher, classifier, extractor, summarizer, critic, validator
- 3 execution modes: deterministic (pure logic), LLM (AI-powered), hybrid
- Chain composition: execute multiple mini-IAs in sequence
- Zod schema validation for input/output (F10)
- Dynamic model selection based on complexity (F2)

### WorkflowExecutor (`src/lib/ai/workflow/executor.ts`)
DAG-based workflow execution:
- 5 node types: agent, mini-ai, chain, condition, aggregate
- Mixed agent/mini-AI nodes in single workflow
- Parallel execution of independent nodes
- Conditional branching and aggregation
- Built-in workflows: product-research, supplier-evaluation, content-generation, market-analysis (F11)

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

Implementations: `gemini.ts`, `claude.ts`, `grok.ts`, `workers-ai.ts`, `openai-compatible.ts`

### AgentRegistry (`src/lib/agents/core/registry.ts`)
Central registry of all agent instances:
- `register(agent)` / `get(agentId)` / `list()` / `listEnabled()`
- Also manages AgentDefinitions (identity, personality, skills, rules)

### ToolRegistry (`src/lib/tools/registry.ts`)
Manages executable tools:
- `register(tool)` / `get(toolId)` / `execute(toolId, input)`
- Tools: `calculate-margin`, `search-products`, `search-suppliers`, `analyze-seo`, `generate-image`

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

### Agent Execution
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
    ├── delegateToMiniAI("classifier", { text })
    │       (direct mini-AI invocation)
    │
    ▼
AgentEngine
    ├── Supabase: INSERT agent_runs
    ├── Supabase: UPDATE agent_tasks (status: completed)
    │
    ▼
API Response → Dashboard shows result
```

### Mini-AI Execution
```
Agent/Workflow calls MiniAIEngine.execute(miniAIId, input)
    │
    ▼
Check execution mode:
    │
    ├── Deterministic → Run pure logic (no LLM)
    │
    ├── LLM → Select model via ComplexityRouter
    │         → Validate input via Zod schema
    │         → Call AIModelRouter
    │         → Validate output via Zod schema
    │         → Return result
    │
    └── Hybrid → Try deterministic first
               → Fall back to LLM if needed
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
      workspaces/             # Workspace CRUD
  lib/                        # Core logic
    ai/                       # AI provider system
      providers/              # Provider implementations
        base.ts               # AIProvider abstract class
        gemini.ts             # Gemini adapter
        claude.ts             # Claude adapter
        grok.ts               # Grok adapter
      router.ts               # AIModelRouter
      bootstrap.ts            # Provider + agent + workflow registration
      types.ts                # AI types
      orchestrator-v2.ts      # LLM-based intent classification (F3)
      plan-builder.ts         # Dynamic plan building (F9)
      model-pricing.ts        # Real model pricing (F8)
      rag-service.ts          # RAG/Knowledge layer (F7)
      mini-ai/                # Mini-AI system
        types.ts              # MiniAI types
        engine.ts             # MiniAIEngine with Zod validation (F10)
        registry.ts           # MiniAI registry
        bootstrap.ts          # Built-in mini-AI registration
        implementations/      # 6 built-in mini-IAs
          researcher.ts
          classifier.ts
          extractor.ts
          summarizer.ts
          critic.ts
          validator.ts
      workflow/               # Workflow system
        types.ts              # Workflow types (DAG)
        executor.ts           # WorkflowExecutor
        registry.ts           # WorkflowRegistry (F5)
        input-resolver.ts     # Input mapping
        bootstrap.ts          # Built-in workflow registration (F11)
    agents/                   # Agent system
      core/                   # Core abstractions
        agent.ts              # BaseAgent abstract class
        engine.ts             # AgentEngine + delegation (F12)
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
    013-030 migrations        # FASE 1-46 tables
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

---

## MiniAI Architecture (V1)

### Concepto
Las MiniIAs son **servicios locales/cliente de ML auxiliares**, NO agentes LLM independientes.
El razonamiento de los agentes principales sigue pasando por el AI Model Router.

```
                  AI COMMERCE LAB
                         │
          ┌──────────────┴──────────────┐
          │                             │
      AGENT ENGINE                  MINI AI
          │                        (Browser)
      AI ROUTER               Transformers.js
          │                     ONNX Runtime
   ┌──────┼──────┐                   │
 Gemini Claude Grok             MiniLM
```

### Estrategia
- **Browser**: Transformers.js + ONNX Runtime Web
- **Modelo**: all-MiniLM-L6-v2 cuantizado (~23MB)
- **Carga**: Lazy loading (bajo demanda, no al iniciar)
- **Ejecución**: Web Worker (no bloquea UI)
- **Fallback**: Si falla, sistema sigue funcionando

### Pipeline
```
User message → MiniAI preprocessing
  → intent, entities, relevant context
  → Prompt Builder → LLM
```

### Usos
- Clasificación local de mensajes
- Detección de intención
- Similitud semántica / embeddings
- Selección de contexto relevante
- Ranking de documentos
- Preprocesamiento antes del LLM

### NO usar para
- Decisiones financieras críticas
- Compras o publicación de productos
- Sustitución del LLM principal

---

## Auditoría V1 (2 Sep 2026)

Ver `docs/AUDIT_V1.md` para el reporte completo.

### Resumen de hallazgos
- **31 API routes**: Todas funcionales, zero stubs
- **5 AI providers**: Todos con implementación real
- **17 componentes muertos**: Nunca importados
- **893 líneas de tipos TS**: Definidas pero nunca pasadas al cliente Supabase
- **4 subsistencias en memoria**: Pierden datos al reiniciar
- **Test Center hardcodeado**: Ignora resultados de APIs
- **Esquema drift**: 3 tablas sin tipos TS, 1 enum mismatch
