# AUDIT CURRENT FINAL — AI Commerce Lab

**Date:** 2026-09-03
**Auditor:** OpenCode Agent
**Scope:** Complete codebase audit for Production V1

---

## A. Architecture Overview

```
Next.js 16.3.3 + React 19 + TypeScript 5
Supabase (PostgreSQL + Auth + RLS)
Vercel (deployment target)
Browser MiniAI (Transformers.js / ONNX)
```

**Directory structure:**
- `src/app/` — 17 pages, 24+ API routes
- `src/components/` — 18 components (chat, agents, ui, layout, dashboard)
- `src/hooks/` — 4 hooks (speech, classifier, RAG, agent status)
- `src/lib/` — Core business logic (AI, agents, tools, auth, workspaces, etc.)
- `supabase/migrations/` — 37 migration files
- `test/` — Mirror of src/lib for tests

---

## B. Routes

### Pages (17)
| Route | Auth | Type |
|-------|------|------|
| `/` | Public | Landing |
| `/login` | Public | Auth |
| `/signup` | Public | Auth |
| `/workspace` | Protected | Chat workspace |
| `/workspace/settings` | Protected | Company settings |
| `/workspace/agents/[id]` | Protected | Agent profile |
| `/dashboard` | Protected | Operations center |
| `/dashboard/agents` | Protected | Agent grid |
| `/dashboard/agents/[id]` | Protected | Agent detail |
| `/dashboard/runs` | Protected | Run history |
| `/dashboard/runs/[id]` | Protected | Run detail |
| `/dashboard/catalog` | Protected | Product catalog |
| `/dashboard/models` | Protected | AI providers/models |
| `/dashboard/settings` | Protected | Env var status |
| `/dashboard/budgets` | Protected | Cost budgets |
| `/dashboard/observability` | Protected | Event log |
| `/dashboard/activity` | Protected | Activity timeline |
| `/dashboard/security` | Protected | Security audit |
| `/dashboard/evaluation` | Protected | AI evaluation |
| `/dashboard/test-center` | Protected | Agent testing |

### API Routes (24+)
All protected with `requireAuth()` EXCEPT `/api/health`.

---

## C. APIs

24 API route files covering: agents, conversations, catalog, CEO orchestration, products, events, tasks, workspaces, tools, RAG, AI providers, models, budgets, security, evaluation, observability.

---

## D. Tables (29)

| Table | workspace_id | RLS | Status |
|-------|:---:|:---:|--------|
| workspaces | — | `USING(true)` | EXISTS |
| agents | YES | `USING(true)` | EXISTS |
| agent_configs | NO | `USING(true)` | EXISTS |
| agent_definitions | NO | `USING(true)` | EXISTS |
| agent_tasks | **NO** | `USING(true)` | **MISSING workspace_id** |
| agent_runs | **NO** | `USING(true)` | **MISSING workspace_id** |
| agent_permissions | NO | `USING(true)` | EXISTS |
| agent_model_routes | NO | `USING(true)` | EXISTS |
| agent_memory | YES | `USING(true)` | EXISTS |
| agent_skills | NO | `USING(true)` | EXISTS |
| skills | NO | `USING(true)` | EXISTS |
| conversations | YES | `USING(true)` | EXISTS |
| conversation_messages | NO | `USING(true)` | EXISTS |
| conversation_participants | NO | `USING(true)` | EXISTS |
| product_catalog | YES | `USING(true)` | EXISTS |
| approvals | **NO** | `USING(true)` | **MISSING workspace_id** |
| task_events | NO | `USING(true)` | EXISTS |
| app_events | NO | `USING(true)` | EXISTS |
| ai_providers | NO | `USING(true)` | EXISTS |
| ai_models | NO | `USING(true)` | EXISTS |
| ai_provider_credentials | NO | service-role only | EXISTS (encrypted) |
| knowledge_documents | YES | `USING(true)` | EXISTS |
| workflow_definitions | NO | `USING(true)` | EXISTS |
| structured_logs | NO | `USING(true)` | EXISTS |
| metrics | NO | `USING(true)` | EXISTS |
| traces | NO | `USING(true)` | EXISTS |
| spans | NO | `USING(true)` | EXISTS |
| cost_budgets | **NO** | `USING(true)` | **MISSING workspace_id** |
| cost_records | **NO** | `USING(true)` | **MISSING workspace_id** |

---

## E. Migrations

37 migration files (001-036 + consolidated). Well-structured with indexes, foreign keys, and RLS policies.

**Issues:**
- Migration 034 RLS policies all use `USING(true)` — no row-level isolation
- `002-010_consolidated.sql` is a duplicate that could conflict
- Migration 033 creates `cleanup_old_structured_logs()` but it's never called by cron

---

## F. Providers

| Provider | Status | Notes |
|----------|--------|-------|
| Gemini | ✅ Implemented | Primary provider |
| Anthropic/Claude | ✅ Implemented | Via API |
| xAI/Grok | ✅ Implemented | Via API |
| OpenAI | ✅ Implemented | Via API |
| Ollama | ⚠️ Dead code | Auto-registers if localhost:11434 reachable, NOT in Settings UI |
| Workers AI | ⚠️ Dead code | Registered but not surfaced |
| Qwen | ❌ NOT IMPLEMENTED | Needs OpenAI-compatible adapter |
| OpenAI-compatible | ❌ NOT IMPLEMENTED | Generic adapter needed |

---

## G. Agents (9 definitions)

| Agent | Identity | Tools | Status |
|-------|----------|-------|--------|
| CEO | ✅ | Orchestration | Active |
| Product Hunter | ✅ | search-products | Active |
| Market Research | ✅ | Research | Active |
| Marketing | ✅ | Content | Active |
| Finance | ✅ | Calculations | Active |
| Store Builder | ✅ | E-commerce | Active |
| Secretary | ✅ | Admin | Active |
| Supplier Research | ✅ | search-suppliers | Active (MOCK) |
| Opportunity Scoring | ✅ | Scoring | Active |

---

## H. Tools

| Tool | Status | Notes |
|------|--------|-------|
| search-products | ⚠️ DummyJSON | Demo API, not production |
| search-suppliers | ❌ MOCK | Hardcoded fake suppliers |
| generate-image | ❌ STUB | Returns placeholder URLs |
| calculate-margin | ✅ Real | Financial calculation |
| analyze-seo | ✅ Real | SEO analysis |

---

## I. Integrations

| Integration | Status |
|-------------|--------|
| Shopify | ❌ NOT IMPLEMENTED |
| AliExpress | ❌ NOT IMPLEMENTED |
| CJ Dropshipping | ❌ NOT IMPLEMENTED |
| Spocket | ❌ NOT IMPLEMENTED |

---

## J. Mocks / Placeholders

| Item | Location | Severity |
|------|----------|----------|
| DummyJSON product source | search-products.ts | HIGH |
| Mock suppliers | search-suppliers.ts | HIGH |
| Placeholder images | generate-image.ts | HIGH |
| In-memory budgets | cost-budget.ts | HIGH |
| In-memory evaluation | evaluation.ts | HIGH |
| In-memory observability | observability.ts | MEDIUM |
| In-memory rate limiter | middleware.ts | MEDIUM |
| In-memory security audit | security audit | MEDIUM |
| localStorage test history | test-center | LOW |

---

## K. Security

### CRITICAL
1. **ALL API routes use service-role client** — bypasses ALL RLS
2. **RLS policies are `USING(true)`** — no row-level isolation
3. **No `workspace_members` table** — no multi-tenancy
4. **Auth bypassed when env vars missing** — returns synthetic `dev@localhost` user

### HIGH
5. Middleware skips ALL API routes from auth
6. No CSRF protection on mutating routes
7. `requireAuth()` returns fake user when Supabase not configured
8. Config file leaks service role key into object property

### GOOD
- Credentials encrypted with AES-256-GCM
- No secrets exposed to browser
- Dashboard settings only reads boolean env vars
- Security headers set in middleware

---

## L. Workspace Isolation

**NON-EXISTENT.** No mechanism to enforce that User A can only access Workspace A's data. The `workspaces` table exists but:
- No `workspace_members` table
- No user-to-workspace mapping
- RLS policies don't check workspace membership
- API routes don't filter by user's workspace

---

## M. MiniAI

- Browser ML via Transformers.js/ONNX ✅
- Embeddings (all-MiniLM-L6-v2) ✅
- Classification (distilbert) ✅
- RAG API endpoints ✅
- Worker-based inference ✅
- Fast-path for greetings/status ✅
- Token savings: 60-80% ✅

---

## N. Observability

- StructuredLogger ✅ (in-memory + Supabase persistence)
- ExecutionTracer ✅ (in-memory + Supabase persistence)
- MetricsCollector ✅ (in-memory + Supabase persistence)
- Health check endpoint ✅
- Wired into router + agent-chat ✅

**Issue:** In-memory components lose data on Vercel cold starts.

---

## O. Costs

- Model pricing table ✅
- Cost calculation per run ✅
- Budget tracker ⚠️ (in-memory only)
- Cost records table ✅
- Cost budgets table ✅
- Dashboard shows costs ✅

---

## P. Tests

- **61 test files** in src/lib/
- **56 pass, 4 fail** (Supabase env vars), 1 skipped
- **873 tests pass**, 6 skipped
- **ZERO component/hook tests**
- **ZERO API route tests**
- vitest configured for `node` environment (not `jsdom`)

---

## Q. Critical Problems

1. Service-role client used for ALL data access — RLS is theater
2. No workspace isolation — any user sees all data
3. Auth bypass when env vars missing
4. No `workspace_members` table
5. Mock tools active in production
6. Budget/evaluation/observability are in-memory only
7. No OpenAI-compatible provider adapter (blocks Qwen)
8. No Shopify integration
9. No component/hook tests
10. Build succeeds but no production auth enforcement

---

## R. Medium Problems

1. Ollama dead code in bootstrap
2. Settings page is read-only env var display
3. No form validation on workspace settings
4. No success/error feedback after saves
5. MicrophoneButton duplicates useSpeechRecognition hook
6. Agent colors duplicated across files
7. Hardcoded workspace ID "default"
8. RAG search does full table scan + JS cosine similarity
9. Rate limiter is in-memory (ineffective on Vercel)
10. `cleanup_old_structured_logs()` never called

---

## S. Technical Debt

1. `supabase-server.ts` exists but is NOT used by any API route
2. `@vitejs/plugin-react` in devDependencies but not used
3. Version `v0.1.0` hardcoded in AppSidebar
4. Consolidated migration file could conflict with individual migrations
5. Three separate logging systems (simple, event, structured)
6. `config/index.ts` exposes service role key in object

---

## T. What Actually Works

- Login/signup flow ✅
- Agent definitions loaded from DB ✅
- Conversations persist ✅
- Messages persist ✅
- Room chat with multi-agent ✅
- Direct chat with agents ✅
- @mentions routing ✅
- CEO orchestration ✅
- Task engine ✅
- Product catalog CRUD ✅
- Agent model routing (DB-driven) ✅
- Credential vault encryption ✅
- Prompt optimization (fast-path, compression, pruning) ✅
- Response caching ✅
- Token counting ✅
- Voice input ✅
- Status query fast-path ✅
- Structured logging + tracing ✅
- Health check endpoint ✅
- CSS workspace layout ✅

---

## U. What Appears to Work But Doesn't

- **RLS** — exists but `USING(true)` = no isolation
- **Auth on API routes** — each route calls `requireAuth()` but middleware doesn't enforce; one missed route = open
- **Budgets** — UI exists but data is in-memory only
- **Evaluations** — UI exists but data is in-memory only
- **Supplier research** — returns hardcoded fake data
- **Image generation** — returns placeholder URLs
- **Product search** — uses DummyJSON demo API
- **Rate limiting** — in-memory, reset on each Vercel cold start
- **Observability persistence** — has Supabase tables but also in-memory fallback that loses data

---

## V. Missing for V1

1. `workspace_members` table + real RLS
2. Session-scoped Supabase client for API routes
3. OpenAI-compatible provider adapter (for Qwen)
4. Qwen provider in Settings UI
5. Shopify integration (OAuth + CommerceProvider)
6. Supplier source (real API or explicit "unavailable")
7. Real product source (or explicit "demo mode")
8. CEO Tool System with permissions
9. Approval system with UI
10. Settings redesign (AI Providers, Models, Integrations)
11. Budget persistence in Supabase
12. Evaluation persistence in Supabase
13. Audit log table
14. Component/hook tests
15. Frontend error states for all integrations
