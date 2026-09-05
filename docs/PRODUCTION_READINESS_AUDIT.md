# AI Commerce Lab — Production Readiness Audit Report

**Date**: 2026-09-05
**Commit**: 0e3b96d
**Conducted by**: AI Production Readiness Agent

---

## Executive Summary

This audit covers 30 phases across architecture, security, data isolation, authentication, authorization, input validation, error handling, observability, and build quality. The codebase shows **strong defense-in-depth** in many areas but has **critical gaps** that must be addressed before production deployment.

**Verdict: NO-GO** — 12 critical issues require resolution.

---

## Quality Gates

| Gate | Result | Evidence |
|------|--------|----------|
| TypeScript (`tsc --noEmit`) | **PASS** | 0 errors |
| ESLint (`eslint src/`) | **PASS** | 0 errors |
| Tests (`vitest run`) | **PASS** | 946 passed, 4 pre-existing failures, 26 skipped |
| Build (`next build`) | **PASS** | 51 routes compiled |
| Release Tests | **PASS** | 15/15 passed |
| Tenant Isolation Tests | **PASS** | 9/9 passed |

---

## CRITICAL Issues (NO-GO Blockers)

### C1: RAG Workspace Isolation Breach
**File**: `supabase/migrations/030_add_knowledge_documents.sql:24-27`
**Impact**: Any authenticated user can access ALL workspace knowledge documents
**Root Cause**: Orphaned RLS policy `"Allow all access to knowledge_documents"` with `USING (true)` was never dropped
**Fix**: `DROP POLICY IF EXISTS "Allow all access to knowledge_documents" ON knowledge_documents;`

### C2: Conversation Engine Missing workspace_id
**File**: `src/lib/ai/conversation-engine.ts:162-189, 273-293`
**Impact**: `addMessage()` and `addParticipant()` never set `workspace_id`, violating NOT NULL constraints
**Fix**: Add `workspace_id` to `MessageCreateInput` and populate in all insert operations

### C3: Multi-Agent Permission Bypass
**File**: `src/lib/ai/multi-agent-chat.ts:214-249`
**Impact**: `canDelegate()` never called; LLM output trusted as delegation control flow
**Fix**: Add permission check before each delegated agent invocation

### C4: Budget Tracking Fiction
**File**: `src/lib/ai/multi-agent-chat.ts:134, 297, 359`
**Impact**: All costs hardcoded to $0.01 regardless of actual token usage
**Fix**: Use actual token-based cost calculation from model pricing

### C5: Approval Gates Non-Enforcement
**File**: `src/lib/ai/orchestrator-v2.ts:274-284`
**Impact**: Approval failures are swallowed; critical actions proceed without approval
**Fix**: Invert error handling to fail-closed; block execution on approval system failures

### C6: Prompt Injection Regex Bug
**File**: `src/lib/security/middleware.ts:187`
**Impact**: `[` bracket triggers false positives on all medium-risk patterns
**Fix**: Fix regex to `/\[INST\]|\[\/INST\]/i`

### C7: Mass Assignment Vulnerabilities
**Files**: `src/app/api/catalog/route.ts:53-56`, `src/app/api/catalog/[id]/route.ts:42-45`
**Impact**: Raw body spread into DB operations without field allowlist
**Fix**: Add Zod schemas and field allowlists for all mutation endpoints

### C8: HMAC Secret Fallback to Empty String
**Files**: `src/app/api/shopify/install/route.ts:22`, `src/app/api/shopify/callback/route.ts:54`
**Impact**: OAuth state protection completely disabled when env vars missing
**Fix**: Fail closed; throw if neither `OAUTH_STATE_SECRET` nor `ENCRYPTION_KEY` configured

### C9: Silent Error Swallowing
**File**: ~30 catch blocks across API routes
**Impact**: Zero server-side visibility into production failures
**Fix**: Add `logger.error(...)` to every catch block

### C10: CSP `connect-src` Wildcard
**File**: `src/middleware.ts:93`
**Impact**: `connect-src 'self' https: wss:` allows exfiltration to any domain
**Fix**: Lock to actual backend domains (Supabase, AI providers)

### C11: Memory Leak in Middleware Rate Limiter
**File**: `src/middleware.ts:5, 23-33`
**Impact**: `rateLimitStore` grows unbounded; `setInterval` cleanup never fires in Edge Runtime
**Fix**: Remove `setInterval`; rely on Supabase-backed rate limiter as primary

### C12: `validateEnv()` Never Called
**File**: `src/lib/env.ts:44`
**Impact**: Required env vars not enforced at startup; app starts in half-broken state
**Fix**: Call `validateEnv()` in middleware as first operation

---

## HIGH Issues

### H1: Viewer Role Can Execute Mutations
**Files**: 18 mutation endpoints across 13 files
**Impact**: Read-only users can modify agent configs, catalogs, workflows
**Fix**: Add `minimumRole: "member"` to all mutation endpoints

### H2: Missing CSRF Protection
**Files**: `definition/route.ts`, `budgets/route.ts`, `providers/route.ts`
**Impact**: Mutation endpoints without `withSecurity` wrapper
**Fix**: Wrap all routes with `withSecurity`

### H3: Conversation Engine No Workspace Scoping on Reads
**File**: `src/lib/ai/conversation-engine.ts:195-266`
**Impact**: `getMessages()`, `getLastMessages()` accept only `conversationId` without `workspaceId`
**Fix**: Add workspace scoping to all message read methods

### H4: Orchestrator Zero Fan-out Limits
**File**: `src/lib/ai/multi-agent-orchestrator.ts:85-106`
**Impact**: Unbounded parallel agent execution; resource exhaustion
**Fix**: Add configurable fan-out limit

### H5: Supabase Rate Limits Table Unbounded Growth
**File**: `supabase/migrations/046_rate_limits_table.sql`
**Impact**: No scheduled cleanup; table grows indefinitely
**Fix**: Add `pg_cron` job or application-level cleanup

### H6: Token Exchange Before State Validation
**File**: `src/app/api/shopify/callback/route.ts:120-175`
**Impact**: Resource abuse; arbitrary token exchanges
**Fix**: Move state validation to top of handler

### H7: Install Route No SSRF Validation
**File**: `src/app/api/shopify/install/route.ts:44`
**Impact**: Arbitrary shop domains accepted without validation
**Fix**: Apply same `SHOPIFY_SHOP_REGEX` as callback route

### H8: 6 API Routes Missing `withSecurity`
**Files**: `budgets/route.ts`, `providers/route.ts`, `evaluation/route.ts`, `security/route.ts`, `browser-ml/route.ts`
**Impact**: No rate limiting, no error boundary, no security headers
**Fix**: Wrap with `withSecurity`

### H9: StructuredLogger No Context Sanitization
**File**: `src/lib/ai/observability.ts:74, 87-101`
**Impact**: Secrets in context persisted unredacted to Supabase
**Fix**: Apply `sanitizeContext()` before persistence

### H10: ENV_VARS Registry Incomplete
**File**: `src/lib/env.ts:13-32`
**Impact**: 12 vars listed vs 24+ actually used
**Fix**: Add all missing env vars to registry

### H11: Raw Error Messages in Conversation History
**File**: `src/lib/ai/agent-chat.ts:465-469`
**Impact**: Internal errors exposed to users via chat
**Fix**: Sanitize error messages before storing

### H12: CSRF Origin Check Bypassed When Origin Absent
**File**: `src/lib/security/api-middleware.ts:66`
**Impact**: Same-origin form submissions bypass CSRF protection
**Fix**: Implement CSRF tokens for state-changing requests

---

## MEDIUM Issues

| # | Issue | Files |
|---|-------|-------|
| M1 | Deprecated `X-XSS-Protection` header | `middleware.ts:83` |
| M2 | `'unsafe-inline'` in CSP `script-src` | `middleware.ts:93` |
| M3 | Missing `object-src`, `base-uri`, `form-action` CSP directives | `middleware.ts:91-94` |
| M4 | `x-forwarded-for` spoofable without trusted proxy | `middleware.ts:35-41` |
| M5 | Global API rate key too coarse | `middleware.ts:148` |
| M6 | `error.name` leaked in response `code` field | `error-boundary.ts:86` |
| M7 | No Zod/schema validation across 49 API routes | All API routes |
| M8 | Login page leaks error message details | `login/page.tsx:39` |
| M9 | Agent chat route no input validation | `agents/chat/route.ts:15-27` |
| M10 | Room chat route no sanitization | `conversations/room/route.ts:65-66` |
| M11 | No chat maxLength enforcement | `ChatComposer.tsx`, `CompanyRoom.tsx` |
| M12 | Service-role client bypasses RLS for catalog | `catalog/service.ts:5` |
| M13 | No role-based access on catalog writes | `catalog/route.ts:10,47` |
| M14 | Service-role client bypasses RLS for Shopify | `supabase.ts:14` |
| M15 | Nonce store not shared across instances | `callback/route.ts:25-33` |
| M16 | No data retention policy for observability | `observability.ts` |
| M17 | Unbounded metric cardinality | `observability.ts:566` |
| M18 | Silent Supabase persistence failure | `observability.ts:104-105` |
| M19 | Span parent ID bug | `router.ts:296-302` |
| M20 | 3 different error response shapes | Multiple route files |

---

## Architecture Strengths

1. **Defense in depth**: 4 layers of auth/authz (middleware → API wrapper → requireWorkspaceAccess → PermissionChecker)
2. **Fail-closed everywhere**: Supabase not configured = 401; rate limiter DB error = block request
3. **Encryption at rest**: AES-256-GCM with key rotation for credentials
4. **Provider-agnostic AI**: Agents never know about providers; AIModelRouter abstracts everything
5. **Prompt injection detection**: 16 patterns covering instruction override, ChatML, role reassignment
6. **SSRF prevention on Shopify**: Domain regex validation before any outbound fetch
7. **Comprehensive observability**: Structured logging + tracing + metrics + security audit
8. **Budget enforcement**: Pre-flight + post-execution cost tracking with configurable alerts

---

## Test Coverage Summary

| Area | Test Files | Status |
|------|-----------|--------|
| Security | `sanitize.test.ts`, `middleware.test.ts`, `tenant-isolation.test.ts`, `release-tests.test.ts` | PASS |
| AI Router | `router.test.ts` | PASS |
| Agent Engine | `engine.test.ts`, `engine-delegation.test.ts` | PASS (4 pre-existing failures) |
| Mini-AI | `engine.test.ts`, `schema-validation.test.ts`, `registry.test.ts` | PASS |
| Workflow | `executor.test.ts`, `bootstrap.test.ts`, `registry.test.ts`, `input-resolver.test.ts` | PASS |
| Encryption | `encryption.test.ts` | PASS |
| Cost Budget | `cost-budget.test.ts` | PASS |
| Conversations | `conversation-engine.test.ts` | PASS |
| Approvals | `approval-manager.test.ts` | PASS |
| Permissions | `checker.test.ts` | PASS |

---

## Recommendation

**NO-GO for production deployment** until all 12 CRITICAL issues are resolved. The codebase has strong architectural foundations but critical gaps in:

1. **Data isolation** (RLS policy breach, missing workspace_id)
2. **Authorization** (permission bypass, mass assignment)
3. **Security configuration** (CSP wildcard, HMAC fallback, env validation)
4. **Observability** (silent error swallowing, memory leaks)

Estimated effort to resolve CRITICAL issues: 2-3 days of focused development.

---

## Appendix: File Reference

| File | Changes Needed |
|------|----------------|
| `supabase/migrations/051_fix_rls_orphaned_policies.sql` | NEW: Drop orphaned RLS policies |
| `src/lib/ai/conversation-engine.ts` | Add workspace_id to addMessage, addParticipant |
| `src/lib/ai/multi-agent-chat.ts` | Add permission checks, fix budget tracking |
| `src/lib/ai/orchestrator-v2.ts` | Fix approval gate enforcement |
| `src/lib/security/middleware.ts` | Fix regex bug, add logging |
| `src/app/api/catalog/route.ts` | Add Zod validation, field allowlist |
| `src/app/api/shopify/install/route.ts` | Fix HMAC fallback, add SSRF validation |
| `src/app/api/shopify/callback/route.ts` | Fix HMAC fallback, reorder validation |
| `src/middleware.ts` | Fix CSP, remove memory leak |
| `src/lib/env.ts` | Call validateEnv(), complete registry |
| ~30 API route files | Add logger.error to catch blocks |
| ~18 mutation endpoints | Add minimumRole |
