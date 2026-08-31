# FASE 0 — Auditoría Completa

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

## CURRENT ARCHITECTURE

### Database (9 tablas)

| Tabla | Propósito | FK Relationships |
|-------|-----------|------------------|
| `ai_providers` | Proveedores de IA | → ai_models (1:N) |
| `ai_models` | Modelos de IA | → ai_providers (N:1) |
| `agents` | Definición de agentes | → agent_configs (1:1), agent_tasks (1:N), agent_runs (1:N), agent_permissions (1:N), agent_skills (N:N) |
| `agent_configs` | Config de provider/model por agente | → agents, ai_providers, ai_models |
| `agent_tasks` | Tareas ejecutadas | → agents, agent_runs (1:N) |
| `agent_runs` | Ejecuciones individuales de LLM | → agent_tasks, agents |
| `agent_permissions` | Permisos RBAC por agente | → agents |
| `skills` | Habilidades disponibles | → agent_skills (1:N) |
| `agent_skills` | Relación agente↔skill | → agents, skills |

### Agentes (9 implementados)

| Agente | Código | Definición | Estado | Modelo |
|--------|--------|------------|--------|--------|
| CEO | ✅ | ✅ | ❌ coming_soon | gemini-3-flash |
| Product Hunter | ✅ | ✅ | ✅ ready | gemini-3-flash |
| Market Research | ✅ | ❌ | ⚠️ ready | gemini-3-flash |
| Supplier Research | ✅ | ❌ | ⚠️ ready | gemini-3-flash |
| Opportunity Scoring | ✅ | ❌ | ⚠️ ready | gemini-3-flash |
| Store Builder | ✅ | ✅ | ❌ coming_soon | gemini-3-flash |
| Marketing | ✅ | ✅ | ❌ coming_soon | gemini-3-flash |
| Secretary | ✅ | ✅ | ❌ coming_soon | gemini-3-flash |
| Finance | ✅ | ✅ | ❌ coming_soon | gemini-3-flash |

### AI Providers

| Provider | Slug | Env Var | Estado |
|----------|------|---------|--------|
| Google Gemini | `gemini` | GEMINI_API_KEY | ✅ Habilitado |
| Anthropic Claude | `anthropic` | ANTHROPIC_API_KEY | ❌ Deshabilitado |
| xAI Grok | `xai` | XAI_API_KEY | ❌ Deshabilitado |

### Tools

| Tool | Agente que lo usa |
|------|-------------------|
| `search_products` | Product Hunter |
| `calculate_margin` | Product Hunter, Finance |

### Frontend (7 rutas)

| Ruta | Tipo | Propósito |
|------|------|-----------|
| `/` | Static | Landing page |
| `/dashboard` | Server | KPIs + Activity |
| `/dashboard/agents` | Server | Lista de agentes |
| `/dashboard/agents/[id]` | Client | Detalle + config + test |
| `/dashboard/models` | Server | Modelos de IA |
| `/dashboard/runs` | Server | Historial de ejecuciones |
| `/dashboard/runs/[id]` | Server | Detalle de ejecución |
| `/dashboard/settings` | Server | Variables de entorno |

### API (7 endpoints)

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| POST | `/api/agents/run` | Ejecutar agente |
| GET | `/api/agents/config` | Obtener config de agente |
| PUT | `/api/agents/config` | Guardar config de agente |
| GET | `/api/agents/history` | Historial de tareas |
| POST | `/api/agents/product-hunter/run` | Legacy endpoint |
| GET | `/api/tools/sources` | Fuentes de productos |
| POST | `/api/ai/test` | Test de conexión |

## GAPS CRÍTICOS

1. **Sin workspace/company** — todo es global, sin multi-tenant
2. **Sin conversaciones** — no hay chat history
3. **Sin jerarquía de agentes** — no existe `parent_agent_id`
4. **Sin dependencias de tasks** — tasks son planas, sin DAG
5. **Sin approvals** — no hay human-in-the-loop
6. **Sin memoria de agentes** — cada task empieza de cero
7. **Sin model pool por agente** — relación 1:1 con config
8. **Router demasiado simple** — solo primary/fallback
9. **AIProviderSlug cerrado** — agregar proveedor = cambiar código
10. **AgentPromptBuilder no usado** — cada agente hardcodea prompts
11. **Permission conditions sin enforcement** — definidas pero no aplicadas
12. **RLS inseguro** — `USING(true)` para todo
13. **Zero indexes** — más allá de PKs/FKs
14. **Sin auth** — dashboard abierto

## LO QUE SE PUEDE REUTILIZAR

- ✅ AgentEngine (10-step task flow)
- ✅ ToolRegistry (extensible)
- ✅ AIModelRouter (base para enhancement)
- ✅ PermissionChecker (con enhancement para conditions)
- ✅ Agent base class + AgentDefinition types
- ✅ 9 implementaciones de agentes
- ✅ 13 migraciones existentes
- ✅ 83 tests

## LO QUE DEBE CAMBIAR

- `AIProviderSlug` → dinámico desde DB
- `agent_configs` → `agent_model_routes` (1:N)
- `agents` → agregar `parent_agent_id`, `agent_type`, `workspace_id`
- `agent_tasks` → agregar `parent_task_id`, `conversation_id`, `assigned_by`
- Router → capabilities matching, cost routing, persistence
- CEO → orchestrator real
- Frontend → chat UI, task management, approvals
