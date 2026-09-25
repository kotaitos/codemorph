"""Source adapters keep file syntax separate from the analysis pipeline."""

from pathlib import Path
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict

from .blocks import TextBlock
from .markdown import prose_blocks


class SourceAdapter(Protocol):
    kind: str

    def accepts(self, path: Path) -> bool: ...

    def blocks(self, source: str) -> list[TextBlock]: ...


class MarkdownSource(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    kind: Literal["markdown"] = "markdown"

    def accepts(self, path: Path) -> bool:
        return path.suffix.lower() in {".md", ".markdown"}

    def blocks(self, source: str) -> list[TextBlock]:
        return prose_blocks(source)
