// Migration Script: Replace console.log/warn/error with structured logger
// Run this script to find all console statements that need migration
// Usage: npx tsx src/lib/logging/migrate-console.ts

import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.join(process.cwd(), "src");
const EXCLUDE_DIRS = ["node_modules", ".next", "dist", "*.test.ts", "*.spec.ts"];
const EXCLUDE_FILES = ["migrate-console.ts", "index.ts"];

interface ConsoleStatement {
  file: string;
  line: number;
  statement: string;
  context: string;
}

function findConsoleStatements(dir: string): ConsoleStatement[] {
  const results: ConsoleStatement[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.name.endsWith(".ts") && !EXCLUDE_FILES.includes(entry.name)) {
        if (entry.name.includes(".test.") || entry.name.includes(".spec.")) {
          continue;
        }

        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          const match = line.match(/console\.(log|warn|error|debug)\(/);
          if (match) {
            results.push({
              file: fullPath.replace(SRC_DIR, "src"),
              line: index + 1,
              statement: match[0].replace("(", ""),
              context: line.trim().substring(0, 80),
            });
          }
        });
      }
    }
  }

  walk(dir);
  return results;
}

// Run if executed directly
if (require.main === module) {
  const statements = findConsoleStatements(SRC_DIR);

  console.log(`\nFound ${statements.length} console statements:\n`);

  // Group by file
  const byFile = statements.reduce((acc, s) => {
    if (!acc[s.file]) acc[s.file] = [];
    acc[s.file].push(s);
    return acc;
  }, {} as Record<string, ConsoleStatement[]>);

  for (const [file, stmts] of Object.entries(byFile)) {
    console.log(`\n${file}:`);
    for (const s of stmts) {
      console.log(`  L${s.line}: ${s.statement} — ${s.context}`);
    }
  }

  // Summary
  const byType = statements.reduce((acc, s) => {
    acc[s.statement] = (acc[s.statement] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\n\nSummary:");
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }
}

export { findConsoleStatements };