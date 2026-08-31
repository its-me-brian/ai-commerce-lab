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
