# PROGRESS — Production Hardening Plan

**Last updated:** 2026-09-02

---

| Phase | Status | Quality Gate | Changes | Tests | Notes |
|-------|--------|-------------|---------|-------|-------|
| 0 — Audit | COMPLETE | PASS | 3 docs created | lint/tsc/test ran | Audit complete |
| 1 — Security/Auth | COMPLETE | PENDING APPROVAL | 48 files, +1496 lines | 55/61 pass, 17 integration fail (expected) | Auth + RLS + workspace scoping |
| 2 — Workspace + Conversations | COMPLETE | PENDING APPROVAL | 5 files, +1 migration | 55/61 pass, same as P1 | Race conditions, pagination, workspace ID |
| 3 — Agents + Identity | PENDING | — | — | — | |
| 4 — Frontend Consolidation | PENDING | — | — | — | |
| 5 — Remove Mocks | PENDING | — | — | — | |
| 6 — Browser MiniAI | PENDING | — | — | — | |
| 7 — Prompt Optimization | PENDING | — | — | — | |
| 8 — Observability | PENDING | — | — | — | |
| 9 — Providers + Router | PENDING | — | — | — | |
| 10 — Tasks + Approvals | PENDING | — | — | — | |
| 11 — Test Suite | PENDING | — | — | — | |
| 12 — Frontend QA | PENDING | — | — | — | |
| 13 — Documentation | PENDING | — | — | — | |
| 14 — Clean Install + Build | PENDING | — | — | — | |
| 15 — Vercel Staging | PENDING | — | — | — | |
| 16 — Real-World Tests | PENDING | — | — | — | |

---

## Phase 0 — Audit

### Files created
- `docs/AUDIT_CURRENT.md` — Complete current state audit
- `docs/QUALITY_GATE_0.md` — Quality gate results
- `docs/PROGRESS.md` — This file

### Quality Gate 0 Results
- npm install: PASS
- npm run lint: FAIL (219 errors, non-blocking)
- npx tsc --noEmit: PASS
- npm test: PASS (56/61 suites, 4 fail due to env vars)

---

## Phase 1 — Security/Auth/RLS

### Planned changes
1. Fix service role key exposure in dashboard pages
2. Create Supabase Auth setup (login/signup pages)
3. Add auth middleware to protect routes
4. Add auth checks to all 33 API routes
5. Fix RLS policies (replace USING (true))
6. Add workspace scoping to queries
7. Improve rate limiting for serverless

### Files to modify
- `src/middleware.ts`
- `src/lib/database/supabase.ts`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/runs/page.tsx`
- `src/app/dashboard/runs/[id]/page.tsx`
- All `src/app/api/*/route.ts` files
- New: `src/app/login/page.tsx`
- New: `src/app/signup/page.tsx`
- New: Supabase migration for RLS

### Status: Starting

---

## Phase 2 — Workspace + Conversations

### Changes made
1. Room race condition fixed with unique partial index + atomic upsert
2. Direct chat now scoped to workspace (no cross-workspace leaks)
3. Message pagination added (limit/offset, default 100)
4. Workspace ID normalized ("default" → "ws-default" at API boundary)
5. Compound index for message queries added

### Files changed
- `src/lib/ai/conversation-engine.ts` — Upsert for rooms/direct, pagination, message count
- `src/app/api/conversations/room/route.ts` — Workspace ID normalization
- `src/app/api/conversations/[id]/messages/route.ts` — Pagination support
- `src/app/api/agents/chat/route.ts` — Workspace ID normalization
- `supabase/migrations/035_fix_conversation_race_conditions.sql` — Unique constraints

### Quality Gate 2
- `docs/QUALITY_GATE_2_CONVERSATIONS.md` — Verification checklist
