"""Analyze local Markdown and atomically publish a SQLite Word Map."""

import json
import logging
import math
import re
import sqlite3
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from huggingface_hub import snapshot_download
from model2vec import StaticModel
from umap import UMAP

from .config import AnalysisConfig, load_config
from .gitfiles import markdown_files, repository_root
from .markdown import prose_blocks
from .tokenize import WordTokenizer

LOGGER = logging.getLogger(__name__)
MODEL_ID = "minishlab/potion-multilingual-128M"
MODEL_REVISION = "73908c3438cf03b6a01bcb9611d62b23d0726f08"
SCHEMA_VERSION = "1"
_SENTENCE = re.compile(r"[^。！？.!?\n]+[。！？.!?]?", re.MULTILINE)


@dataclass(frozen=True)
class AnalysisResult:
    database: Path
    documents: int
    tokens: int
    warnings: tuple[str, ...]


def _vectors(words: list[str], model_dir: Path, seed: int) -> tuple[np.ndarray, np.ndarray]:
    if not words:
        return np.empty((0, 0)), np.empty((0, 2))
    model_dir.mkdir(parents=True, exist_ok=True)
    if not all(
        (model_dir / name).is_file()
        for name in ("config.json", "model.safetensors", "tokenizer.json")
    ):
        snapshot_download(
            MODEL_ID,
            revision=MODEL_REVISION,
            allow_patterns=["config.json", "model.safetensors", "tokenizer.json"],
            local_dir=model_dir,
        )
    model = StaticModel.from_pretrained(model_dir, force_download=False)
    raw = np.asarray(model.encode(words, use_multiprocessing=False), dtype=np.float32)
    norms = np.linalg.norm(raw, axis=1, keepdims=True)
    normalized = raw / np.maximum(norms, 1e-12)
    if len(words) == 1:
        positions = np.array([[0.0, 0.0]], dtype=np.float32)
    elif len(words) == 2:
        positions = np.array([[-1.0, 0.0], [1.0, 0.0]], dtype=np.float32)
    else:
        positions = UMAP(
            n_components=2,
            n_neighbors=min(15, len(words) - 1),
            random_state=seed,
            transform_seed=seed,
            init="random",
            n_jobs=1,
        ).fit_transform(normalized)
    return normalized, positions


def _schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE documents (
          id INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE
        );
        CREATE TABLE tokens (
          id INTEGER PRIMARY KEY, surface TEXT NOT NULL, language TEXT NOT NULL,
          normal TEXT NOT NULL, lemma TEXT NOT NULL, frequency INTEGER NOT NULL,
          document_frequency INTEGER NOT NULL, tfidf REAL NOT NULL,
          x REAL NOT NULL, y REAL NOT NULL, marked INTEGER NOT NULL,
          UNIQUE(surface, language)
        );
        CREATE TABLE occurrences (
          token_id INTEGER NOT NULL REFERENCES tokens(id),
          document_id INTEGER NOT NULL REFERENCES documents(id),
          line INTEGER NOT NULL, snippet TEXT NOT NULL
        );
        CREATE INDEX occurrences_by_token ON occurrences(token_id);
        CREATE TABLE cooccurrences (
          token_id INTEGER NOT NULL REFERENCES tokens(id),
          other_id INTEGER NOT NULL REFERENCES tokens(id),
          count INTEGER NOT NULL, PRIMARY KEY(token_id, other_id)
        );
        CREATE TABLE similarities (
          token_id INTEGER NOT NULL REFERENCES tokens(id),
          other_id INTEGER NOT NULL REFERENCES tokens(id),
          score REAL NOT NULL, PRIMARY KEY(token_id, other_id)
        );
        """
    )


def analyze_repository(path: Path, *, embedder=_vectors) -> AnalysisResult:
    """Read the selected Git files and write a complete SQLite snapshot.

    The embedding function is injectable for deterministic tests. Text is only
    passed to the local tokenizer and model; the model download uses a fixed ID.
    """
    root = repository_root(path)
    config: AnalysisConfig = load_config(root / "codemorph.yml")
    files = markdown_files(root, config)
    tokenizer = WordTokenizer(config)
    frequency: Counter[tuple[str, str]] = Counter()
    document_frequency: Counter[tuple[str, str]] = Counter()
    attributes: dict[tuple[str, str], tuple[str, str, bool]] = {}
    occurrences: list[tuple[tuple[str, str], int, int, str]] = []
    cooccurrences: Counter[tuple[tuple[str, str], tuple[str, str]]] = Counter()
    documents: list[str] = []
    warnings: list[str] = []
    for file in files:
        relative = file.relative_to(root).as_posix()
        try:
            source = file.read_text(encoding="utf-8")
        except (UnicodeError, OSError) as exc:
            warning = f"{relative}: {exc}"
            LOGGER.warning("Skipping %s", warning)
            warnings.append(warning)
            continue
        document_id = len(documents) + 1
        documents.append(relative)
        seen_in_document: set[tuple[str, str]] = set()
        for block in prose_blocks(source):
            block_units = (
                [(block.text, 0)]
                if config.analysis.cooccurrence.unit == "paragraph"
                else [(match.group(), match.start()) for match in _SENTENCE.finditer(block.text)]
            )
            for unit, unit_offset in block_units:
                unique: set[tuple[str, str]] = set()
                for word in tokenizer.words(unit):
                    key = (word.surface, word.language)
                    frequency[key] += 1
                    seen_in_document.add(key)
                    unique.add(key)
                    attributes[key] = (word.normal, word.lemma, word.marked)
                    line = block.start_line + block.text[: unit_offset + word.offset].count("\n")
                    snippet = unit.strip().replace("\n", " ")[:400]
                    occurrences.append((key, document_id, line, snippet))
                ordered = sorted(unique)
                for left_index, left in enumerate(ordered):
                    for right in ordered[left_index + 1 :]:
                        cooccurrences[(left, right)] += 1
        document_frequency.update(seen_in_document)

    keys = sorted(frequency)
    vectors, positions = embedder(
        [surface for surface, _language in keys],
        root / ".codemorph" / "model",
        config.analysis.random_seed,
    )
    if positions.shape != (len(keys), 2) or vectors.shape[0] != len(keys):
        raise ValueError("embedding model returned incompatible dimensions")
    token_ids = {key: index + 1 for index, key in enumerate(keys)}
    target_dir = root / ".codemorph"
    target_dir.mkdir(exist_ok=True)
    database = target_dir / "word-map.sqlite3"
    pending = target_dir / "word-map.sqlite3.tmp"
    pending.unlink(missing_ok=True)
    connection = sqlite3.connect(pending)
    try:
        _schema(connection)
        connection.executemany(
            "INSERT INTO metadata VALUES (?, ?)",
            [
                ("schema_version", SCHEMA_VERSION),
                ("model_id", MODEL_ID),
                ("model_revision", MODEL_REVISION),
                ("warnings", json.dumps(warnings, ensure_ascii=False)),
            ],
        )
        connection.executemany(
            "INSERT INTO documents VALUES (?, ?)",
            [(index, name) for index, name in enumerate(documents, 1)],
        )
        for index, key in enumerate(keys):
            normal, lemma, marked = attributes[key]
            idf = math.log((1 + len(documents)) / (1 + document_frequency[key])) + 1
            connection.execute(
                "INSERT INTO tokens VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    token_ids[key],
                    key[0],
                    key[1],
                    normal,
                    lemma,
                    frequency[key],
                    document_frequency[key],
                    frequency[key] * idf,
                    float(positions[index, 0]),
                    float(positions[index, 1]),
                    int(marked),
                ),
            )
        connection.executemany(
            "INSERT INTO occurrences VALUES (?, ?, ?, ?)",
            [
                (token_ids[key], document, line, snippet)
                for key, document, line, snippet in occurrences
            ],
        )
        min_count = config.analysis.cooccurrence.min_count
        for (left, right), count in cooccurrences.items():
            if count >= min_count:
                connection.executemany(
                    "INSERT INTO cooccurrences VALUES (?, ?, ?)",
                    [
                        (token_ids[left], token_ids[right], count),
                        (token_ids[right], token_ids[left], count),
                    ],
                )
        neighbor_count = min(8, max(0, len(keys) - 1))
        if neighbor_count:
            for start in range(0, len(keys), 128):
                batch = vectors[start : start + 128] @ vectors.T
                for offset, row in enumerate(batch):
                    index = start + offset
                    row[index] = -np.inf
                    candidate = np.argpartition(-row, neighbor_count - 1)[:neighbor_count]
                    neighbors = sorted(
                        candidate, key=lambda other: (-float(row[other]), int(other))
                    )
                    connection.executemany(
                        "INSERT INTO similarities VALUES (?, ?, ?)",
                        [(index + 1, int(other) + 1, float(row[other])) for other in neighbors],
                    )
        connection.commit()
    except Exception:
        connection.close()
        pending.unlink(missing_ok=True)
        raise
    connection.close()
    pending.replace(database)
    return AnalysisResult(database, len(documents), len(keys), tuple(warnings))
