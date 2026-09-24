"""Extract prose blocks from Markdown while keeping approximate source lines."""

from dataclasses import dataclass

from markdown_it import MarkdownIt


@dataclass(frozen=True)
class ProseBlock:
    text: str
    start_line: int


_PARSER = MarkdownIt("commonmark")


def prose_blocks(source: str) -> list[ProseBlock]:
    # Front matter is not prose. Preserve line numbers after removing it.
    lines = source.splitlines(keepends=True)
    if lines and lines[0].strip() == "---":
        for end in range(1, len(lines)):
            if lines[end].strip() in {"---", "..."}:
                lines[: end + 1] = ["\n"] * (end + 1)
                break
    tokens = _PARSER.parse("".join(lines))
    blocks: list[ProseBlock] = []
    for token in tokens:
        if token.type != "inline" or token.map is None:
            continue
        parts: list[str] = []
        for child in token.children or []:
            if child.type == "text":
                parts.append(child.content)
            elif child.type in {"softbreak", "hardbreak"}:
                parts.append("\n")
        text = "".join(parts)
        if text.strip():
            blocks.append(ProseBlock(text=text, start_line=token.map[0] + 1))
    return blocks
