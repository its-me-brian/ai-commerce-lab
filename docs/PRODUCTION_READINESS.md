# PRODUCTION READINESS — AI Commerce Lab V1

> Auditoría base generada desde código fuente (no documentación).
> Fecha: 2026-09-03

---

## 0. RESUMEN EJECUTIVO

| Área | Estado | Bloqueador |
|------|--------|------------|
| TypeScript | ✅ Compila limpio | — |
| Tests | ✅ 947/953 pasan, 0 failures | — |
| Build | ✅ Build exitoso (Next.js 16 Turbopack) | — |
| ESLint | ⚠️ 31 errores, 110 warnings | No bloqueante |
| Auth | ⚠️ Dev mode abierto sin ALLOW_DEV_AUTH | MEDIUM |
| Tenancy/RLS | 🔴 RLS abierto — `USING (true)` en todas las tablas | **BLOCKER** |
| API Routes | 🔴 Solo 1/42 usa `requireWorkspaceAccess` | **BLOCKER** |
| Ollama | 🔴 Provider + imports presentes | HIGH |
| DummyJSON/FakeStore | 🔴 Hardcoded como fallback de producción | HIGH |
| placehold.co | 🔴 URLs placeholder en generate-image | MEDIUM |
| Credential Vault | ⚠️ No workspace-scoped | HIGH |
| Frontend Nav | ⚠️ 12 items en nav (demasiado) | MEDIUM |
| Build Vercel | ✅ Build exitoso | — |

### VEREDICTO: **NOT PRODUCTION READY**

---

## 1. AUTH — Estado Actual

### Funciones disponibles (`src/lib/auth/api-auth.ts`):

| Función | Propósito |
|---------|-----------|
| `getAuthUser(request)` | Extrae usuario de Supabase session via cookies |
| `requireAuth(request)` | Gate de autenticación: retorna `{user}` o `{error: 401}` |
| `requireWorkspaceAccess(request, options?)` | Gate de autorización: retorna `{user, workspaceId, role}` o `{error: 403}` |
| `hasPermission(role, permission)` | Función pura: verifica si un rol tiene un permiso |
| `requirePermission(role, permission)` | Wrapper: retorna `{allowed}` o `{error: 403}` |

### Problemas encontrados:

1. **Dev user sin gate real**: `requireAuth` en dev mode retorna `{ id: "local-dev", email: "dev@localhost" }` siempre que Supabase no esté configurado. La función `isDevAuthAllowed()` existe pero **nunca se invoca** — el fallback en línea 95 siempre ejecuta.

2. **`ws-default` como fallback**: `requireWorkspaceAccess` usa `"ws-default"` como workspaceId cuando no se especifica. Auto-onboarda usuarios nuevos como owner de `ws-default`.

3. **No verificación de membership real**: En dev mode, retorna `{role: "owner"}` sin consultar DB.

### Middleware (`src/middleware.ts`):

- ✅ Security headers (nosniff, DENY, XSS protection, referrer policy)
- ✅ Rate limiting por IP (120 req/min general, 10 para test endpoints)
- ✅ Bloqueo de paths sospechosos (.env, .git, wp-admin)
- ✅ Auth check via Supabase session refresh
- ⚠️ In-memory rate limiter (se pierde en restart de Vercel)
- ⚠️ `cleanupInterval` puede mantener el proceso vivo

---

## 2. DATABASE — Inventario de Tablas

### Tablas con `workspace_id`:

| Tabla | workspace_id | Nullable | FK workspaces | RLS |
|-------|-------------|----------|---------------|-----|
| `workspaces` | N/A (es la tabla) | — | — | ⚠️ `USING (true)` |
| `workspace_members` | ✅ NOT NULL | NO | ✅ CASCADE | ✅ RLS real |
| `agents` | ✅ | Sí | ✅ | ⚠️ `USING (true)` |
| `conversations` | ✅ | Sí | ✅ | ⚠️ `USING (true)` |
| `agent_memory` | ✅ | Sí | ✅ | ⚠️ `USING (true)` |
| `product_catalog` | ✅ | Sí | ✅ | ⚠️ `USING (true)` |
| `knowledge_documents` | ✅ | NOT NULL | ❌ sin FK | ⚠️ `USING (true)` |

### Tablas SIN `workspace_id` (scoping incorrecto):

| Tabla | Propósito | ¿Debería ser workspace-scoped? |
|-------|-----------|-------------------------------|
| `agent_configs` | Configuración por agente | **SÍ** — cada workspace configura sus modelos |
| `agent_model_routes` | Rutas agente→modelo | **SÍ** — cada workspace asigna sus rutas |
| `agent_tasks` | Tareas background | **SÍ** — las tareas pertenecen al workspace |
| `agent_runs` | Logs de invocaciones LLM | **SÍ** — cada workspace tiene sus runs |
| `agent_permissions` | Permisos de agentes | SÍ |
| `ai_provider_credentials` | Credenciales encriptadas | **SÍ** — workspace-scoped vault |
| `structured_logs` | Logs estructurados | **SÍ** |
| `metrics` | Métricas | **SÍ** |
| `traces` | Traces de operaciones | **SÍ** |
| `spans` | Spans dentro de traces | **SÍ** |
| `cost_budgets` | Presupuestos | **SÍ** |
| `cost_records` | Registros de costos | **SÍ** |
| `approvals` | Aprobaciones pendientes | **SÍ** |
| `task_events` | Eventos de tareas | **SÍ** |
| `app_events` | Eventos de aplicación | SÍ |

### Tablas correctamente globales:

| Tabla | Razón |
|-------|-------|
| `ai_providers` | Definiciones de providers — compartidas |
| `ai_models` | Definiciones de modelos — compartidas |
| `agent_definitions` | Definiciones de agentes — compartidas |
| `skills` | Skills del sistema — compartidas |
| `agent_skills` | Mapeo agente→skill — compartido |
| `workflow_definitions` | Workflows — compartidos |

---

## 3. RLS — PROBLEMA CRÍTICO

### Migración 034: Reemplazó TODAS las políticas reales con `USING (true)`

```sql
-- ANTES (migration 001): Service role bypass
CREATE POLICY "Service role full access" ON agents FOR ALL USING (true);

-- DESPUÉS (migration 034): Authenticated = full access
CREATE POLICY "Authenticated users can read agents" ON agents FOR SELECT TO authenticated USING (true);
```

**Resultado**: CADA usuario autenticado puede:
- Ver TODOS los agentes de TODOS los workspaces
- Ver TODAS las conversaciones de TODOS los workspaces
- Ver TODOS los catálogos de TODOS los workspaces
- Ver TODOS los costos de TODOS los workspaces
- Ver TODOS los logs de TODOS los workspaces
- Modificar datos que no le pertenecen

### Excepción: `workspace_members` (migration 037)

La tabla `workspace_members` SÍ tiene RLS real con 4 policies correctas:
- SELECT: solo membresías propias
- INSERT: solo owner/admin
- UPDATE: solo owner/admin
- DELETE: solo owner

### Excepción: `ai_provider_credentials` (migration 034)

Credentials eliminó la policy de authenticated — solo service role puede acceder. **Correcto.**

---

## 4. API ROUTES — Inventario de Auth

### Patrones encontrados:

| Patrón | Rutas que lo usan | Seguro? |
|--------|-------------------|---------|
| `requireWorkspaceAccess` | 1 ruta (`agents/list`) | ✅ pero usa service role client |
| `requireAuth` solamente | ~35 rutas | ⚠️ Sin workspace check |
| Sin auth | 1 ruta (`health`) | ✅ Es pública |

### Crítico — Todas las rutas usan service-role client:

```typescript
// Patrón actual en casi todas las rutas:
import { supabase } from "@/lib/database/supabase"; // service role
const { data } = await supabase.from("table").select("*"); // bypasses RLS
```

**Ninguna ruta usa el request-scoped client** (`supabase-request.ts`) que respeta RLS.

### Rutas que necesitan `requireWorkspaceAccess`:

| Ruta | Auth actual | Necesita |
|------|-------------|----------|
| `/api/agents/chat` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/agents/[id]` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/agents/[id]/memory` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/agents/[id]/handoffs` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/agents/[id]/approvals` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/agents/[id]/events` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/conversations` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/conversations/[id]/messages` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/catalog` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/catalog/[id]` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/ceo/orchestrate` | `requireAuth` | `requireWorkspaceAccess` |
| `/api/ai/providers` | `requireAuth` | `requireAuth` (global) |
| `/api/ai/models` | `requireAuth` | `requireAuth` (global) |
| `/api/settings/credentials` | `requireWorkspaceAccess` | ✅ Ya correcto |
| `/api/settings/models` | `requireWorkspaceAccess` | ✅ Ya correcto |
| `/api/settings/routes` | `requireWorkspaceAccess` | ✅ Ya correcto |
| `/api/settings/members` | `requireWorkspaceAccess` | ✅ Ya correcto |
| `/api/settings/providers/test` | `requireWorkspaceAccess` | ✅ Ya correcto |

---

## 5. AI PROVIDER ARCHITECTURE

### Providers existentes (`src/lib/ai/providers/`):

| Provider | Archivo | Estado |
|----------|---------|--------|
| Gemini | `gemini.ts` | ✅ Activo |
| Claude | `claude.ts` | ⚠️ Inactivo por defecto |
| Grok | `grok.ts` | ⚠️ Inactivo por defecto |
| OpenAI-compatible | `openai-compatible.ts` | ✅ Genérico |
| Ollama | `ollama.ts` | 🔴 **DEBE ELIMINARSE** |
| Workers AI | `workers-ai.ts` | ⚠️ Inactivo |

### Cadena de resolución actual:

```
process.env[GEMINI_API_KEY] → bootstrap → registerProvider → router
```

### Problema: No usa Credential Vault

El bootstrap actual depende de `process.env` para resolver API keys:

```typescript
// src/lib/ai/bootstrap.ts
const apiKey = process.env[provider.api_key_env_var];
```

El Credential Vault (`credential-manager.ts`) existe pero no está integrado en la cadena de resolución del router.

### Credential Manager:

- Encriptación: AES-256-GCM vía `ENCRYPTION_KEY` env var
- Almacenamiento: tabla `ai_provider_credentials`
- **No workspace-scoped** — todas las credentials son globales

---

## 6. AGENTS

### Agentes definidos en DB (migration 001):

| ID | Nombre | Estado |
|----|--------|--------|
| `product-hunter` | Product Hunter | ready |
| `store-builder` | Store Builder | development |
| `marketing` | Marketing Agent | development |
| `secretary` | Secretary Agent | development |
| `finance` | Finance Agent | development |
| `ceo` | CEO Agent | development |

### Agent Definitions (migration 026):

Tabla `agent_definitions` — definiciones detalladas desde DB.

### CEO como orquestador:

- Archivo: `src/lib/agents/ceo.ts`
- Usa tools para interactuar con el sistema
- Tools acceden a DB directamente
- **No tiene `ToolExecutionContext` con workspaceId**
- **Puede recibir datos de cualquier workspace** (sin aislamiento)

---

## 7. CONVERSATIONS

### Tablas:
- `conversations` — salas/direct conversations
- `conversation_messages` — mensajes
- `conversation_participants` — participantes

### Problemas:
- Sin workspace-scoping real
- `workspace_id` es nullable
- RLS abierto (`USING (true)`)

---

## 8. OBSERVABILITY

### Tablas (migration 033):
- `structured_logs`
- `metrics`
- `traces`
- `spans`
- `cost_budgets`
- `cost_records`

### Estado:
- ✅ Tablas creadas con índices
- ✅ Retención auto-cleanup (30 días)
- 🔴 Sin `workspace_id` — datos mezclados entre workspaces
- 🔴 RLS abierto (`USING (true)`)

---

## 9. FRONTEND

### Nav actual (12 items):

```
Workspace | Dashboard | Agents | Catalog | Runs | Tasks | Approvals | Models | Test Center | Observability | Activity | Settings
```

### Nav propuesto V1 (8 items):

```
Workspace | Dashboard | Agents | Catalog | Runs | Approvals | Observability | Settings
```

### Páginas duplicadas:
- `/workspace/settings` duplica `/dashboard/settings`
- `/workspace/agents/[id]` duplica `/dashboard/agents/[id]`
- `/dashboard/models` debería ser tab dentro de Settings
- `/dashboard/tasks` debería ser tab dentro de Runs
- `/dashboard/budgets` debería ser tab dentro de Settings
- `/dashboard/security` debería ser tab dentro de Settings
- `/dashboard/activity` debería merge en Observability
- `/dashboard/evaluation` debería merge en Observability
- `/dashboard/test-center` debería ocultarse de nav principal

---

## 10. MOCKS / DATOS FALSOS

### Encontrados en código fuente:

| Patrón | Ubicación | Acción requerida |
|--------|-----------|-----------------|
| `MOCK_SUPPLIERS` | `src/lib/tools/search-suppliers.ts` | Eliminar o mover a test/ |
| `dummyjson` fallback | `src/lib/tools/search-products.ts`, `ceo.ts`, `product-hunter.ts` | Eliminar fallback |
| `fakestore` source | `src/lib/tools/search-products.ts` | Mantener solo en test/ |
| `placehold.co` URLs | `src/lib/tools/generate-image.ts` | Reemplazar con UNKNOWN |
| `minCost \|\| 10` | (buscar) | Reemplazar con UNKNOWN |
| Ollama provider | `src/lib/ai/providers/ollama.ts` | Eliminar |
| Ollama bootstrap | `src/lib/ai/bootstrap.ts` | Eliminar |

---

## 11. ENVIRONMENT VARIABLES

### Requeridas (`.env.local.example`):

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
ANTHROPIC_API_KEY
XAI_API_KEY
```

### Faltantes en .env.local.example:
```
ENCRYPTION_KEY (para credential vault)
NEXT_PUBLIC_SUPABASE_URL (para client-side)
NEXT_PUBLIC_SUPABASE_ANON_KEY (para client-side)
QWEN_API_KEY
DEEPSEEK_API_KEY
```

### Variables de Ollama que deben eliminarse:
```
OLLAMA_BASE_URL
```

---

## 12. BLOCKERS CRÍTICOS

### BLOCKER-1: RLS abierto (Fase 1)
**Todas las tablas workspace-scoped permiten a CUALQUIER usuario autenticado ver TODOS los datos.**
Impacto: Cualquier usuario puede ver credenciales, costos, conversaciones de otros workspaces.

### BLOCKER-2: API Routes sin workspace auth (Fase 1)
**Solo 1 de 42 rutas verifica workspace access.** Las demás confían en `requireAuth` + service-role client.
Impacto: Un usuario autenticado puede acceder a datos de cualquier workspace conociendo IDs.

### BLOCKER-3: Ollama en producción (Fase 0)
**Provider Ollama sigue registrado en bootstrap.** Si `OLLAMA_BASE_URL` está configurado, el sistema intentará usarlo.
Impacto: Error silencioso o fallback a provider no deseado.

### BLOCKER-4: DummyJSON/FakeStore como fallback (Fase 6)
**El Product Hunter usa DummyJSON como source por defecto.** No hay source real configurada.
Impacto: Datos falsos en producción parecen datos reales.

---

## 13. RIESGOS

| Riesgo | Severidad | Descripción |
|--------|-----------|-------------|
| Credential leakage entre workspaces | HIGH | Sin RLS, cualquier usuario puede ver credenciales |
| IDOR en API routes | HIGH | Sin workspace check, IDs suffician para acceder |
| Datos financieros expuestos | HIGH | Costos y budgets visibles por todos |
| Conversaciones expuestas | HIGH | Mensajes de otros workspaces visibles |
| Dev user en producción | MEDIUM | `local-dev` puede activarse sin ALLOW_DEV_AUTH |
| Rate limiter in-memory | LOW | Se pierde en restart de Vercel (aceptable para V1) |
