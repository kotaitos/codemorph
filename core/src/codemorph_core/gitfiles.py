"""Find configured files in a Git worktree without reading ignored files."""

import subprocess
from pathlib import Path

import pathspec

from .config import AnalysisConfig


class GitError(RuntimeError):
    """Git could not identify or enumerate the target repository."""


def repository_root(path: Path) -> Path:
    result = subprocess.run(
        ["git", "-C", str(path), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise GitError(result.stderr.strip() or f"not a Git repository: {path}")
    return Path(result.stdout.strip()).resolve()


def repository_files(root: Path, config: AnalysisConfig) -> list[Path]:
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise GitError(result.stderr.decode("utf-8", errors="replace").strip())
    included = pathspec.GitIgnoreSpec.from_lines(config.include)
    excluded = pathspec.GitIgnoreSpec.from_lines(config.exclude)
    selected = []
    for relative in sorted(
        set(result.stdout.decode("utf-8", errors="surrogateescape").split("\0"))
    ):
        if not relative:
            continue
        if not included.match_file(relative) or excluded.match_file(relative):
            continue
        path = root / relative
        if not path.is_file() or not path.resolve().is_relative_to(root):
            continue
        selected.append(path)
    return selected


def markdown_files(root: Path, config: AnalysisConfig) -> list[Path]:
    """Compatibility helper for callers that only need Markdown sources."""
    return [
        path
        for path in repository_files(root, config)
        if path.suffix.lower() in {".md", ".markdown"}
    ]
