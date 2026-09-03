# AI Commerce Lab

Multi-agent AI platform for e-commerce automation. Built with Next.js 15, Supabase, and 5 AI providers.

## Architecture

```
User → Workspace → General Room → @mention routing
                ↓
        MiniAI Preprocessing (intent/entities)
                ↓
        Prompt Builder → AI Router → LLM Provider
                ↓
        Agent Response → Supabase → Persist → Reload
```

**9 AI Agents**: CEO, Product Hunter, Market Research, Supplier Research, Opportunity Scoring, Store Builder, Marketing, Finance, Secretary

**5 AI Providers**: Google Gemini, Anthropic Claude, xAI Grok, Ollama (local), Workers AI (Cloudflare)

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Database**: Supabase (PostgreSQL + RLS)
- **AI**: Multi-provider router with fallback chain
- **ML**: Transformers.js + ONNX Runtime Web (browser-side, optional)
- **Testing**: Vitest

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

Required variables:
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `GEMINI_API_KEY` — Google Gemini API key (or any other provider)

### 3. Set up database

Run the Supabase migrations in order:

```bash
supabase db push
```

Migrations create: agents, agent_configs, conversations, conversation_messages, agent_runs, agent_tasks, ai_providers, ai_models, model_routes, and more.

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/                    # 31 API routes
│   │   ├── agents/             # Agent CRUD, chat, config
│   │   ├── conversations/      # Message persistence
│   │   ├── ai/                 # Router, providers, budgets
│   │   └── mini-ai/            # Browser ML endpoints
│   ├── dashboard/              # Admin dashboard (11 pages)
│   └── workspace/              # User workspace (chat + agents)
├── lib/
│   ├── ai/
│   │   ├── router.ts           # AI Router (primary + fallback)
│   │   ├── bootstrap.ts        # Provider + agent initialization
│   │   ├── agent-chat.ts       # Direct chat flow
│   │   ├── multi-agent-chat.ts # §8 Multi-agent fan-out
│   │   ├── prompt-pipeline.ts  # §28 MiniAI → prompt enrichment
│   │   ├── conversation-engine.ts # Message persistence
│   │   └── mini-ai/            # MiniAI engine + browser ML
│   ├── agents/
│   │   └── core/               # AgentEngine, registry, types
│   └── database/               # Supabase clients
├── components/
│   ├── chat/                   # ChatContainer, CompanyRoom, MessageBubble
│   ├── agents/                 # AgentCard, OrgChart
│   └── ui/                     # Shared UI components
└── hooks/
    └── useAgentStatus.ts       # §35 Real-time agent status
```

## Key Features

### Multi-Agent Chat (§8, §14)
- **@mention routing**: `@marketing create a campaign` → only Marketing responds
- **Fan-out mode**: No @mention → CEO coordinates, delegates to relevant agents
- Each agent's response saved as separate message with role badge

### MiniAI Prompt Pipeline (§28, §29)
- Intent classification before LLM call
- Entity extraction (products, URLs, numbers, dates)
- Enriched system prompts with detected context

### Real-Time Agent Status (§35)
- Status derived from actual activity (last run, errors)
- States: working, online, idle, warning, error, disabled
- Auto-refreshes every 30 seconds

### Tasks & Approvals
- **Task tracking**: Monitor agent tasks with status, priority, and cost
- **Approval workflow**: Human-in-the-loop for critical actions (product listings, price changes, supplier orders)
- Dashboard pages for managing tasks and approvals

### Observability (§22)
- Structured logs, metrics, traces persisted to Supabase
- 6 dedicated tables with RLS policies
- Dashboard with event log, runs, and cost tracking

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents/list` | GET | List all agents from Supabase |
| `/api/agents/[id]` | GET/PATCH | Agent profile + updates |
| `/api/agents/chat` | POST | Direct chat with agent |
| `/api/agents/[id]/approvals` | GET | Get agent approvals |
| `/api/conversations/room` | GET/POST | Room chat (multi-agent) |
| `/api/tasks` | GET | List tasks with filters |
| `/api/ai/providers/test` | POST | Test provider connectivity |
| `/api/ai/budgets` | GET/POST | Cost budget management |
| `/api/events` | GET | Observability events |
| `/api/catalog` | GET | Product catalog |
| `/api/health` | GET | System health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `GEMINI_API_KEY` | No* | Google Gemini API key |
| `ANTHROPIC_API_KEY` | No* | Anthropic Claude API key |
| `XAI_API_KEY` | No* | xAI Grok API key |
| `EBAY_CLIENT_ID` | No | eBay Browse API (product source) |
| `EBAY_CLIENT_SECRET` | No | eBay Browse API secret |

*At least one AI provider key is required.

## Deploy

Push to GitHub → Vercel auto-deploys. Ensure environment variables are set in Vercel dashboard.

```bash
git push origin main
```

## License

Private — AI Commerce Lab
