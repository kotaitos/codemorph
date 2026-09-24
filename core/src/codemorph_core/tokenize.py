"""Japanese and English surface-form tokenization."""

import re
from dataclasses import dataclass

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from sudachipy import dictionary, tokenizer

from .config import AnalysisConfig

_ENGLISH = re.compile(r"[A-Za-z][A-Za-z'’-]*")
_JAPANESE = re.compile(r"[一-龯々〆ぁ-ゟ゠-ヿ]")
_CONTENT_POS = {"名詞", "動詞", "形容詞", "副詞", "感動詞"}


@dataclass(frozen=True)
class Word:
    surface: str
    language: str
    normal: str
    lemma: str
    offset: int
    marked: bool


class WordTokenizer:
    def __init__(self, config: AnalysisConfig) -> None:
        self.config = config
        self.japanese_stopwords = set(config.stopwords.ja)
        self.english_stopwords = {word.casefold() for word in config.stopwords.en}
        self.japanese = (
            dictionary.Dictionary().tokenizer() if "ja" in config.languages.natural else None
        )

    def words(self, text: str) -> list[Word]:
        result: list[Word] = []
        if self.japanese is not None:
            for morpheme in self.japanese.tokenize(text, tokenizer.Tokenizer.SplitMode.C):
                surface = morpheme.surface()
                if (
                    not _JAPANESE.search(surface)
                    or len(surface) < self.config.analysis.min_token_length
                ):
                    continue
                if morpheme.part_of_speech()[0] not in _CONTENT_POS:
                    continue
                lemma = morpheme.dictionary_form()
                normal = morpheme.normalized_form()
                if {surface, lemma, normal} & self.japanese_stopwords:
                    continue
                result.append(Word(surface, "ja", normal, lemma, morpheme.begin(), False))
        if "en" in self.config.languages.natural:
            for match in _ENGLISH.finditer(text):
                surface = match.group()
                normal = surface.casefold()
                if len(surface) < self.config.analysis.min_token_length:
                    continue
                if normal in ENGLISH_STOP_WORDS or normal in self.english_stopwords:
                    continue
                result.append(
                    Word(surface, "en", normal, normal, match.start(), normal in {"todo", "fixme"})
                )
        return sorted(result, key=lambda word: (word.offset, word.language, word.surface))
