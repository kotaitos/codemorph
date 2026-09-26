"""Local Unicode word segmentation with Japanese morphology where identifiable."""

import re
import unicodedata

from icu import BreakIterator, Locale, Script
from pydantic import BaseModel, ConfigDict, Field
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from sudachipy import dictionary, tokenizer

from .config import AnalysisConfig

_JAPANESE_RUN = re.compile(r"[一-龯々〆ぁ-ゟ゠-ヿー]+")
_KANA = re.compile(r"[ぁ-ゟ゠-ヿー]")
_CONTENT_POS = {"名詞", "動詞", "形容詞", "副詞", "感動詞"}


class Word(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    surface: str
    language: str
    normal: str
    lemma: str
    offset: int = Field(ge=0)
    marked: bool


def _offsets(text: str) -> dict[int, int]:
    """PyICU uses UTF-16 offsets, while Python strings use code points."""
    offsets = {0: 0}
    units = 0
    for index, char in enumerate(text, 1):
        units += 2 if ord(char) > 0xFFFF else 1
        offsets[units] = index
    return offsets


def _script(surface: str) -> str:
    for char in surface:
        if unicodedata.category(char).startswith("L"):
            return Script.getScript(ord(char)).getShortName()
    return "Zyyy"


def _matches_script(language: str, script: str) -> bool:
    likely = Locale.addLikelySubtags(Locale(language)).getScript()
    if likely == script:
        return True
    return (likely == "Jpan" and script in {"Hani", "Hira", "Kana"}) or (
        likely == "Kore" and script in {"Hang", "Hani"}
    )


def sentence_units(text: str) -> list[tuple[str, int]]:
    """Return ICU sentence segments and Python code-point offsets."""
    breaker = BreakIterator.createSentenceInstance(Locale.getRoot())
    breaker.setText(text)
    offsets = _offsets(text)
    start = breaker.first()
    units: list[tuple[str, int]] = []
    for end in breaker:
        left, right = offsets[start], offsets[end]
        if text[left:right].strip():
            units.append((text[left:right], left))
        start = end
    return units


class WordTokenizer:
    def __init__(self, config: AnalysisConfig) -> None:
        self.config = config
        self.languages = config.languages.natural
        self.all_languages = self.languages == ["all"]
        self.japanese_stopwords = set(config.stopwords.ja)
        self.english_stopwords = {word.casefold() for word in config.stopwords.en}
        self.other_stopwords = {
            language: {word.casefold() for word in words}
            for language, words in config.stopwords.words.items()
        }
        self.japanese = (
            dictionary.Dictionary().create()
            if self.all_languages or "ja" in self.languages
            else None
        )
        locale = self.languages[0] if len(self.languages) == 1 and not self.all_languages else ""
        self.breaker = BreakIterator.createWordInstance(Locale(locale))

    def _language(self, script: str) -> str | None:
        if self.all_languages:
            return f"und-{script}"
        matches = [language for language in self.languages if _matches_script(language, script)]
        if not matches:
            return None
        return matches[0] if len(matches) == 1 else f"und-{script}"

    def words(self, text: str) -> list[Word]:
        result: list[Word] = []
        japanese_ranges: list[tuple[int, int]] = []
        if self.japanese is not None:
            for run in _JAPANESE_RUN.finditer(text):
                # Han alone also occurs in Chinese. Kana identifies a Japanese run.
                if not _KANA.search(run.group()):
                    continue
                japanese_ranges.append(run.span())
                for morpheme in self.japanese.tokenize(
                    run.group(), tokenizer.Tokenizer.SplitMode.C
                ):
                    surface = morpheme.surface()
                    if (
                        len(surface) < self.config.analysis.min_token_length
                        or morpheme.part_of_speech()[0] not in _CONTENT_POS
                    ):
                        continue
                    lemma = morpheme.dictionary_form()
                    normal = morpheme.normalized_form()
                    if {surface, lemma, normal} & self.japanese_stopwords:
                        continue
                    result.append(
                        Word(
                            surface=surface,
                            language="ja",
                            normal=normal,
                            lemma=lemma,
                            offset=run.start() + morpheme.begin(),
                            marked=False,
                        )
                    )

        offsets = _offsets(text)
        self.breaker.setText(text)
        start = self.breaker.first()
        for end in self.breaker:
            status = self.breaker.getRuleStatus()
            left, right = offsets[start], offsets[end]
            start = end
            if status == 0 or any(
                left < finish and right > begin for begin, finish in japanese_ranges
            ):
                continue
            surface = text[left:right]
            if len(surface) < self.config.analysis.min_token_length:
                continue
            script = _script(surface)
            if script == "Zyyy":
                continue
            language = self._language(script)
            if language is None:
                continue
            normal = unicodedata.normalize("NFKC", surface).casefold()
            if language == "en" and normal in ENGLISH_STOP_WORDS:
                continue
            if language == "en" and normal in self.english_stopwords:
                continue
            if normal in self.other_stopwords.get(
                language, set()
            ) or normal in self.other_stopwords.get("all", set()):
                continue
            result.append(
                Word(
                    surface=surface,
                    language=language,
                    normal=normal,
                    lemma=normal,
                    offset=left,
                    marked=normal in {"todo", "fixme"},
                )
            )
        return sorted(result, key=lambda word: (word.offset, word.language, word.surface))
