# AUDIT CURRENT — ai-commerce-lab

**Date:** 2026-09-02
**Auditor:** OpenCode Agent
**Status:** PRE-PHASE 1

---

## 1. General State

| Metric | Value |
|--------|-------|
| Framework | Next.js 16.3.3 |
| React | 19.2.8 |
| TypeScript | 5.x (strict) |
| CSS | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |
| Test framework | Vitest 4.1.11 |
| AI providers | Gemini, Claude, Grok, Ollama (unused), Workers AI |
| MiniAI | Transformers.js + ONNX (built, not connected) |

---

## 2. Architecture Found

```
BROWSER
    ↓
Browser MiniAI (Transformers.js + ONNX) — NOT CONNECTED
    ↓
Vercel API (37 endpoints, NO auth)
    ↓
AI Router → Gemini / Claude / Grok
    ↓
Agent Engine (9 agents)
    ↓
Supabase (34 migrations, RLS enabled but non-functional)
```

---

## 3. Frontend Current

### Pages (22 total)
| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Landing page | Working |
| `/workspace` | Multi-agent chat | Working (mobile issues fixed) |
| `/workspace/settings` | Workspace settings | Exists |
| `/workspace/agents/[id]` | Agent config | Exists |
| `/dashboard` | Operations center | Working |
| `/dashboard/agents` | Agents list | Working |
| `/dashboard/agents/[id]` | Agent detail (876+ lines) | Working |
| `/dashboard/catalog` | Product catalog | Working |
| `/dashboard/runs` | Run history | Working |
| `/dashboard/runs/[id]` | Run detail | Working |
| `/dashboard/models` | Model config | Working |
| `/dashboard/test-center` | Test center | Working |
| `/dashboard/observability` | Metrics | Working |
| `/dashboard/evaluation` | AI evaluation | Working |
| `/dashboard/budgets` | Budgets | Working |
| `/dashboard/security` | Security audit | Working |
| `/dashboard/activity` | Activity | Working |
| `/dashboard/settings` | Settings | Working |

### Components (17 TSX files)
- `agents/`: AgentCard, OrgChart
- `chat/`: ChatComposer, ChatContainer, CompanyRoom, MessageBubble, MessageList
- `dashboard/`: AgentActivityChart, DashboardCharts, TasksByDayChart
- `layout/`: AppSidebar
- `ui/`: Badge, Button, Card, EmptyState, ErrorMessage, StatusDot

### Empty component directories (dead placeholders)
- `src/components/activity/`
- `src/components/approvals/`
- `src/components/models/`
- `src/components/products/`
- `src/components/tasks/`
- `src/components/workspace/`

### Unused hooks
- `src/hooks/useAgentStatus.ts` — never imported
- `src/hooks/useRealtime.ts` — never imported

---

## 4. Backend Current

### API Endpoints: 37 route.ts files
- **ZERO** have auth checks
- **ZERO** have workspace scoping (except conversation-engine and RAG)
- Rate limiting: in-memory Map (non-functional on Vercel)

### Key services
- `agent-chat.ts` — Direct agent chat
- `multi-agent-chat.ts` — Room fan-out
- `conversation-engine.ts` — CRUD conversations
- `task-engine.ts` — Task lifecycle
- `rag-service.ts` — Hash-based embeddings (placeholder)
- `prompt-pipeline.ts` — MiniAI preprocessing
- `cost-budget.ts` — Cost tracking

---

## 5. Database

### 34 migrations
- Schema covers: agents, conversations, messages, tasks, approvals, costs, observability, workflows, knowledge documents
- All RLS policies use `USING (true)` — **non-functional**
- `increment_message_count()` atomic function exists (migration 032)

### Types
- `src/lib/types/database.ts` — auto-generated Supabase types (30KB)

---

## 6. Agents

### 9 registered agents
| ID | Class | Parent |
|----|-------|--------|
| ceo | CEOAgent | root |
| product-hunter | ProductHunterAgent | ceo |
| supplier-research | SupplierResearchAgent | product-hunter |
| market-research | MarketResearchAgent | product-hunter |
| opportunity-scoring | OpportunityScoringAgent | product-hunter |
| store-builder | StoreBuilderAgent | ceo |
| marketing | MarketingAgent | ceo |
| finance | FinanceAgent | ceo |
| secretary | SecretaryAgent | ceo |

### 6 hardcoded definitions
- ceo, product-hunter, store-builder, marketing, secretary, finance
- Missing: supplier-research, market-research, opportunity-scoring

---

## 7. MiniAI

### Built-in mini-AIs (6, all hybrid mode)
- classifier, validator, extractor, researcher, summarizer, critic

### Browser ML (3 files, NOT connected)
- `worker.js` — Transformers.js ONNX worker
- `provider.ts` — Singleton manager
- `use-browser-ml.ts` — React hook (zero consumers)

### RAG embeddings
- Hash-based, NOT real ML model
- 384-dim vectors via word-hash spread
- Comment: "For production, replace with a real embedding model"

---

## 8. Problems Found

### P0 — CRITICAL
1. **No authentication** — entire app is public
2. **RLS wildcard** — all policies use `USING (true)`
3. **33 APIs without auth** — any URL can execute operations
4. **Service role in server components** — `dashboard/page.tsx`, `runs/page.tsx`, `runs/[id]/page.tsx`
5. **Workspace ID mismatch** — UI passes `"default"`, service uses `"ws-default"`

### P1 — HIGH
6. **No workspace scoping** — most queries don't filter by workspace_id
7. **Rate limiting in-memory** — ineffective on Vercel
8. **Ollama registered** — full provider + bootstrap + env var (dead code)
9. **DummyJSON as default** — Product Hunter uses mock source by default
10. **MOCK_SUPPLIERS** — hardcoded fake suppliers
11. **RAG hash embeddings** — not real ML
12. **MiniAI hybrid calls LLM** — all 6 built-in have instructions
13. **No message pagination** — loads all messages at once

### P2 — MEDIUM
14. **6 empty component directories** — dead placeholders
15. **2 unused hooks** — useAgentStatus, useRealtime
16. **Missing CSP and HSTS** headers
17. **Sanitization not applied** — functions exist but never called
18. **General Room race condition** — no unique constraint
19. **Test center overlaps agent detail**
20. **13+ dashboard pages** — many redundant

---

## 9. Completed Features (really working)

- Agent registration and basic routing
- Conversation CRUD (direct + room)
- Message persistence with atomic count
- Product search (DummyJSON + eBay)
- Financial calculations (backend deterministic)
- Cost tracking infrastructure
- Observability infrastructure
- Agent handoff logic
- Task lifecycle
- Approval workflow
- RAG service (with placeholder embeddings)
- MiniAI engine (deterministic + hybrid)
- Workflow engine
- Security middleware (exists but not applied)
- Input sanitization (exists but not applied)

---

## 10. Fake/Mock Features

- DummyJSON as default product source
- MOCK_SUPPLIERS in supplier research
- RAG hash-based embeddings
- MiniAI browser-ML not connected
- Test center uses mock data

---

## 11. Disconnected Features

- Browser ML subsystem (built, zero consumers)
- useAgentStatus hook
- useRealtime hook
- 6 empty component directories
- Sanitization functions
- Prompt injection detection
- Rate limiter (separate from middleware)

---

**Next:** QUALITY_GATE_0.md
