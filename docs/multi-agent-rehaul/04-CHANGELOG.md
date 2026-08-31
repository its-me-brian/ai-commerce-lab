# Changelog — Rearquitectura Multi-Agente

**Formato**: Cada entrada incluye fase, fecha, archivos creados/modificados, migraciones, cambios.

---

## FASE 0 — Auditoría

**Fecha**: 31 Aug 2026

### Archivos creados
- `docs/multi-agent-rehaul/00-OVERVIEW.md`
- `docs/multi-agent-rehaul/01-AUDIT.md`
- `docs/multi-agent-rehaul/02-ARCHITECTURE.md`
- `docs/multi-agent-rehaul/03-MIGRATION-PLAN.md`
- `docs/multi-agent-rehaul/04-CHANGELOG.md`
- `docs/multi-agent-rehaul/05-TEST-RESULTS.md`

### Cambios
- Auditoría completa del repositorio
- Documentación de arquitectura actual vs target
- Plan de migración por 46 fases

### Tests
- 83/83 passing (pre-existente)

---

## FASE 1 — Company/Workspace

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/013_add_workspaces.sql` — tabla workspaces con default data
- `src/lib/workspaces/types.ts` — Workspace, WorkspaceInsert, WorkspaceUpdate, CompanyContext
- `src/lib/workspaces/service.ts` — CRUD + buildCompanyContext + formatContextForPrompt
- `src/lib/workspaces/workspace.test.ts` — 9 tests
- `src/app/api/workspaces/route.ts` — GET/POST/PUT endpoints

### Archivos modificados
- `src/lib/database/supabase.ts` — agregados tipos workspaces (Row, Insert, Update)

### Migración
- `013_add_workspaces.sql` — tabla workspaces con default workspace 'ws-default'

### Tests
- 92/92 passing (+9 nuevos)

### Build
- ✅ Green, nueva ruta `/api/workspaces` registrada

---

## FASE 2 — Agent Registry: Hierarchy

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/014_add_agent_hierarchy.sql` — parent_agent_id, agent_type, department, workspace_id columns + seed data + indexes
- `src/lib/agents/core/registry.test.ts` — 24 hierarchy tests

### Archivos modificados
- `src/lib/agents/core/types.ts` — AgentType type + parentAgentId, agentType, department, workspaceId fields in AgentMetadata
- `src/lib/agents/core/registry.ts` — hierarchy queries: getParent, getChildren, getDescendants, getChain, listByType, listByDepartment, listByWorkspace, getRoot, getTree
- `src/lib/database/supabase.ts` — agents table types updated with hierarchy columns
- `src/lib/agents/ceo.ts` — agentType: "executive", department: "executive"
- `src/lib/agents/product-hunter.ts` — agentType: "department", parentAgentId: "ceo", department: "product"
- `src/lib/agents/market-research.ts` — agentType: "specialist", parentAgentId: "product-hunter", department: "product"
- `src/lib/agents/supplier-research.ts` — agentType: "specialist", parentAgentId: "product-hunter", department: "product"
- `src/lib/agents/opportunity-scoring.ts` — agentType: "specialist", parentAgentId: "product-hunter", department: "product"
- `src/lib/agents/store-builder.ts` — agentType: "department", parentAgentId: "ceo", department: "operations"
- `src/lib/agents/marketing.ts` — agentType: "department", parentAgentId: "ceo", department: "marketing"
- `src/lib/agents/secretary.ts` — agentType: "department", parentAgentId: "ceo", department: "operations"
- `src/lib/agents/finance.ts` — agentType: "department", parentAgentId: "ceo", department: "finance"
- `src/lib/agents/core/engine.test.ts` — added agentType to mock agents

### Migración
- `014_add_agent_hierarchy.sql` — adds hierarchy columns, seeds org chart, creates indexes and constraints

### Hierarchy seeded
```
CEO (executive)
├── Product Hunter (department, product)
│   ├── Market Research (specialist, product)
│   ├── Supplier Research (specialist, product)
│   └── Opportunity Scoring (specialist, product)
├── Marketing (department, marketing)
├── Store Builder (department, operations)
├── Secretary (department, operations)
└── Finance (department, finance)
```

### Tests
- 116/116 passing (+24 nuevos)

### Build
- ✅ Green

---

## FASE 3 — Personality Separation

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `src/lib/agents/core/personality-presets.ts` — 6 reusable personality presets + mergePersonalities utility
- `src/lib/agents/core/personality-presets.test.ts` — 15 tests for presets and merge logic

### Archivos modificados
- `src/lib/agents/core/types-agent-definition.ts` — Personality type enhanced with tone, values, constraints, customInstructions
- `src/lib/agents/core/prompt-builder.ts` — Now renders tone, values, constraints; supports customInstructions override; applies workspace personality overrides
- `src/lib/agents/core/prompt-builder.test.ts` — 5 new tests for enhanced personality rendering
- `src/lib/agents/core/engine.ts` — Builds system prompt from AgentDefinition via AgentPromptBuilder, passes it in context
- `src/lib/agents/core/types.ts` — AgentContext now includes systemPrompt and personalityOverrides
- `src/lib/agents/definitions/product-hunter.ts` — Enhanced personality with tone, values, constraints
- `src/lib/workspaces/types.ts` — Workspace type now includes personality_overrides
- `src/lib/database/supabase.ts` — Workspace types updated with personality_overrides
- `src/app/api/workspaces/route.ts` — Workspace create now includes personality_overrides: null
- `src/lib/workspaces/workspace.test.ts` — Mock workspace updated with personality_overrides

### Key changes
- Personality type now supports: tone, values, constraints, customInstructions
- 6 presets: analytical-strict, friendly-creative, strategic-decutive, cautious-methodical, assertive-results, diplomatic-empathetic
- mergePersonalities() applies workspace overrides on top of agent defaults
- AgentPromptBuilder now handles workspace personality overrides via additionalContext
- AgentEngine builds system prompt from definition and passes it in AgentContext
- customInstructions replaces entire personality section when set

### Tests
- 135/135 passing (+19 nuevos)

### Build
- ✅ Green

---

## FASE 4 — Dynamic Provider Manager

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/015_add_provider_manager.sql` — description, api_key_env_var, base_url, capabilities, config columns + seed data
- `src/lib/ai/provider-manager.ts` — ProviderManager service with CRUD, capability queries, config status
- `src/lib/ai/provider-manager.test.ts` — 16 tests for ProviderManager

### Archivos modificados
- `src/lib/ai/types.ts` — AIProviderSlug changed from hardcoded union to dynamic string
- `src/lib/ai/bootstrap.ts` — Now loads providers from DB via ProviderManager, falls back to hardcoded
- `src/lib/database/supabase.ts` — ai_providers types updated with new columns

### Key changes
- AIProviderSlug is now `string` instead of `"gemini" | "anthropic" | "xai"`
- ProviderManager loads providers from DB at startup
- Provider class registry maps slugs to constructors for dynamic registration
- registerProviderClass() allows adding new providers at runtime
- Bootstrap falls back to hardcoded providers if DB unavailable
- Providers now have: description, api_key_env_var, base_url, capabilities, config

### Tests
- 151/151 passing (+16 nuevos)

### Build
- ✅ Green

---

## FASE 5 — Secure Credential Manager

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/016_add_credentials.sql` — ai_provider_credentials table with encryption columns
- `src/lib/ai/encryption.ts` — AES-256-GCM encrypt/decrypt utility
- `src/lib/ai/encryption.test.ts` — 15 tests for encryption roundtrip, tamper detection, edge cases
- `src/lib/ai/credential-manager.ts` — CredentialManager service with secure store/retrieve/list
- `src/lib/ai/credential-manager.test.ts` — 10 tests for CredentialManager

### Archivos modificados
- `src/lib/database/supabase.ts` — ai_provider_credentials types added

### Key changes
- API keys encrypted at rest using AES-256-GCM
- Keys never exposed to browser — only hints returned (e.g., "...1234")
- CredentialManager.store() encrypts before storage
- CredentialManager.retrieve() decrypts on demand
- CredentialManager.getActiveKey() gets key for provider+environment
- CredentialSafe type strips all sensitive fields
- ENCRYPTION_KEY env var required (64 hex chars = 32 bytes)

### Tests
- 176/176 passing (+25 nuevos)

### Build
- ✅ Green

---

## FASE 6 — Provider Connection Test

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `src/lib/ai/provider-test.ts` — ProviderTestService con getProviderStatuses y testProviderConnection
- `src/lib/ai/provider-test.test.ts` — 13 tests
- `src/app/api/ai/providers/route.ts` — GET /api/ai/providers
- `src/app/api/ai/providers/test/route.ts` — POST /api/ai/providers/test

### Key changes
- ProviderTestService orquesta tests usando ProviderManager + CredentialManager
- GET /api/ai/providers retorna estado de cada proveedor (configured, registered, credentialSource)
- POST /api/ai/providers/test prueba conexión con soporte DB credentials y env vars

### Tests
- 189/189 passing (+13 nuevos)

### Commit
- `26f5546`

---

## FASE 7 — Model Registry

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/017_add_model_capabilities.sql` — capabilities TEXT[] + GIN index + seed data
- `src/lib/ai/model-registry.ts` — ModelRegistry con CRUD + capability queries
- `src/lib/ai/model-registry.test.ts` — 18 tests

### Archivos modificados
- `src/lib/database/supabase.ts` — ai_models types con capabilities

### Key changes
- ai_models ahora tiene columna capabilities (TEXT[])
- ModelRegistry: listByCapabilities, listByAnyCapability, hasCapability
- Capabilities reales: vision, json-mode, tool-use, code-generation, reasoning

### Tests
- 207/207 passing (+18 nuevos)

### Commit
- `c5c8318`

---

## FASE 8 — Model Capabilities

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `src/lib/ai/model-matcher.ts` — findBestModel, findSingleBestModel, modelMeetsRequirements, getAvailableCapabilities
- `src/lib/ai/model-matcher.test.ts` — 17 tests

### Key changes
- ModelMatcher selecciona mejor modelo según requirements (capabilities, context window, cost)
- Filtrado estricto: score=0 si no cumple requisitos
- Scoring: 100 base + bonus provider preference

### Tests
- 224/224 passing (+17 nuevos)

### Commit
- `57c72db`

---

## FASE 9 — Agent Model Routes

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/018_add_model_routes.sql` — agent_model_routes table + seed data
- `src/lib/ai/agent-model-routes.ts` — AgentModelRoutes CRUD
- `src/lib/ai/agent-model-routes.test.ts` — 16 tests

### Archivos modificados
- `src/lib/database/supabase.ts` — agent_model_routes types

### Key changes
- Cada agente puede tener múltiples modelos con priority y policy
- Políticas: priority (usa mayor prioridad), cheapest (menor costo), fastest (menor latencia)
- Seed: ProductHunter → Gemini + Claude, CEO → Claude + Gemini, Secretary → cheapest

### Tests
- 240/240 passing (+16 nuevos)

### Commit
- `9517461`

---

## FASE 10 — Model Router v2

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos modificados
- `src/lib/ai/router.ts` — nuevo método generateForAgent()
- `src/lib/ai/router.test.ts` — mocks actualizados

### Key changes
- generateForAgent(agentId, options) carga rutas de DB
- Intenta cada ruta en orden de prioridad, falla al siguiente si error
- Mantene generate() legacy para compatibilidad

### Tests
- 240/240 passing (sin cambios, mocks actualizados)

### Commit
- `bf848d6`

---

## FASE 11 — Routing Policies

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `src/lib/ai/routing-policies.ts` — selectRoute, explainSelection
- `src/lib/ai/routing-policies.test.ts` — 15 tests

### Key changes
- selectRoute() selecciona mejor ruta según policy
- priority: menor número gana
- cheapest: menor costo total (input + output)
- fastest: menor latencia promedio de logs de ejecución
- explainSelection() retorna explicación legible

### Tests
- 255/255 passing (+15 nuevos)

### Commit
- `1155676`

---

## FASE 12 — Conversation Engine

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/019_add_conversations.sql` — conversations + conversation_messages tables
- `src/lib/ai/conversation-engine.ts` — ConversationEngine con CRUD + messages
- `src/lib/ai/conversation-engine.test.ts` — 19 tests

### Key changes
- Conversaciones multi-turn entre usuarios y agentes
- Messages: user, assistant, system con token tracking
- getLastMessages() para contexto de conversación
- getTokenUsage() para resumen de consumo

### Tests
- 274/274 passing (+19 nuevos)

### Commit
- `73bd53b`

---

## FASE 13 — Direct Agent Chat

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `src/lib/ai/agent-chat.ts` — chatWithAgent service
- `src/lib/ai/agent-chat.test.ts` — 6 tests
- `src/app/api/agents/chat/route.ts` — POST /api/agents/chat

### Key changes
- chatWithAgent() crea conversación, agrega mensaje usuario, llama IA, agrega respuesta
- Soporte para continuar conversación existente
- System prompt automático desde AgentDefinition
- POST /api/agents/chat: { agentId, message, conversationId? }

### Tests
- 280/280 passing (+6 nuevos)

### Commit
- `ba1c2a8`

---

## FASE 14 — Task Engine v2

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `supabase/migrations/020_add_task_deps.sql` — depends_on + parent_task_id columns
- `src/lib/ai/task-engine.ts` — TaskEngine con dependencias
- `src/lib/ai/task-engine.test.ts` — 12 tests

### Archivos modificados
- `src/lib/database/supabase.ts` — agent_tasks types con depends_on y parent_task_id

### Key changes
- depends_on: array de task IDs que deben completarse primero
- parent_task_id: tarea padre que creó esta subtask
- areDependenciesMet() verifica si todas las dependencias están completas
- getReadyTasks() retorna tareas pendientes con deps cumplidas

### Tests
- 292/292 passing (+12 nuevos)

### Commit
- `82013c4`

---

## FASE 15 — DAG Executor

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `src/lib/ai/dag-executor.ts` — executeDAG, detectCycles, topologicalSort
- `src/lib/ai/dag-executor.test.ts` — 12 tests

### Key changes
- executeDAG() ejecuta tareas en orden de dependencia, paralelizando independientes
- detectCycles() detecta dependencias circulares
- topologicalSort() retorna orden de ejecución válido

### Tests
- 304/304 passing (+12 nuevos)

### Commit
- `4af0860`

---

## FASE 16 — Agent-to-Agent Delegation

**Fecha**: 31 Aug 2026
**Estado**: ✅ Completada

### Archivos creados
- `src/lib/ai/delegation.ts` — delegateTask, getDelegatedTasks, hasPendingDelegations
- `src/lib/ai/delegation.test.ts` — 8 tests

### Key changes
- delegateTask() crea task asignado a otro agente
- Input incluye _delegatedBy y _delegationTimestamp
- getDelegatedTasks() filtra tareas delegadas
- hasPendingDelegations() verifica si hay tareas pendientes

### Tests
- 312/312 passing (+8 nuevos)

### Commit
- `900892e`

---
