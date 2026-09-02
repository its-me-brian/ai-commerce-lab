# Quality Gate 6.5 — Token-Saving MiniAI Pipeline

**Date:** 2026-09-02
**Phase:** 6.5 — Token Optimization
**Status:** ✅ PASSED

## Executive Summary

MiniAI now acts as a **real filter before the LLM**, saving tokens through three mechanisms:
1. **Fast-path**: Simple intents (greetings, thanks) get canned responses — zero LLM tokens
2. **History compression**: Older messages summarized, recent ones kept verbatim
3. **Prompt pruning**: Irrelevant sections removed based on detected intent

## Architecture: Before vs After

### Before (MiniAI adds tokens)
```
Mensaje → MiniAI (+50-200 tokens) → LLM (recibe todo) → Respuesta
```

### After (MiniAI saves tokens)
```
Mensaje → MiniAI clasifica → ¿Fast-path? → SÍ: respuesta directa (0 tokens LLM)
                                        │
                                        NO → Comprime historial (-50% tokens)
                                           → Poda secciones irrelevantes (-20-40%)
                                           → LLM (solo lo necesario)
```

## Token Savings Estimates

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| "Hola" (greeting) | ~2000 tokens | 0 tokens | **100%** |
| "Gracias" (thanks) | ~2000 tokens | 0 tokens | **100%** |
| Question with 20 msg history | ~4000 tokens | ~1500 tokens | **62%** |
| Task request | ~3000 tokens | ~2000 tokens | **33%** |
| Product inquiry | ~3000 tokens | ~2500 tokens | **17%** |

## Changes Made

### 1. `prompt-pipeline.ts` — Token-Saving Pipeline

**New features:**
- `FAST_PATH_INTENTS` — intents that skip LLM entirely
- `GREETING_PATTERNS`, `THANKS_PATTERNS`, `GOODBYE_PATTERNS` — regex detection
- `FAST_PATH_RESPONSES` — pre-computed responses by intent + agent
- `generateFastPathResponse()` — returns response without LLM
- `compressHistory()` — summarizes old messages, keeps recent verbatim
- `prunePromptByIntent()` — removes irrelevant sections
- `estimateTokens()` — naive but fast token counting
- `PipelineResult.canAnswerWithoutLLM` — flag for fast-path
- `PipelineResult.fastPathResponse` — pre-computed response
- `PipelineResult.tokenSavings` — savings info

**Modified functions:**
- `preprocessMessage()` — now checks fast-path before returning
- `buildEnrichedPrompt()` — now accepts conversation history, compresses it, prunes by intent

### 2. `agent-chat.ts` — Fast-Path Integration

**New flow:**
```typescript
// 6. MiniAI preprocessing
const pipelineResult = await preprocessMessage({...});

// FAST-PATH: Skip LLM if possible
if (pipelineResult.canAnswerWithoutLLM) {
  // Save response directly — zero LLM tokens
  return { conversation, userMessage, assistantMessage };
}

// Normal path: optimized prompt for LLM
enrichedSystemPrompt = buildEnrichedPrompt(basePrompt, pipelineResult, messages);
```

## Fast-Path Responses

| Intent | Agent | Response |
|--------|-------|----------|
| greeting | default | "¡Hola! ¿En qué puedo ayudarte?" |
| greeting | ceo | "¡Hola! Soy el CEO. ¿Qué necesitas?" |
| greeting | store-builder | "¡Hola! Estoy listo para construir tu tienda..." |
| thanks | * | "¡De nada! ¿En qué más puedo ayudarte?" |
| goodbye | * | "¡Hasta luego! Que tengas un buen día." |

## Verification

- **tsc**: ✅ PASS (0 errors)
- **Modified files**: 2 (`prompt-pipeline.ts`, `agent-chat.ts`)
- **New functionality**: Fast-path, history compression, prompt pruning, token estimation
- **Backward compatible**: If fast-path doesn't match, falls through to normal LLM flow

## What's NOT Included (Future Work)

- Real tokenizer (tiktoken) instead of naive `text.length / 4`
- Response caching in router (same prompt → cached response)
- pgvector for production-scale similarity search
- More fast-path patterns (FAQ matching, common questions)
