// Production Smoke Tests
// Run after deployment to verify critical paths work.
//
// FASE 7: Properly handles auth — public routes expect 200,
// protected routes expect 401 (API) or redirect (pages).
//
// Usage:
//   SMOKE_TEST_URL=https://your-app.vercel.app npx tsx scripts/smoke-test.ts
//
// Exit code 0 = all passed, 1 = failures

const BASE_URL = process.env.SMOKE_TEST_URL || "http://localhost:3000";

interface SmokeTest {
  name: string;
  path: string;
  method?: string;
  /** Expected status when unauthenticated. For pages, expect redirect (307). */
  expectStatus: number;
  expectBody?: (body: unknown) => boolean;
}

const tests: SmokeTest[] = [
  // === PUBLIC (no auth) ===
  { name: "Homepage loads", path: "/", expectStatus: 200 },
  { name: "Login page loads", path: "/login", expectStatus: 200 },
  { name: "Signup page loads", path: "/signup", expectStatus: 200 },
  { name: "Health endpoint", path: "/api/health", expectStatus: 200 },

  // === PROTECTED — expect 401/redirect without session ===
  // Pages → redirect to /login (307)
  { name: "Dashboard → auth redirect", path: "/dashboard", expectStatus: 307 },
  { name: "Agents page → auth redirect", path: "/dashboard/agents", expectStatus: 307 },
  { name: "Settings page → auth redirect", path: "/dashboard/settings", expectStatus: 307 },
  { name: "Catalog page → auth redirect", path: "/dashboard/catalog", expectStatus: 307 },
  { name: "Workspace page → auth redirect", path: "/workspace", expectStatus: 307 },

  // API routes → 401
  { name: "API agents list → 401", path: "/api/agents/list", expectStatus: 401 },
  { name: "API conversations → 401", path: "/api/conversations", expectStatus: 401 },
  { name: "API tasks → 401", path: "/api/tasks", expectStatus: 401 },
];

async function runTest(test: SmokeTest): Promise<{ passed: boolean; error?: string }> {
  try {
    const url = `${BASE_URL}${test.path}`;
    const res = await fetch(url, {
      method: test.method || "GET",
      headers: { "Content-Type": "application/json" },
      redirect: "manual",
    });

    if (res.status !== test.expectStatus) {
      return {
        passed: false,
        error: `Expected status ${test.expectStatus}, got ${res.status}`,
      };
    }

    if (test.expectBody) {
      const body = await res.json();
      if (!test.expectBody(body)) {
        return { passed: false, error: "Body validation failed" };
      }
    }

    return { passed: true };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log(`\n🔍 Smoke Tests — ${BASE_URL}\n`);
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await runTest(test);
    const icon = result.passed ? "✅" : "❌";
    const status = result.passed ? "PASS" : "FAIL";

    console.log(`${icon} ${test.name} — ${status}${result.error ? ` (${result.error})` : ""}`);

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("=".repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${tests.length} total\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
