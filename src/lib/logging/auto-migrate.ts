// Auto-migration: Replace console.log/warn/error with structured logger
// This script automatically replaces console statements with logger calls

import * as fs from "fs";
import * as path from "path";

 
const _SRC_DIR = path.join(process.cwd(), "src");

// Files to migrate (exclude test files and files that already use logger)
const FILES_TO_MIGRATE = [
  "src/app/api/agents/config/route.ts",
  "src/app/api/agents/list/route.ts",
  "src/app/api/shopify/callback/route.ts",
  "src/app/api/shopify/sync/route.ts",
  "src/lib/agents/core/engine.ts",
  "src/lib/agents/core/registry.ts",
  "src/lib/agents/definition-loader.ts",
  "src/lib/ai/bootstrap.ts",
  "src/lib/ai/cost-budget.ts",
  "src/lib/ai/credential-manager.ts",
  "src/lib/ai/multi-agent-chat.ts",
  "src/lib/ai/plan-builder.ts",
  "src/lib/ai/router.ts",
  "src/lib/ai/workflow/registry.ts",
  "src/lib/ai/workflow/bootstrap.ts",
  "src/lib/ai/mini-ai/bootstrap.ts",
  "src/lib/ai/providers/claude.ts",
  "src/lib/ai/providers/gemini.ts",
  "src/lib/ai/providers/grok.ts",
  "src/lib/ai/providers/openai-compatible.ts",
  "src/lib/ai/observability.ts",
  "src/lib/security/middleware.ts",
  "src/lib/security/rate-limiter.ts",
  "src/lib/logging/event-logger.ts",
  "src/lib/workspaces/service.ts",
  "src/lib/auth/api-auth.ts",
  "src/lib/database/supabase-server.ts",
  "src/lib/database/supabase-browser.ts",
  "src/lib/ai/retry.ts",
  "src/lib/ai/providers/workers-ai.ts",
];

interface MigrationResult {
  file: string;
  changes: number;
  success: boolean;
  error?: string;
}

function migrateFile(filePath: string): MigrationResult {
  const fullPath = path.join(process.cwd(), filePath);

  try {
    let content = fs.readFileSync(fullPath, "utf-8");
    let changes = 0;

    // Check if logger is already imported
    const hasLoggerImport = content.includes('from "@/lib/logging"') ||
                           content.includes("from '@/lib/logging'") ||
                           content.includes('from "../../logging"') ||
                           content.includes('from "../../../logging"');

    // Add logger import if needed
    if (!hasLoggerImport && content.includes("console.")) {
      // Determine relative path to logging module
      const dir = path.dirname(filePath);
      let importPath: string;

      if (dir.startsWith("src/app/api")) {
        importPath = "@/lib/logging";
      } else if (dir.startsWith("src/lib")) {
        const parts = dir.replace("src/lib/", "").split("/");
        const prefix = "../".repeat(parts.length);
        importPath = `${prefix}logging`;
      } else {
        importPath = "@/lib/logging";
      }

      // Add import at the top of the file
      const firstImport = content.match(/^import .+$/m);
      if (firstImport) {
        content = content.replace(
          firstImport[0],
          `import { logger } from "${importPath}";\n${firstImport[0]}`
        );
        changes++;
      }
    }

    // Replace console.error with logger.error
    const errorRegex = /console\.error\(([^)]+)\)/g;
    content = content.replace(errorRegex, (match, args) => {
      changes++;
      return `logger.error(${args})`;
    });

    // Replace console.warn with logger.warn
    const warnRegex = /console\.warn\(([^)]+)\)/g;
    content = content.replace(warnRegex, (match, args) => {
      changes++;
      return `logger.warn(${args})`;
    });

    // Replace console.log with logger.info
    const logRegex = /console\.log\(([^)]+)\)/g;
    content = content.replace(logRegex, (match, args) => {
      changes++;
      return `logger.info(${args})`;
    });

    // Replace console.debug with logger.debug
    const debugRegex = /console\.debug\(([^)]+)\)/g;
    content = content.replace(debugRegex, (match, args) => {
      changes++;
      return `logger.debug(${args})`;
    });

    if (changes > 0) {
      fs.writeFileSync(fullPath, content, "utf-8");
    }

    return { file: filePath, changes, success: true };
  } catch (error) {
    return {
      file: filePath,
      changes: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Run migration
console.log("Starting console → logger migration...\n");

const results: MigrationResult[] = [];

for (const file of FILES_TO_MIGRATE) {
  const result = migrateFile(file);
  results.push(result);

  if (result.changes > 0) {
    console.log(`✓ ${result.file}: ${result.changes} changes`);
  } else if (!result.success) {
    console.log(`✗ ${result.file}: ${result.error}`);
  }
}

// Summary
const totalChanges = results.reduce((sum, r) => sum + r.changes, 0);
const successCount = results.filter((r) => r.success).length;

console.log(`\nMigration complete:`);
console.log(`  Files processed: ${results.length}`);
console.log(`  Files successful: ${successCount}`);
console.log(`  Total changes: ${totalChanges}`);
console.log(`\nNext steps:`);
console.log(`  1. Run: npx tsc --noEmit`);
console.log(`  2. Run: npx vitest run`);
console.log(`  3. Review changes with: git diff`);