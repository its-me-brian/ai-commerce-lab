# ROUTE INVENTORY — AI Commerce Lab

> Generado desde código fuente. Fecha: 2026-09-03

---

## Frontend Routes

| Route | Propósito | Keep | Merge | Redirect | Remove |
|-------|-----------|------|-------|----------|--------|
| `/` | Landing page | ✅ | — | — | — |
| `/login` | Login | ✅ | — | — | — |
| `/signup` | Signup | ✅ | — | — | — |
| `/workspace` | Workspace main | ✅ | — | — | — |
| `/workspace/agents/[id]` | Agent detail (workspace) | — | → `/dashboard/agents/[id]` | ✅ | — |
| `/workspace/settings` | Settings (workspace) | — | → `/dashboard/settings` | ✅ | — |
| `/dashboard` | Dashboard overview | ✅ | — | — | — |
| `/dashboard/agents` | Agent list | ✅ | — | — | — |
| `/dashboard/agents/[id]` | Agent Lab | ✅ | — | — | — |
| `/dashboard/catalog` | Product catalog | ✅ | — | — | — |
| `/dashboard/runs` | Runs list | ✅ | Tasks → tab | — | — |
| `/dashboard/runs/[id]` | Run detail | ✅ | — | — | — |
| `/dashboard/approvals` | Pending approvals | ✅ | — | — | — |
| `/dashboard/observability` | Observability hub | ✅ | Activity + Evaluation → tabs | — | — |
| `/dashboard/settings` | Settings (unified) | ✅ | — | — | — |
| `/dashboard/models` | Models (duplicado) | — | → Settings tab | ✅ | — |
| `/dashboard/tasks` | Tasks (duplicado) | — | → Runs tab | ✅ | — |
| `/dashboard/budgets` | Budgets (duplicado) | — | → Settings tab | ✅ | — |
| `/dashboard/security` | Security (duplicado) | — | → Settings tab | ✅ | — |
| `/dashboard/activity` | Activity (duplicado) | — | → Observability tab | ✅ | — |
| `/dashboard/evaluation` | Evaluation (duplicado) | — | → Observability tab | ✅ | — |
| `/dashboard/test-center` | Test center (dev) | — | — | — | Ocultar de nav |

---

## API Routes

### Agents

| Route | Methods | Auth | Workspace Check | withSecurity |
|-------|---------|------|-----------------|-------------|
| `/api/agents` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/list` | GET | requireWorkspaceAccess | ✅ | ❌ |
| `/api/agents/chat` | POST | requireAuth | ❌ | ❌ |
| `/api/agents/config` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/history` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/activity` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/run` | POST | requireAuth | ❌ | ❌ |
| `/api/agents/[id]` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/[id]/memory` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/[id]/handoffs` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/[id]/approvals` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/[id]/events` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/[id]/model-routes` | GET,POST,PATCH,DELETE | requireAuth | ❌ | ❌ |
| `/api/agents/[id]/definition` | GET | requireAuth | ❌ | ❌ |
| `/api/agents/product-hunter/run` | POST | requireAuth | ❌ | ❌ |

### Settings

| Route | Methods | Auth | Workspace Check | withSecurity |
|-------|---------|------|-----------------|-------------|
| `/api/settings/credentials` | GET,POST,DELETE | requireWorkspaceAccess | ✅ | ✅ |
| `/api/settings/models` | GET,POST,PATCH,DELETE | requireWorkspaceAccess | ✅ | ✅ |
| `/api/settings/routes` | GET,POST,PATCH,DELETE | requireWorkspaceAccess | ✅ | ✅ |
| `/api/settings/members` | GET,POST,PATCH,DELETE | requireWorkspaceAccess | ✅ | ✅ |
| `/api/settings/providers/test` | POST | requireWorkspaceAccess | ✅ | ✅ |

### AI

| Route | Methods | Auth | Workspace Check | withSecurity |
|-------|---------|------|-----------------|-------------|
| `/api/ai/providers` | GET,PATCH | requireAuth | ❌ (global) | ❌ |
| `/api/ai/models` | GET,PATCH | requireAuth | ❌ (global) | ❌ |
| `/api/ai/security` | GET | requireAuth | ❌ | ❌ |
| `/api/ai/evaluation` | GET | requireAuth | ❌ | ❌ |
| `/api/ai/observability` | GET | requireAuth | ❌ | ❌ |
| `/api/ai/budgets` | GET | requireAuth | ❌ | ❌ |
| `/api/ai/providers/test` | POST | requireAuth | ❌ | ❌ |

### Conversations

| Route | Methods | Auth | Workspace Check | withSecurity |
|-------|---------|------|-----------------|-------------|
| `/api/conversations` | GET,POST | requireAuth | ❌ | ❌ |
| `/api/conversations/room` | GET | requireAuth | ❌ | ❌ |
| `/api/conversations/direct` | GET | requireAuth | ❌ | ❌ |
| `/api/conversations/[id]/messages` | GET,POST | requireAuth | ❌ | ❌ |

### Other

| Route | Methods | Auth | Workspace Check | withSecurity |
|-------|---------|------|-----------------|-------------|
| `/api/catalog` | GET,POST | requireAuth | ❌ | ❌ |
| `/api/catalog/[id]` | GET,PATCH,DELETE | requireAuth | ❌ | ❌ |
| `/api/workflows` | GET,POST | requireWorkspaceAccess | ✅ | ✅ |
| `/api/workspaces` | GET,POST | requireAuth | ❌ | ❌ |
| `/api/ceo/orchestrate` | POST | requireAuth | ❌ | ❌ |
| `/api/health` | GET | None (public) | — | ❌ |
| `/api/events` | GET,POST | requireAuth | ❌ | ❌ |
| `/api/tasks` | GET | requireAuth | ❌ | ❌ |
| `/api/products/search` | GET | requireAuth | ❌ | ❌ |
| `/api/catalog` | GET,POST | requireAuth | ❌ | ❌ |
| `/api/tools/sources` | GET | requireAuth | ❌ | ❌ |
| `/api/rag/search` | POST | requireAuth | ❌ | ❌ |
| `/api/rag/store` | POST | requireAuth | ❌ | ❌ |
| `/api/mini-ai/browser-ml` | POST | requireAuth | ❌ | ❌ |

---

## Resumen de Cambios Requeridos

| Cambio | Cantidad | Fase |
|--------|----------|------|
| Agregar `requireWorkspaceAccess` a rutas | ~20 rutas | Fase 1 |
| Agregar `withSecurity` a rutas mutables | ~15 rutas | Fase 1-2 |
| Redirect de rutas duplicadas | 7 redirects | Fase 9 |
| Ocultar de nav principal | 1 página | Fase 9 |
| Merge en tabs | 5 páginas | Fase 9 |
