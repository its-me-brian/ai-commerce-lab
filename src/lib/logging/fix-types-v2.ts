// Fix remaining TypeScript errors from logger migration
import * as fs from "fs";
import * as path from "path";

const FILES_TO_FIX = [
  "src/app/api/agents/list/route.ts",
  "src/app/api/shopify/callback/route.ts",
  "src/app/api/shopify/sync/route.ts",
  "src/lib/agents/definition-loader.ts",
  "src/lib/ai/bootstrap.ts",
  "src/lib/ai/credential-manager.ts",
  "src/lib/ai/multi-agent-chat.ts",
  "src/lib/ai/observability.ts",
  "src/lib/ai/providers/gemini.ts",
  "src/lib/ai/providers/grok.ts",
  "src/lib/ai/providers/openai-compatible.ts",
  "src/lib/ai/router.ts",
  "src/lib/ai/workflow/registry.ts",
  "src/lib/database/supabase-server.ts",
  "src/lib/logging/event-logger.ts",
  "src/lib/security/rate-limiter.ts",
];

function fixFile(filePath: string): number {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, "utf-8");
  let changes = 0;

  // Fix: .message instanceof Error ? .message.message : String(.message)
  // → .message
  const badPattern1 = /\.message instanceof Error \? \.message\.message : String\(\.message\)/g;
  if (badPattern1.test(content)) {
    content = content.replace(badPattern1, ".message");
    changes++;
  }

  // Fix: errorVar instanceof Error ? errorVar.message : String(errorVar)
  // → String(errorVar) — when used as context value
  const badPattern2 = /(\w+(?:\.\w+)*) instanceof Error \? \1\.message : String\(\1\)/g;
  if (badPattern2.test(content)) {
    content = content.replace(badPattern2, "String($1)");
    changes++;
  }

  // Fix logger.error("msg:", { error: ... }) with wrong format
  // Pattern: logger.error("[Prefix] Message:", { error: X.message instanceof Error ... })
  const badPattern3 = /logger\.error\(([^,]+),\s*\{\s*error:\s*(\w+)\.message instanceof Error \? \2\.message\.message : String\(\2\.message\)\s*\}\)/g;
  if (badPattern3.test(content)) {
    content = content.replace(badPattern3, 'logger.error($1, { error: $2.message })');
    changes++;
  }

  // Fix logger.error("msg:", { error: X.message })
  // Pattern is usually fine, but fix when X.message is already string
  // Pattern: { error: errorVar.message instanceof Error ? ... }
  const badPattern4 = /\{\s*error:\s*(\w+)\.message instanceof Error \? \1\.message\.message : String\(\1\.message\)\s*\}/g;
  if (badPattern4.test(content)) {
    content = content.replace(badPattern4, '{ error: String($1.message || $1) }');
    changes++;
  }

  // Fix logger.warn with string argument needing context
  // logger.warn("msg:", someVar) → logger.warn("msg:", { detail: someVar })
  const badWarnPattern = /logger\.warn\(([^,]+),\s*(\w+)\)/g;
  if (badWarnPattern.test(content)) {
    content = content.replace(badWarnPattern, 'logger.warn($1, { detail: $2 })');
    changes++;
  }

  // Fix logger.error("msg:", { error: someError }) where someError is PostgrestError
  // PostgrestError doesn't have index signature, use JSON.parse(JSON.stringify())
 
  const _badPostgrest = /\{\s*error:\s*(\w+)\s*\}/g;
  // Only fix if it follows logger.error with a PostgrestError variable
  // This is tricky, so we'll handle specific patterns

  // Fix: logger.error(msg, { error: X }) where X is PostgrestError → { error: X.message }
  const badPostgrest2 = /logger\.error\(([^,]+),\s*\{\s*error:\s*(\w+)\s*\}\)/g;
  if (badPostgrest2.test(content)) {
    content = content.replace(badPostgrest2, 'logger.error($1, { error: $2 instanceof Error ? $2.message : String($2) })');
    changes++;
  }

  // Fix: logger.warn(msg, { detail: X instanceof Error ... })
  const badWarnInstanceof = /logger\.warn\(([^,]+),\s*\{\s*detail:\s*(\w+) instanceof Error \? \2\.message : String\(\2\)\s*\}\)/g;
  if (badWarnInstanceof.test(content)) {
    content = content.replace(badWarnInstanceof, 'logger.warn($1, { error: $2.message })');
    changes++;
  }

  // Fix: logger.info(msg) with no context → add context if template string
  // logger.info(`[Something] Loaded ${count} items`) → logger.info(`[Something] Loaded ${count} items`, { count })
  // This is complex, skip for now

  // Fix: logger.error(msg) with single string arg → add empty context
  // Actually logger.error(string) is fine if we fix the Logger interface

  if (changes > 0) {
    fs.writeFileSync(fullPath, content, "utf-8");
  }

  return changes;
}

console.log("Fixing remaining type errors...\n");

let total = 0;
for (const file of FILES_TO_FIX) {
  const changes = fixFile(file);
  if (changes > 0) {
    console.log(`✓ Fixed ${file}: ${changes} changes`);
    total += changes;
  }
}

console.log(`\nTotal: ${total} changes`);
console.log(`Run "npx tsc --noEmit" to verify`);