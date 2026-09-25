"""Repository behavior without downloading the embedding model."""

import sqlite3
import subprocess
from pathlib import Path

import numpy as np
import pytest
from codemorph_core.analysis import analyze_repository
from codemorph_core.config import DEFAULT_CONFIG, ConfigError, load_config
from codemorph_core.tokenize import WordTokenizer, sentence_units


def _repository(tmp_path: Path) -> Path:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    (tmp_path / "codemorph.yml").write_text(DEFAULT_CONFIG, encoding="utf-8")
    return tmp_path


def _embed(words: list[str], _model_dir: Path, _seed: int) -> tuple[np.ndarray, np.ndarray]:
    vectors = np.ones((len(words), 3), dtype=np.float32)
    positions = np.array(
        [[float(index), 0.0] for index in range(len(words))], dtype=np.float32
    ).reshape(-1, 2)
    return vectors, positions


def test_config_rejects_unknown_and_wrong_typed_values(tmp_path: Path) -> None:
    config = tmp_path / "codemorph.yml"
    config.write_text(DEFAULT_CONFIG + "unknown: true\n", encoding="utf-8")
    with pytest.raises(ConfigError, match="unknown"):
        load_config(config)
    config.write_text(DEFAULT_CONFIG.replace("min_count: 2", "min_count: '2'"), encoding="utf-8")
    with pytest.raises(ConfigError, match="min_count"):
        load_config(config)


def test_local_git_markdown_to_sqlite(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    (root / "a.md").write_text(
        "---\ntitle: Hidden\n---\n# 日本語と English\n\n"
        "解析の地図。 Word map TODO.\n\n```text\nInvisibleWord\n```\n",
        encoding="utf-8",
    )
    (root / "ignored.md").write_text("IgnoredWord", encoding="utf-8")
    (root / ".gitignore").write_text("ignored.md\n", encoding="utf-8")
    (root / "bad.md").write_bytes(b"\xff\xfe")
    result = analyze_repository(root, embedder=_embed)
    assert result.documents == 1
    assert len(result.warnings) == 1
    assert "bad.md" in result.warnings[0]
    with sqlite3.connect(result.database) as db:
        surfaces = {row[0] for row in db.execute("SELECT surface FROM tokens")}
        assert "日本語" in surfaces
        assert "English" in surfaces
        assert "TODO" in surfaces
        assert "Hidden" not in surfaces
        assert "InvisibleWord" not in surfaces
        assert "IgnoredWord" not in surfaces
        assert db.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0] > 0
        assert (
            db.execute("SELECT value FROM metadata WHERE key = 'schema_version'").fetchone()[0]
            == "1"
        )


def test_empty_repository_still_produces_a_database(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    result = analyze_repository(root, embedder=_embed)
    assert result.tokens == 0
    with sqlite3.connect(result.database) as db:
        assert db.execute("SELECT COUNT(*) FROM tokens").fetchone()[0] == 0


def test_multilingual_words_and_unicode_offsets(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    tokenizer = WordTokenizer(load_config(root / "codemorph.yml"))
    source = "😀 français 中文分词 ประเทศไทย مرحبا Привет 日本語と English 24.11"
    words = tokenizer.words(source)
    surfaces = {word.surface for word in words}
    assert {"français", "中文", "ประเทศไทย", "مرحبا", "Привет", "日本語", "English"} <= surfaces
    assert "24.11" not in surfaces
    assert all(
        source[word.offset : word.offset + len(word.surface)] == word.surface for word in words
    )
    assert {word.language for word in words} >= {
        "und-Latn",
        "und-Hani",
        "und-Thai",
        "und-Arab",
        "und-Cyrl",
        "ja",
    }
    assert [unit.strip() for unit, _ in sentence_units("你好。สวัสดี! Bonjour.")] == [
        "你好。",
        "สวัสดี!",
        "Bonjour.",
    ]


def test_explicit_language_tag_and_stopwords(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    config = root / "codemorph.yml"
    config.write_text(
        DEFAULT_CONFIG.replace("natural: [all]", "natural: [fr]").replace(
            "  en: []", "  en: []\n  words:\n    fr: [bonjour]"
        ),
        encoding="utf-8",
    )
    words = WordTokenizer(load_config(config)).words("Bonjour français Привет")
    assert [(word.surface, word.language) for word in words] == [("français", "fr")]
