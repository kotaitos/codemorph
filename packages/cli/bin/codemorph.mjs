#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const args = process.argv.slice(2);
const command = args.length ? args : ["serve"];
let child;
if (command[0] === "serve") {
  let repository = process.cwd();
  let port = 4173;
  let hasRepository = false;
  for (let index = 1; index < command.length; index++) {
    const argument = command[index];
    if (argument === "--port") {
      port = Number(command[++index]);
    } else if (argument.startsWith("--port=")) {
      port = Number(argument.slice(7));
    } else if (!argument.startsWith("-") && !hasRepository) {
      repository = argument;
      hasRepository = true;
    } else {
      console.error(`codemorph: unexpected argument: ${argument}`);
      process.exit(1);
    }
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("codemorph: port must be between 1 and 65535");
    process.exit(1);
  }
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
  child = spawn(
    process.execPath,
    [join(packageRoot, "packages", "ui", "dist", "server.mjs")],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CODEMORPH_DB: join(git.stdout.trim(), ".codemorph", "word-map.sqlite3"),
        CODEMORPH_PORT: String(port),
      },
      stdio: "inherit",
    },
  );
} else {
  child = spawn(
    "uv",
    [
      "run",
      "--frozen",
      "--no-dev",
      "--no-python-downloads",
      "--project",
      packageRoot,
      "--package",
      "codemorph-cli",
      "codemorph",
      ...command,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CODEMORPH_PACKAGE_ROOT: packageRoot,
        UV_PROJECT_ENVIRONMENT: join(
          homedir(),
          ".cache",
          "codemorph",
          "venv-0.1.0",
        ),
      },
      stdio: "inherit",
    },
  );
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(`codemorph: cannot start uv: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = signal
    ? 128 + (signal === "SIGINT" ? 2 : 15)
    : (code ?? 1);
});
