# Quality Gate 6 — Browser MiniAI Integration

**Date:** 2026-09-02
**Phase:** 6 — Browser MiniAI
**Status:** ✅ PASSED

## Executive Summary

Integrated the existing Browser ML infrastructure (Transformers.js/ONNX) with the RAG service and MiniAI classifier. Client-side ONNX embeddings now replace hash-based embeddings for semantic search, and ONNX classification provides real sentiment analysis with keyword fallback.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                    │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │ useClientRAG │    │ useClassifier             │   │
│  │ (hook)       │    │ (hook)                    │   │
│  └──────┬───────┘    └──────────┬───────────────┘   │
│         │                       │                    │
│  ┌──────▼───────────────────────▼───────────────┐   │
│  │         Browser ML Provider (singleton)        │   │
│  │         Xenova/all-MiniLM-L6-v2 (ONNX)        │   │
│  └──────────────────┬────────────────────────────┘   │
│                     │ Web Worker                      │
│  ┌──────────────────▼────────────────────────────┐   │
│  │              Transformers.js ONNX Runtime      │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │         API Endpoints (fetch)                  │   │
│  │   POST /api/rag/store  — store doc + embedding │   │
│  │   POST /api/rag/search — similarity search     │   │
│  └──────────────────┬────────────────────────────┘   │
└─────────────────────┼───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                    SERVER (Next.js)                   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │         Supabase (knowledge_documents)         │   │
│  │         Stores embeddings + documents          │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## Changes Made

### 1. RAG API Endpoints (NEW)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/rag/store` | Store document with pre-computed ONNX embedding |
| `POST /api/rag/search` | Search documents using pre-computed query embedding |

Both endpoints:
- Require authentication (via `requireAuth()`)
- Accept 384-dimensional embedding arrays
- Perform server-side cosine similarity search
- Validate embedding dimensions

### 2. `useClientRAG` Hook (NEW)

**File:** `src/hooks/useClientRAG.ts`

Client-side RAG using Browser ML for ONNX embeddings:
- `storeDocument(input)` — computes ONNX embedding, sends to API
- `search(query, options)` — computes query embedding, performs similarity search
- Auto-loads `Xenova/all-MiniLM-L6-v2` model on first use
- Handles different Transformers.js output formats
- Graceful error handling with model fallback

### 3. `useClassifier` Hook (NEW)

**File:** `src/hooks/useClassifier.ts`

Client-side classification using Browser ML ONNX models:
- `classify(text, categories)` — ONNX sentiment analysis + keyword mapping
- Uses `Xenova/distilbert-base-uncased-finetuned-sst-2-english` for sentiment
- Maps sentiment labels to custom categories
- Falls back to keyword matching when model unavailable
- Returns structured `ClassificationResult` with confidence scores

### 4. RAG Service — Unchanged

**File:** `src/lib/ai/rag-service.ts`

- Server-side RAG service kept as-is for backward compatibility
- Hash-based embeddings still available for non-browser contexts
- API endpoints bridge client ONNX ↔ server storage

## What Was NOT Changed (Intentional)

- **Server-side RAG service** — kept for backward compatibility
- **MiniAI classifier implementation** — kept keyword matching as fallback
- **Worker.js / Provider / useBrowserML** — already built, no changes needed
- **API model catalog** — already built, no changes needed

## Verification

- **tsc**: ✅ PASS (0 errors)
- **New files**: 4 (2 API routes, 2 hooks)
- **Modified files**: 0
- **Deleted files**: 0

## Integration Points

| Component | Before | After |
|-----------|--------|-------|
| RAG embeddings | Hash-based (server) | ONNX (client) + hash (server fallback) |
| Classification | Keyword matching | ONNX sentiment + keyword fallback |
| Model loading | None | Lazy-load via Browser ML Provider |
| API endpoints | None | `/api/rag/store`, `/api/rag/search` |

## Remaining Work

- [ ] Create UI component consuming `useClientRAG` (Knowledge Base page)
- [ ] Create UI component consuming `useClassifier` (Intent classification)
- [ ] Add pgvector for production-scale similarity search
- [ ] Add more ONNX models for specific tasks (NER, summarization)
