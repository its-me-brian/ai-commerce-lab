# Arquitectura Target

**Fecha**: 31 Aug 2026

## VISIÓN

```
                     👤 USUARIO
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
      👑 CEO CHAT                CHAT DIRECTO
           │                 con cualquier agente
           │
           ▼
      TASK ENGINE
           │
  ┌────────┼─────────┬───────────┐
  │        │         │           │
  ▼        ▼         ▼           ▼
HUNTER  STORE   MARKETING   SECRETARY
  │
  ├── Market Research
  ├── Supplier Research
  └── Opportunity Scoring
         │
       FINANCE
```

## TABLAS TARGET

### Nuevas tablas

| Tabla | Propósito |
|-------|-----------|
| `workspaces` | Empresa del usuario — contexto compartido |
| `conversations` | Sesiones de chat con agentes |
| `messages` | Mensajes de conversaciones (user/assistant/system/tool/agent) |
| `approvals` | Human-in-the-loop para acciones críticas |
| `agent_events` | Audit log de actividad |
| `agent_memory` | Memoria estructurada por agente |

### Tablas modificadas

| Tabla | Cambios |
|-------|---------|
| `agents` | + `parent_agent_id`, + `agent_type` (executive/department/specialist), + `workspace_id`, + `avatar_url`, + `display_order` |
| `agent_tasks` | + `parent_task_id`, + `conversation_id`, + `assigned_by`, + `depends_on` (JSONB array) |
| `ai_providers` | + `protocol` (native/openai-compatible), + `base_url`, + `metadata` |
| `ai_models` | + `capabilities` (JSONB array), + `metadata` |
| `agent_configs` | Eliminar → reemplazar por `agent_model_routes` |

### Tablas nuevas (FASE posterior)

| Tabla | Propósito |
|-------|-----------|
| `agent_model_routes` | Model pool por agente con prioridades |
| `tool_definitions` | Registry de tools disponibles |
| `prompt_templates` | Prompts reutilizables y versionables |

## MODELO DE DATOS

### Workspaces

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target_country TEXT DEFAULT 'ES',
  currency TEXT DEFAULT 'EUR',
  target_customer TEXT,
  brand_voice TEXT,
  target_margin DECIMAL(5,2) DEFAULT 3.0,
  supplier_countries JSONB DEFAULT '[]',
  business_rules JSONB DEFAULT '{}',
  approval_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Conversations

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Messages

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool', 'agent')),
  content TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Agent Model Routes

```sql
CREATE TABLE agent_model_routes (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  model_id TEXT NOT NULL REFERENCES ai_models(id),
  priority INTEGER DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  task_types JSONB DEFAULT '[]',
  required_capabilities JSONB DEFAULT '[]',
  max_cost DECIMAL(10,6),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Approvals

```sql
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES agent_tasks(id),
  conversation_id TEXT REFERENCES conversations(id),
  requested_by TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Agent Events (Audit Log)

```sql
CREATE TABLE agent_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES agent_tasks(id),
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Agent Memory

```sql
CREATE TABLE agent_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.0,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, workspace_id, category, key)
);
```

## FLUJO DE EJECUCIÓN

### Chat directo

```
USER → message → Conversation Engine → Agent → Router → Model → Response → User
                                    ↓
                              Task created (if needed)
                                    ↓
                              Run persisted
```

### CEO Orchestration

```
USER → "Dame 2 productos" → CEO
  CEO → interpreta
  CEO → crea Task #1 (assigned: Product Hunter)
    Hunter → delega Task #2 (Market Research)
    Hunter → delega Task #3 (Supplier Research)
    Hunter → delega Task #4 (Opportunity Scoring)
    Market Research → completa Task #2
    Supplier Research → completa Task #3
    Opportunity Scoring → completa Task #4
    Hunter → resume resultados
    Hunter → completa Task #1
  CEO → revisa
  CEO → presenta al USER
  CEO → solicita aprobación (si aplica)
```

### Model Router

```
Agent → Router
  1. Obtener agent_model_routes para el agente
  2. Filtrar enabled = true
  3. Filtrar por capabilities requeridas
  4. Filtrar por max_cost si aplica
  5. Ordenar por priority
  6. Ejecutar primero
  7. Si falla → siguiente en prioridad
  8. Registrar resultado (fallback_used, duration, cost)
```

## PRINCIPIOS DE DISEÑO

1. **AGENT ≠ MODEL** — El agente es el trabajador, el modelo es el motor
2. **Separación de responsabilidades** — Agent, Personality, Role, Skills, Tools, Memory, Model, Provider, Credential, Routing, Task, Conversation
3. **Extensibilidad** — Nuevo agente = crear en DB + asignar modelo + asignar tools
4. **Trazabilidad** — Toda tarea responde: quién, qué modelo, qué tools, qué resultado, quién aprobó
5. **Seguridad** — Credenciales server-side, RLS real, permisos granulares
