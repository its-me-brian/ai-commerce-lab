# AI Commerce Lab — Auditoría V1 Completa

**Fecha**: 2 Sep 2026  
**Auditor**: Opencode (Senior Architect)  
**Alcance**: Código completo, frontend, backend, APIs, base de datos, componentes, mocks, tipos

---

## RESUMEN EJECUTIVO

El proyecto tiene una **base sólida** pero con **deuda técnica significativa**. Todos los API routes son funcionales, los 5 providers de AI funcionan, el Agent Engine es completo, y la persistencia en Supabase funciona. Sin embargo, hay **17 componentes muertos**, **tipos TypeScript sin usar**, **datos hardcodeados en Test Center**, **subsistencias en memoria que pierden datos al reiniciar**, y **inconsistencias en el esquema de BD**.

### Estado General

| Categoría | Estado | Detalle |
|-----------|--------|---------|
| API Routes (31) | ✅ REAL | Todas funcionales, zero stubs |
| AI Providers (5) | ✅ REAL | Gemini, Claude, Grok, Ollama, Workers AI |
| Agent Engine | ✅ REAL | Pipeline completo con Supabase |
| AI Model Router | ✅ REAL | Primary/fallback, métricas |
| Conversation Engine | ✅ REAL | Persistencia en Supabase |
| 9 Agentes | ✅ REAL | Todos con execute() real |
| 32 Migraciones | ✅ REAL | Tablas funcionales |
| Tools (5) | ✅ REALES | calculate-margin, search-products, etc |
| Frontend Pages (18) | ⚠️ PARCIAL | 1 funcional, 1 con mocks, layouts inconsistentes |
| Componentes (33) | ⚠️ PARCIAL | 17 muertos, duplicates |
| TypeScript Types | ⚠️ PARCIAL | 893 líneas definidas pero NUNCA pasadas al cliente Supabase |
| MiniAI/ONNX | ❌ FALTA | Solo server-side, no browser inference |
| Tests | ⚠️ PARCIAL | 879 tests, 3 fallan por env vars |

---

## MATRIZ DE AUDITORÍA POR MÓDULO

### Backend Core

| Módulo | Estado | Notas |
|--------|--------|-------|
| AgentEngine | ✅ REAL | 10-step pipeline, Supabase persistence |
| AIModelRouter | ✅ REAL | Primary/fallback chain, telemetry |
| ConversationEngine | ✅ REAL | CRUD + messages + participants |
| AgentRegistry | ✅ REAL | 9 agents registered |
| ToolRegistry | ✅ REAL | 5 tools |
| PermissionChecker | ✅ REAL | RBAC + explicit |
| PromptBuilder | ✅ REAL | Identity + personality + rules |
| OrchestratorV2 | ✅ REAL | LLM intent classification |
| PlanBuilder | ✅ REAL | Dynamic plan building |
| WorkflowExecutor | ✅ REAL | DAG execution |
| MiniAIEngine | ✅ REAL | 6 implementations (server-side) |
| ApprovalManager | ✅ REAL | Human-in-the-loop |
| AgentMemory | ✅ REAL | Facts/decisions/preferences |
| CostBudget | ⚠️ IN-MEMORY | Pierde datos al reiniciar |
| Observability | ⚠️ IN-MEMORY | Logs, traces, métricas en memoria |
| Evaluation | ⚠️ IN-MEMORY | Scores en memoria |
| SecurityAudit | ⚠️ IN-MEMORY | Eventos de seguridad en memoria |

### AI Providers

| Provider | Estado | API Real | Notas |
|----------|--------|----------|-------|
| Gemini | ✅ WORKING | generativelanguage.googleapis.com | API key en query param |
| Claude | ✅ WORKING | api.anthropic.com | x-api-key header |
| Grok | ✅ WORKING | api.x.ai | Bearer token |
| Ollama | ✅ WORKING | localhost:11434 | Local inference |
| Workers AI | ✅ WORKING | api.cloudflare.com | Edge AI |

### Database

| Tabla | TS Types | Migration | Estado |
|-------|----------|-----------|--------|
| ai_providers | ✅ | 001+015 | Working |
| ai_models | ✅ | 001+017 | Working |
| agents | ✅ | 001+005+011+014 | Working |
| agent_configs | ✅ | 001 | Working |
| agent_tasks | ✅ | 001+012+020 | Working |
| agent_runs | ✅ | 001+012+029 | Working |
| agent_permissions | ✅ | 005 | Working |
| skills | ✅ | 011 | Working |
| agent_skills | ✅ | 011 | Working |
| workspaces | ✅ | 013 | Working |
| ai_provider_credentials | ✅ | 016 | Working |
| agent_model_routes | ✅ | 018 | Working |
| conversations | ✅ | 019+031 | Working |
| conversation_messages | ✅ | 019 | Working |
| conversation_participants | ❌ | 031 | Types missing |
| agent_memory | ❌ | 021 | Types missing |
| task_events | ❌ | 022 | Types missing |
| approvals | ❌ | 023 | Types missing |
| app_events | ❌ | 024 | Types missing |
| agent_definitions | ❌ | 026 | Types missing |
| product_catalog | ❌ | 027 | Types missing |
| workflow_definitions | ❌ | 028 | Types missing |
| tool_usage_tracking | ❌ | 029 | Types missing |
| knowledge_documents | ❌ | 030 | Types missing |

### Frontend Pages

| Página | Estado | Datos | APIs | Responsive |
|--------|--------|-------|------|------------|
| Dashboard | ✅ REAL | Supabase server-side | 12 queries | ✅ |
| Agents List | ✅ REAL | Supabase | 4 queries | ✅ |
| Agent Detail | ✅ REAL | APIs | 7+ endpoints | ⚠️ 2-col grid sin collapse |
| Test Center | ⚠️ MOCK | Hardcoded agents | APIs ignoradas | ⚠️ 2-col grid |
| Models | ✅ REAL | APIs | providers/models | ✅ |
| Runs | ✅ REAL | Supabase | server-side | ❌ Table sin responsive |
| Settings | ✅ REAL | env vars | none | ✅ |
| Catalog | ✅ REAL | APIs | catalog CRUD | ⚠️ Detail panel |
| Observability | ✅ REAL | APIs | events | ⚠️ Stats inline |
| Evaluation | ✅ REAL | APIs | evaluation | ⚠️ Stats inline |
| Budgets | ✅ REAL | APIs | budgets | ❌ Table sin responsive |
| Security | ✅ REAL | APIs | security | ✅ |
| Activity | ✅ REAL | APIs | events | ✅ |
| Workspace | ✅ REAL | APIs | agents/chat | ✅ Full responsive |
| Workspace Settings | ✅ REAL | APIs | workspaces | ✅ |
| Workspace Agent | ✅ REAL | APIs | 4 endpoints | ✅ |

### Componentes

| Componente | Usado | Estado |
|------------|-------|--------|
| chat/CompanyRoom.tsx | ✅ | REAL — multi-agent chat |
| chat/ChatContainer.tsx | ✅ | REAL — persistence |
| chat/ChatComposer.tsx | ✅ | REAL |
| chat/MessageList.tsx | ✅ | REAL |
| chat/MessageBubble.tsx | ✅ | REAL |
| agents/OrgChart.tsx | ✅ | REAL — accordion |
| agents/AgentCard.tsx | ⚠️ | Solo tipo importado |
| agents/AgentSelector.tsx | ❌ | MUERTO |
| chat/ConversationList.tsx | ❌ | MUERTO |
| ui/MetricCard.tsx | ❌ | MUERTO |
| ui/Avatar.tsx | ❌ | MUERTO |
| ui/Modal.tsx | ❌ | MUERTO |
| ui/Tabs.tsx | ❌ | MUERTO |
| ui/Select.tsx | ❌ | MUERTO |
| ui/Input.tsx | ❌ | MUERTO |
| workspace/CEOOrchestrationPanel.tsx | ❌ | MUERTO |
| workspace/WorkspaceLayout.tsx | ❌ | MUERTO |
| workspace/OperationCard.tsx | ❌ | MUERTO |
| products/ProductSearchPanel.tsx | ❌ | MUERTO |
| products/ProductCard.tsx | ❌ | MUERTO |
| tasks/TaskList.tsx | ❌ | MUERTO |
| tasks/TaskCard.tsx | ❌ | MUERTO |
| approvals/ApprovalCard.tsx | ❌ | MUERTO |
| activity/ActivityFeed.tsx | ❌ | MUERTO |

### API Routes

| Route | Estado | Real Supabase | Real AI | Error Handling |
|-------|--------|---------------|---------|----------------|
| POST /api/agents/chat | ✅ | ✅ | ✅ | ✅ |
| POST /api/agents/run | ✅ | ✅ | ✅ | ✅ EXCELENTE |
| GET /api/agents/list | ✅ | ✅ | - | ✅ |
| GET/PUT /api/agents/config | ✅ | ✅ | - | ✅ |
| GET /api/agents/history | ✅ | ✅ | - | ✅ |
| GET /api/agents/[id]/events | ✅ | ✅ | - | ⚠️ |
| GET /api/agents/[id]/handoffs | ✅ | ✅ | - | ⚠️ |
| GET /api/agents/[id]/approvals | ✅ | ✅ | - | ⚠️ |
| GET /api/agents/[id]/memory | ✅ | ✅ | - | ⚠️ |
| CRUD /api/agents/[id]/model-routes | ✅ | ✅ | - | ✅ EXCELENTE |
| GET /api/conversations | ✅ | ✅ | - | ✅ |
| GET /api/conversations/direct | ✅ | ✅ | - | ✅ |
| GET/POST /api/conversations/room | ✅ | ✅ | ✅ POST | ✅ |
| GET /api/conversations/[id]/messages | ✅ | ✅ | - | ✅ |
| POST /api/products/search | ✅ | Via chat | ✅ | ✅ |
| POST /api/ceo/orchestrate | ✅ | Via chat | ✅ | ✅ |
| GET /api/tasks | ✅ | ✅ | - | ✅ |
| GET/POST /api/events | ✅ | ✅ | - | ✅ |
| CRUD /api/catalog | ✅ | ✅ | - | ✅ |
| GET/PATCH /api/ai/models | ✅ | ✅ | - | ✅ |
| GET/PATCH /api/ai/providers | ✅ | ✅ | - | ✅ |
| POST /api/ai/providers/test | ✅ | ✅ | ✅ | ✅ |
| POST /api/ai/test | ✅ | ✅ | ✅ | ✅ |
| GET /api/ai/security | ⚠️ | In-memory | - | ✅ |
| GET /api/ai/observability | ⚠️ | In-memory | - | ✅ |
| GET/POST /api/ai/budgets | ⚠️ | In-memory | - | ✅ |
| GET /api/ai/evaluation | ⚠️ | In-memory | - | ✅ |
| CRUD /api/workspaces | ✅ | ✅ | - | ✅ |
| GET /api/tools/sources | ✅ | env vars | - | ❌ |

---

## PROBLEMAS ENCONTRADOS

### CRÍTICOS

1. **Tipos TypeScript muertos**: La interfaz `Database` de 893 líneas NUNCA se pasa a `createClient<Database>()`. Todo el tipado de Supabase es inútil.

2. **Test Center hardcodeado**: `fetchAgents()` llama a 2 APIs pero IGNORA los resultados y usa datos hardcodeados.

3. **Esquema drift**: `tool_usage_tracking`, `conversation_participants` existen en BD pero no en tipos TS. `agent_runs.tools_used` se referencia en código pero no existe en migración.

4. **Enum mismatch**: `agent_definitions` usa `draft/active/disabled/archived` en BD pero `ready/coming_soon/development/disabled` en TypeScript.

### IMPORTANTES

5. **17 componentes muertos**: Nunca importados, ocupan espacio y confunden.

6. **Subsistencias en memoria**: Observability, Budgets, Evaluation, SecurityAudit pierden todos los datos al reiniciar el servidor.

7. **Self-fetch frágil**: `products/search` y `ceo/orchestrate` usan `request.url.replace()` para llamar endpoints hermanos. Frágil si cambia la URL.

8. **Supabase client inconsistente**: 3 patrones diferentes de creación de cliente en server components.

9. **Missing try/catch**: 5 API routes sin manejo de errores adequado.

10. **Non-atomic message count**: `conversation-engine.ts` hace read-modify-write sin transacción (race condition).

### MENORES

11. **Dead import**: `ceo/orchestrate` importa `supabase` pero nunca lo usa.

12. **Duplicate provider test**: `/api/ai/test` y `/api/ai/providers/test` hacen lo mismo con código diferente.

13. **StatusDot duplicado**: Definido en 4 lugares diferentes.

14. **AgentRecord duplicado**: Definido en 3 archivos diferentes.

15. **formatTime() duplicado**: En al menos 6 archivos.

16. **AGENT_COLORS duplicado**: En workspace/page.tsx y CompanyRoom.tsx con formatos diferentes.

17. **Runs table sin responsive**: HTML `<table>` sin manejo mobile.

18. **2-col grids sin collapse**: Agent detail y Test Center usan `1fr 1fr` sin breakpoint mobile.

---

## COMPONENTES MUERTOS (17)

| # | Archivo | Razón |
|---|---------|-------|
| 1 | components/ui/MetricCard.tsx | Zero imports |
| 2 | components/ui/Avatar.tsx | Zero imports |
| 3 | components/ui/Modal.tsx | Zero imports |
| 4 | components/ui/Tabs.tsx | Zero imports |
| 5 | components/ui/Select.tsx | Zero imports |
| 6 | components/ui/Input.tsx | Zero imports |
| 7 | components/agents/AgentCard.tsx | Función nunca renderizada |
| 8 | components/agents/AgentSelector.tsx | Zero imports |
| 9 | components/chat/ConversationList.tsx | Zero imports |
| 10 | components/workspace/CEOOrchestrationPanel.tsx | Zero imports |
| 11 | components/workspace/WorkspaceLayout.tsx | Zero imports |
| 12 | components/workspace/OperationCard.tsx | Zero imports |
| 13 | components/products/ProductSearchPanel.tsx | Zero imports |
| 14 | components/products/ProductCard.tsx | Zero imports |
| 15 | components/tasks/TaskList.tsx | Zero imports |
| 16 | components/tasks/TaskCard.tsx | Zero imports |
| 17 | components/approvals/ApprovalCard.tsx | Zero imports |
| 18 | components/activity/ActivityFeed.tsx | Zero imports |

---

## CÓDIGO DUPLICADO

| Elemento | Archivos | Problema |
|----------|----------|----------|
| StatusDot | dashboard/page.tsx, agents/page.tsx, OrgChart.tsx, ui/StatusDot.tsx | 4 definiciones |
| AgentRecord | AgentCard.tsx, workspace/page.tsx, OrgChart.tsx | 3 definiciones |
| AGENT_COLORS | workspace/page.tsx, CompanyRoom.tsx | 2 formatos diferentes |
| formatTime() | CompanyRoom, ConversationList, OperationCard, TaskCard, ApprovalCard, MessageBubble | 6 copias |
| WorkspaceLayout | components/workspace/WorkspaceLayout.tsx, app/workspace/layout.tsx | 2 versiones (1 muerta) |

---

## DATA FLOW REAL

```
USER → Workspace → ChatComposer → POST /api/agents/chat
  → chatWithAgent()
    → ConversationEngine.createMessage()
    → AgentEngine.executeTask()
      → AgentRegistry.get()
      → PermissionChecker
      → Supabase: INSERT agent_tasks
      → Agent.execute()
        → AIModelRouter.generate()
          → Provider.generate() (Gemini/Claude/Grok/Ollama/WorkersAI)
      → Supabase: INSERT agent_runs
      → Supabase: UPDATE agent_tasks
    → Supabase: INSERT conversation_messages
  → Response → MessageList → UI
```

---

## DECISIONES ARQUITECTÓNICAS CONFIRMADAS

1. **MiniIAs = Servicios locales/cliente** — NO agentes LLM independientes
2. **Transformers.js + ONNX Runtime Web** — ejecución en navegador
3. **all-MiniLM-L6-v2 cuantizado (~23MB)** — modelo inicial
4. **Lazy loading** — descargar bajo demanda, no al iniciar
5. **Web Worker** — no bloquear thread principal
6. **Fallback** — si MiniAI falla, sistema sigue funcionando
7. **NO Ollama en Vercel** — las MiniIAs corren en el browser
8. **AI Model Router** para agentes principales — MiniIAs solo auxilian

---

## PLAN DE ACCIÓN (ORDEN)

### FASE A: Auditoría ✅ (este documento)
### FASE B: Base de datos y persistencia
- Corregir tipos TypeScript (pasar Database al cliente)
- Agregar tipos faltantes (10 tablas)
- Corregir enum mismatch
- Agregar tablas faltantes a tipos

### FASE C: Agent Engine
- Verificar pipeline completo
- Corregir non-atomic message count

### FASE D: AI Router
- Verificar fallback chain
- Consolidar endpoints de test duplicados

### FASE E: Conversation Engine
- Verificar persistencia end-to-end
- Corregir race condition

### FASE F: Workspace
- Verificar chat multiagente
- Mejorar UX

### FASE G: Agent Profiles
- Editar display_name desde frontend
- Persistir cambios

### FASE H: Tasks/Runs
- Verificar persistencia
- Conectar frontend

### FASE I: MiniAI/ONNX
- Implementar BrowserMiniAIProvider
- Transformers.js + ONNX Runtime
- Web Worker
- Lazy loading + cache

### FASE J: Test Center
- Reemplazar datos hardcodeados con API real
- Conectar con agentes reales

### FASE K: Observability
- Persistir en Supabase (no solo memoria)

### FASE L: Frontend cleanup
- Eliminar 17 componentes muertos
- Consolidar código duplicado
- Arreglar responsive

### FASE M: Testing
- Typecheck limpio
- Build limpio
- Tests pasando

### FASE N: Vercel deploy
- Verificar .env.example
- Verificar build
- Smoke test
