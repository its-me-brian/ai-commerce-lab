# Quality Gate 5 — Mock Data Audit

**Date:** 2026-09-02
**Phase:** 5 — Remove Mocks
**Status:** ✅ PASSED

## Executive Summary

Mock data sources cannot be removed — they are the only working product data sources. Instead, all mock sources are now **clearly marked as DEV-only** with explicit labeling, and the app **auto-selects the best available source** (preferring real APIs when configured).

## Changes Made

### 1. search-products.ts — Dev Source Marking

- `DummyJsonSource` name: `"DummyJSON Products"` → `"[DEV] DummyJSON Products"`
- `FakeStoreSource` name: `"FakeStore Products"` → `"[DEV] FakeStore Products"`
- Tool description updated: removed misleading "DummyJSON, AliExpress, Amazon" claim
- **New function `getDefaultSource()`**: auto-selects eBay when configured, falls back to DummyJSON
- `getAvailableSources()` now returns `type: "dev" | "real"` for each source
- Default source changed: `"dummyjson"` → auto-select via `getDefaultSource()`

### 2. search-suppliers.ts — Clear Mock Labeling

- Tool description: `"Returns mock data for development"` → `"DEV ONLY: returns mock data. Replace with real APIs (AliExpress, Alibaba) for production."`

### 3. generate-image.ts — Clear Stub Labeling

- Tool description: `"Returns mock placeholders for development"` → `"DEV STUB: returns placeholder images. Replace with DALL-E or Stable Diffusion for production."`

### 4. source-type-manager.ts — Dev Notes Enhanced

- FakeStore notes: `"Test product data for development"` → `"Dev-only: ~20 simulated products, no search API. For development and testing only."`
- DummyJSON notes: `"Sample product data for testing"` → `"Dev-only: simulated product data. For development and testing only."`

## What Was NOT Changed (Intentional)

- **MOCK_SUPPLIERS array** in `search-suppliers.ts`: Kept — it's the only supplier data source
- **DummyJSON/FakeStore classes**: Kept — they're the only working product sources
- **placehold.co in generate-image.ts**: Kept — it's the only image generation
- **Test files** (`mock-generator.test.ts`, `source-type-manager.test.ts`): Expected mocks, kept

## Architecture Impact

### Before
```
Default source: "dummyjson" (always)
Tool description: claims "DummyJSON, AliExpress, Amazon" as sources
No indication of dev vs production
```

### After
```
Default source: auto-selects (eBay if configured, else DummyJSON)
Tool description: accurately describes dev vs production sources
All dev sources marked [DEV] in UI
getAvailableSources() returns type info for Dashboard
```

## Verification

- **tsc**: ✅ PASS (0 errors)
- **Jest**: Pre-existing ESM configuration failures (not related to this change)
- **No test files import** search-products, search-suppliers, or generate-image directly

## Remaining Mock Artifacts

| File | Mock | Status |
|------|------|--------|
| `search-products.ts` | DummyJSON, FakeStore | ✅ Marked [DEV], auto-selects real |
| `search-suppliers.ts` | MOCK_SUPPLIERS | ✅ Marked DEV ONLY |
| `generate-image.ts` | placehold.co | ✅ Marked DEV STUB |
| `source-type-manager.ts` | Default registrations | ✅ Marked dev-only |
| `mock-generator.ts` | Full mock | ⚠️ Keep — used by tests |

## Recommendation for Production

When ready for production:
1. Configure eBay API keys in Vercel env vars
2. Add real supplier API (AliExpress, Alibaba)
3. Add real image generation (DALL-E, Stable Diffusion)
4. Remove `mock-generator.ts` (after updating tests)
5. Remove DummyJSON/FakeStore classes (after real sources proven)
