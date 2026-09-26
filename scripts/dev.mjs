import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.length > 3) {
  console.error("Usage: npm run dev -- [Git repository]");
  process.exit(1);
}
const repository = process.argv[2] ?? root;
const git = spawnSync(
  "git",
  ["-C", repository, "rev-parse", "--show-toplevel"],
  {
    encoding: "utf8",
  },
);
if (git.status !== 0) {
  console.error(
    `codemorph: ${git.stderr?.trim() || git.error?.message || "not a Git repository"}`,
  );
  process.exit(1);
}

const api = spawn(
  process.execPath,
  [join(root, "packages/ui/server/server.ts")],
  {
    cwd: root,
    env: {
      ...process.env,
      CODEMORPH_DB: join(git.stdout.trim(), ".codemorph", "word-map.sqlite3"),
      CODEMORPH_PORT: "4174",
    },
    stdio: "inherit",
  },
);
const web = spawn(
  process.execPath,
  [
    join(root, "node_modules/vite/bin/vite.js"),
    "--config",
    "packages/ui/vite.config.ts",
  ],
  { cwd: root, stdio: "inherit" },
);

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of [api, web]) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}
for (const child of [api, web]) {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
