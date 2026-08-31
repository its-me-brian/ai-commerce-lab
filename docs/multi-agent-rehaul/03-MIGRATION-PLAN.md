# Plan de Migración por Fases

**Fecha**: 31 Aug 2026
**Regla**: NO pasar a la siguiente fase si la anterior está rota.

## Resumen de fases

### Bloque 1: Foundation (FASE 1-8)

| Fase | Nombre | Archivos | Migración | Tests |
|------|--------|----------|-----------|-------|
| 1 | Company/Workspace | workspaces.ts, workspace API | 013_add_workspaces.sql | ✅ |
| 2 | Agent Registry | agent type, parent_agent_id | 014_add_agent_hierarchy.sql | ✅ |
| 3 | Personality separation | AgentDefinition enhancements | — | ✅ |
| 4 | Provider Manager | ai_providers columns | 015_add_provider_manager.sql | ✅ |
| 5 | Credential Manager | ai_provider_credentials table | 016_add_credentials.sql | ✅ |
| 6 | Connection Test | POST /api/ai/providers/test | — | ✅ |
| 7 | Model Registry | ai_models enhancements | 017_add_model_capabilities.sql | ✅ |
| 8 | Model Capabilities | capabilities matching | — | ✅ |

### Bloque 2: Routing & Tasks (FASE 9-16)

| Fase | Nombre | Archivos | Migración | Tests |
|------|--------|----------|-----------|-------|
| 9 | Agent Model Pool | agent_model_routes | 018_add_model_routes.sql | ✅ |
| 10 | Model Router v2 | router rewrite | — | ✅ |
| 11 | Routing Policies | priority/cheapest/fastest | — | ✅ |
| 12 | Conversation Engine | conversations + messages | 019_add_conversations.sql | ✅ |
| 13 | Direct Agent Chat | Chat UI component | — | ✅ |
| 14 | Task Engine v2 | Task dependencies | 020_add_task_deps.sql | ✅ |
| 15 | Task Dependencies | DAG execution | — | ✅ |
| 16 | Agent-to-Agent | Delegation via tasks | — | ✅ |

### Bloque 3: Agents & Workflows (FASE 17-28)

| Fase | Nombre | Archivos | Migración | Tests |
|------|--------|----------|-----------|-------|
| 17 | Delegation Permissions | permission rules | — | ✅ |
| 18 | Shared Company Context | workspace context builder | — | ✅ |
| 19 | Agent Memory | agent_memory table | 021_add_agent_memory.sql | ✅ |
| 20 | Product Hunter v2 | Multi-agent discovery | — | ✅ |
| 21 | Supplier Workflow | Supplier Research chain | — | ✅ |
| 22 | Supplier Result Contract | Standardized output | — | ✅ |
| 23 | Product Result Contract | Standardized output | — | ✅ |
| 24 | Pricing Engine | Cost + margin + pricing | — | ✅ |
| 25 | Mock vs Real | Source type marking | — | ✅ |
| 26 | CEO Orchestrator v2 | Real orchestration | — | ✅ |
| 27 | CEO Continuity | Context persistence | — | ✅ |
| 28 | Product Launch Workflow | Store + Marketing + Finance | — | ✅ |

### Bloque 4: UI & Production (FASE 29-46)

| Fase | Nombre | Archivos | Migración | Tests |
|------|--------|----------|-----------|-------|
| 29 | Human in the Loop | approvals system | 022_add_approvals.sql | ✅ |
| 30 | Marketing Agent | Marketing workflow | — | ✅ |
| 31 | Marketing Output | Copy, SEO, ads | — | ✅ |
| 32 | Store Builder v2 | Product draft workflow | — | ✅ |
| 33 | Finance Review | Margin validation | — | ✅ |
| 34 | Dashboard v2 | Operations center | — | ✅ |
| 35 | Agents UI | Hierarchical view | — | ✅ |
| 36 | Agent Workspace | Per-agent workspace | — | ✅ |
| 37 | Model Manager UI | Provider/model management | — | ✅ |
| 38 | Model Assignment UI | Agent model pool config | — | ✅ |
| 39 | Test Center | Centralized testing | — | ✅ |
| 40 | Observability | Event logging | 023_add_agent_events.sql | ✅ |
| 41 | Activity Log | Timeline view | — | ✅ |
| 42 | Error Handling | Error boundaries | — | ✅ |
| 43 | Security Review | RLS, auth, permissions | — | ✅ |
| 44 | Frontend Quality | Responsive, a11y, states | — | ✅ |
| 45 | Database Quality | Indexes, constraints | 024_add_indexes.sql | ✅ |
| 46 | E2E Tests | All 10 test scenarios | — | ✅ |

## REGLAS POR FASE

1. Inspeccionar código existente
2. Identificar dependencias
3. Modificar únicamente lo necesario
4. Ejecutar tests
5. Ejecutar TypeScript
6. Ejecutar build
7. Revisar errores
8. Corregir errores
9. Comprobar regresiones
10. Documentar cambios en CHANGELOG.md
11. Solo después continuar

## ESTADO ACTUAL

| Fase | Estado |
|------|--------|
| FASE 0 | ✅ Completada |
| FASE 1 | ✅ Completada |
| FASE 2 | ✅ Completada |
| FASE 3 | ✅ Completada |
| FASE 4 | ✅ Completada |
| FASE 5 | ✅ Completada |
| FASE 6 | ✅ Completada |
| FASE 7 | ✅ Completada |
| FASE 8 | ✅ Completada |
| FASE 9 | ✅ Completada |
| FASE 10 | ✅ Completada |
| FASE 11 | ✅ Completada |
| FASE 12 | ✅ Completada |
| FASE 13 | ✅ Completada |
| FASE 14 | ✅ Completada |
| FASE 15 | ✅ Completada |
| FASE 16 | ✅ Completada |
| FASE 17 | ✅ Completada |
| FASE 18 | ✅ Completada |
| FASE 19 | ✅ Completada |
| FASE 20 | ✅ Completada |
| FASE 21-46 | ⏳ Pendiente |
