import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

try {
  execSync("npm run seed", { stdio: "inherit" });
} catch (error) {
  console.error("Seeding failed, continuing to start the app:", error);
}

require("next/dist/bin/next")("start");
