// Fix TypeScript errors from migration
// Converts logger calls to proper format

import * as fs from "fs";
import * as path from "path";

 
const _SRC_DIR = path.join(process.cwd(), "src");

// Files with type errors
const FILES_TO_FIX = [
  "src/app/api/agents/config/route.ts",
  "src/app/api/agents/list/route.ts",
  "src/app/api/shopify/callback/route.ts",
  "src/app/api/shopify/sync/route.ts",
  "src/lib/agents/definition-loader.ts",
  "src/lib/ai/bootstrap.ts",
  "src/lib/ai/cost-budget.ts",
  "src/lib/ai/credential-manager.ts",
  "src/lib/ai/multi-agent-chat.ts",
  "src/lib/ai/observability.ts",
  "src/lib/ai/providers/gemini.ts",
  "src/lib/ai/providers/grok.ts",
  "src/lib/ai/providers/openai-compatible.ts",
  "src/lib/ai/retry.ts",
  "src/lib/ai/router.ts",
  "src/lib/ai/workflow/registry.ts",
  "src/lib/database/supabase-server.ts",
  "src/lib/logging/event-logger.ts",
  "src/lib/security/middleware.ts",
  "src/lib/security/rate-limiter.ts",
];

function fixFile(filePath: string): { fixed: boolean; changes: number } {
  const fullPath = path.join(process.cwd(), filePath);

  try {
    let content = fs.readFileSync(fullPath, "utf-8");
    let changes = 0;

    // Fix pattern: logger.error("message", error) → logger.error("message", { error: String(error) })
    // Pattern: logger.error(`...${var}`) → logger.error(`...${var}`)
    content = content.replace(
      /logger\.error\(([^,)]+),\s*(\w+(?:\.\w+)*)\)/g,
      (match, msg, errVar) => {
        changes++;
        return `logger.error(${msg}, { error: ${errVar} instanceof Error ? ${errVar}.message : String(${errVar}) })`;
      }
    );

    // Fix pattern: logger.error(`message: ${error.message}`) → logger.error(`message`, { error: error.message })
    content = content.replace(
      /logger\.error\((`[^`]+\$\{[^}]*\.message\}`),\s*(\w+)\)/g,
      (match, msg, errVar) => {
        changes++;
        return `logger.error(${msg.replace(/\$\{[^}]*\.message\}/, "")}, { error: ${errVar}.message })`;
      }
    );

    // Fix pattern: logger.warn("message") → logger.warn("message")
    // Already correct, but ensure context is provided
    content = content.replace(
      /logger\.warn\(([^,)]+)\);/g,
      (match, msg) => {
        // Only add context if it's a simple string
        if (msg.startsWith('"') || msg.startsWith("'") || msg.startsWith("`")) {
          changes++;
          return `logger.warn(${msg});`;
        }
        return match;
      }
    );

    // Fix pattern: logger.info(`message: ${data?.length}`) → logger.info(`message`, { count: data?.length })
    content = content.replace(
      /logger\.info\((`[^`]+\$\{[^}]+\}`)\)/g,
      (match, msg) => {
        changes++;
        // Extract the variable from template literal
        const varMatch = msg.match(/\$\{([^}]+)\}/);
        if (varMatch) {
          const varName = varMatch[1];
          const plainMsg = msg.replace(/\$\{[^}]+\}/, "").replace(/`/g, "");
          return `logger.info(\`${plainMsg}\`, { value: ${varName} })`;
        }
        return match;
      }
    );

    // Add logger import if missing
    if (!content.includes('import { logger }') && !content.includes("import { logger }")) {
      const importMatch = content.match(/^(import .+ from ["'].+["'];?\s*)/m);
      if (importMatch) {
        // Determine relative path
 
        const _dir = path.dirname(filePath);
        let importPath: string;

        if (filePath.includes("src/app/api")) {
          importPath = "@/lib/logging";
        } else if (filePath.includes("src/lib")) {
          const depth = filePath.replace("src/lib/", "").split("/").length - 1;
          importPath = "../".repeat(depth) + "logging";
        } else {
          importPath = "@/lib/logging";
        }

        content = content.replace(
          importMatch[0],
          `import { logger } from "${importPath}";\n${importMatch[0]}`
        );
        changes++;
      }
    }

    if (changes > 0) {
      fs.writeFileSync(fullPath, content, "utf-8");
    }

    return { fixed: changes > 0, changes };
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error);
    return { fixed: false, changes: 0 };
  }
}

// Run fixes
console.log("Fixing TypeScript errors...\n");

let totalFixed = 0;
for (const file of FILES_TO_FIX) {
  const result = fixFile(file);
  if (result.changes > 0) {
    console.log(`✓ Fixed ${file}: ${result.changes} changes`);
    totalFixed += result.changes;
  }
}

console.log(`\nTotal fixes: ${totalFixed}`);
console.log(`\nRun "npx tsc --noEmit" to verify`);