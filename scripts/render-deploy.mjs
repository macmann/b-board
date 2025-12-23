import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function run(command) {
  console.log(`\nRunning: ${command}`);
  execSync(command, { stdio: "inherit" });
}

function runIfExists(scriptPath, command) {
  if (!existsSync(scriptPath)) {
    console.log(`\nSkipping optional step; file not found: ${scriptPath}`);
    return;
  }

  run(command);
}

function main() {
  run("npx prisma generate");

  const dedupeScriptPath = resolve(__dirname, "dedupe-testexecutions.mjs");
  runIfExists(dedupeScriptPath, `node ${dedupeScriptPath}`);

  run("npx prisma db push --accept-data-loss");
  run("npm run build");
}

try {
  main();
} catch (error) {
  console.error("Render deploy script failed:", error);
  process.exitCode = 1;
}
