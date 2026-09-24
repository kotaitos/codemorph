import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const packed = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
if (packed.status !== 0) {
  process.stderr.write(packed.stderr);
  process.exit(packed.status ?? 1);
}
const jsonStart = packed.stdout.lastIndexOf("\n{\n");
const report = JSON.parse(
  packed.stdout.slice(jsonStart < 0 ? 0 : jsonStart + 1),
);
const entry = Array.isArray(report) ? report[0] : Object.values(report)[0];
const paths = new Set(entry.files.map((file) => file.path));
for (const required of [
  "cli/bin/codemorph.mjs",
  "cli/python/src/codemorph_cli/main.py",
  "core/src/codemorph_core/analysis.py",
  "ui/dist/server.mjs",
  "ui/dist/public/index.html",
  "uv.lock",
]) {
  assert.ok(paths.has(required), `npm package is missing ${required}`);
}
assert.ok(
  [...paths].some(
    (path) => path.endsWith(".js") && path.startsWith("ui/dist/public/assets/"),
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
