import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BLOCKLIST = new Set([".git", "node_modules", ".next"]);
const PATTERNS = [
  { label: "placeholder=\"{\\n", regex: /placeholder="\{\n/ },
  { label: "placeholder='{\\n", regex: /placeholder='\{\n/ },
];

function findMatches(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const hits = [];

  lines.forEach((line, index) => {
    PATTERNS.forEach((pattern) => {
      if (pattern.regex.test(line)) {
        hits.push({ line: index + 1, pattern: pattern.label, snippet: line.trim() });
      }
    });
  });

  return hits;
}

function walk(dir, findings) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (BLOCKLIST.has(entry)) continue;

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walk(fullPath, findings);
    } else if (stats.isFile()) {
      const matches = findMatches(fullPath);
      if (matches.length > 0) {
        findings.push({ path: fullPath, matches });
      }
    }
  }
}

function main() {
  const findings = [];
  walk(".", findings);

  if (findings.length > 0) {
    console.error("Found JSX placeholder strings that need safe expressions:\n");
    findings.forEach(({ path, matches }) => {
      matches.forEach(({ line, pattern, snippet }) => {
        console.error(`${path}:${line} => ${pattern}`);
        console.error(`  ${snippet}`);
      });
    });
    process.exitCode = 1;
    return;
  }

  console.log("No quoted JSX placeholders with escaped newlines were found.");
}

main();
