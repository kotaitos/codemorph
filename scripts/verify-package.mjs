import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const built = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
if (built.status !== 0) process.exit(built.status ?? 1);

const packed = spawnSync(
  "npm",
  ["pack", "--dry-run", "--json", "--ignore-scripts"],
  {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  },
);
if (packed.status !== 0) {
  process.stderr.write(packed.stderr);
  process.exit(packed.status ?? 1);
}
const report = JSON.parse(packed.stdout);
const entry = Array.isArray(report) ? report[0] : Object.values(report)[0];
const paths = new Set(entry.files.map((file) => file.path));
for (const required of [
  "packages/cli/bin/codemorph.mjs",
  "packages/cli/python/src/codemorph_cli/main.py",
  "packages/core/src/codemorph_core/analysis.py",
  "packages/core/src/codemorph_core/blocks.py",
  "packages/core/src/codemorph_core/sources.py",
  "DESIGN.md",
  "packages/ui/dist/server.mjs",
  "packages/ui/dist/public/index.html",
  "uv.lock",
]) {
  assert.ok(paths.has(required), `npm package is missing ${required}`);
}
assert.ok(
  [...paths].some(
    (path) =>
      path.endsWith(".js") &&
      path.startsWith("packages/ui/dist/public/assets/"),
  ),
);
assert.ok(
  [...paths].every(
    (path) =>
      !path.includes("__pycache__") &&
      !path.includes(".codemorph/") &&
      !path.endsWith(".sqlite3"),
  ),
);
console.log(`Verified ${paths.size} npm package files`);
