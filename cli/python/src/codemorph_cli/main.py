"""Public command line interface for the local Word Map."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

from codemorph_core.config import DEFAULT_CONFIG, ConfigError
from codemorph_core.gitfiles import GitError, repository_root


def _init(root: Path) -> None:
    config = root / "codemorph.yml"
    if config.exists():
        raise FileExistsError(f"configuration already exists: {config}")
    config.write_text(DEFAULT_CONFIG, encoding="utf-8")
    exclude = root / ".git" / "info" / "exclude"
    # Worktrees point .git at a shared directory rather than a local directory.
    if not exclude.parent.is_dir():
        result = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--git-path", "info/exclude"],
            capture_output=True,
            text=True,
            check=True,
        )
        exclude = Path(result.stdout.strip())
        if not exclude.is_absolute():
            exclude = root / exclude
    exclude.parent.mkdir(parents=True, exist_ok=True)
    contents = exclude.read_text(encoding="utf-8") if exclude.exists() else ""
    if ".codemorph/" not in contents.splitlines():
        with exclude.open("a", encoding="utf-8") as stream:
            stream.write(
                ("\n" if contents and not contents.endswith("\n") else "") + ".codemorph/\n"
            )
    print(f"Created {config}")


def _serve(root: Path, port: int) -> int:
    package_root = Path(
        os.environ.get("CODEMORPH_PACKAGE_ROOT", Path(__file__).resolve().parents[4])
    )
    server = package_root / "ui" / "dist" / "server.mjs"
    if not server.is_file():
        raise FileNotFoundError(f"UI has not been built: {server}")
    environment = os.environ.copy()
    environment["CODEMORPH_DB"] = str(root / ".codemorph" / "word-map.sqlite3")
    environment["CODEMORPH_PORT"] = str(port)
    process = subprocess.Popen(["node", str(server)], env=environment)
    try:
        return process.wait()
    except KeyboardInterrupt:
        process.terminate()
        return process.wait()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="codemorph")
    commands = parser.add_subparsers(dest="command")
    for name in ("init", "analyze", "serve"):
        command = commands.add_parser(name)
        command.add_argument("repository", nargs="?", type=Path, default=Path.cwd())
        if name == "serve":
            command.add_argument("--port", type=int, default=4173)
    args = parser.parse_args(argv)
    if args.command is None:
        args.command = "serve"
        args.repository = Path.cwd()
        args.port = 4173
    try:
        root = repository_root(args.repository)
        if args.command == "init":
            _init(root)
        elif args.command == "analyze":
            from codemorph_core.analysis import analyze_repository

            result = analyze_repository(root)
            print(f"Analyzed {result.documents} files and {result.tokens} words: {result.database}")
            for warning in result.warnings:
                print(f"warning: {warning}", file=sys.stderr)
        else:
            if not 1 <= args.port <= 65535:
                raise ValueError("port must be between 1 and 65535")
            return _serve(root, args.port)
    except (ConfigError, GitError, FileExistsError, FileNotFoundError, OSError, ValueError) as exc:
        print(f"codemorph: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
