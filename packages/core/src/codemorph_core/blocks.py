"""Text spans passed from source adapters to language analysis."""

from pydantic import BaseModel, ConfigDict, Field


class TextBlock(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    text: str
    start_line: int = Field(ge=1)
