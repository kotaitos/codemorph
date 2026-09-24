"""Strict user configuration and defaults."""

from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    field_validator,
)


class ConfigError(ValueError):
    """A configuration value is invalid."""


DEFAULT_CONFIG = """# Paths are relative to the target Git repository.
include:
  - "**/*.md"
  - "**/*.markdown"
exclude:
  - ".codemorph/**"
  - "**/node_modules/**"
languages:
  natural: [ja, en]
stopwords:
  ja: []
  en: []
analysis:
  min_token_length: 2
  random_seed: 42
  cooccurrence:
    unit: paragraph
    min_count: 2
"""


NonEmptyString = Annotated[str, StringConstraints(min_length=1)]


class StrictConfigModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class LanguagesConfig(StrictConfigModel):
    natural: list[Literal["ja", "en"]] = Field(min_length=1)

    @field_validator("natural")
    @classmethod
    def unique_languages(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("languages.natural must not contain duplicates")
        return value


class StopwordsConfig(StrictConfigModel):
    ja: list[NonEmptyString]
    en: list[NonEmptyString]


class CooccurrenceConfig(StrictConfigModel):
    unit: Literal["paragraph", "sentence"]
    min_count: int = Field(ge=1)


class AnalysisSettings(StrictConfigModel):
    min_token_length: int = Field(ge=1)
    random_seed: int = Field(ge=0, le=2**32 - 1)
    cooccurrence: CooccurrenceConfig


class AnalysisConfig(StrictConfigModel):
    include: list[NonEmptyString] = Field(min_length=1)
    exclude: list[NonEmptyString]
    languages: LanguagesConfig
    stopwords: StopwordsConfig
    analysis: AnalysisSettings


def load_config(path: Path) -> AnalysisConfig:
    if not path.is_file():
        raise ConfigError(f"configuration not found: {path} (run codemorph init)")
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        raise ConfigError(f"cannot read configuration: {exc}") from exc
    try:
        return AnalysisConfig.model_validate(raw)
    except ValidationError as exc:
        raise ConfigError(str(exc)) from exc
