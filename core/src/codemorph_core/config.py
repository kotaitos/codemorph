"""Strict user configuration and defaults."""

import re
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
  natural: [all]
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
    natural: list[NonEmptyString] = Field(min_length=1)

    @field_validator("natural")
    @classmethod
    def unique_languages(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("languages.natural must not contain duplicates")
        if "all" in value and len(value) != 1:
            raise ValueError("languages.natural: all must be used alone")
        for language in value:
            if language != "all" and not re.fullmatch(
                r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", language
            ):
                raise ValueError(f"invalid language tag: {language}")
        return value


class StopwordsConfig(StrictConfigModel):
    ja: list[NonEmptyString] = Field(default_factory=list)
    en: list[NonEmptyString] = Field(default_factory=list)
    words: dict[str, list[NonEmptyString]] = Field(default_factory=dict)

    @field_validator("words")
    @classmethod
    def valid_languages(cls, value: dict[str, list[str]]) -> dict[str, list[str]]:
        for language in value:
            if language != "all" and not re.fullmatch(
                r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", language
            ):
                raise ValueError(f"invalid stopword language: {language}")
        return value


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
