// Production Smoke Tests
// Run after deployment to verify critical paths work.
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
  expectStatus: number;
  expectBody?: (body: unknown) => boolean;
}

const tests: SmokeTest[] = [
  // Pages render
  { name: "Dashboard loads", path: "/", expectStatus: 200 },
  { name: "Workspace loads", path: "/workspace", expectStatus: 200 },
  { name: "Catalog page loads", path: "/dashboard/catalog", expectStatus: 200 },
  { name: "Agents page loads", path: "/dashboard/agents", expectStatus: 200 },
  { name: "Settings page loads", path: "/dashboard/settings", expectStatus: 200 },

  // API routes respond
  { name: "API agents list", path: "/api/agents/list", expectStatus: 200 },
  { name: "API conversations", path: "/api/conversations", expectStatus: 200 },
  { name: "API tasks", path: "/api/tasks", expectStatus: 200 },
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
