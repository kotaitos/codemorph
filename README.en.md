# codemorph

[日本語](README.md)

codemorph analyzes Markdown in a Git repository locally and explores multilingual word frequency, semantic similarity, and co-occurrence in a Word Map. It does not grade writing or send source text to an external service. Markdown is currently the only supported input format.

**Release status:** The app is implemented, but `@kotaitos/codemorph` is not yet published to npm. The `npx` commands below will work after publication. For this checkout, run `mise run setup`, `mise run build`, then `node cli/bin/codemorph.mjs`.

## Components

- [core](core/README.md): Python Markdown analysis, statistics, and SQLite output
- [cli](cli/README.md): npm launcher and `init`, `analyze`, `serve`
- [ui](ui/README.md): read-only HTTP API and React/D3 Word Map

The [design system](DESIGN.md) records the interface colors, typography, spacing, and interaction rules.

The core has no HTTP or UI dependency. Model files and results are stored in `.codemorph/` in the target repository.

## Usage

On macOS or Linux, install Node.js 24.11.1 or newer. `init` and `analyze` also require Python 3.14 and [uv](https://docs.astral.sh/uv/). From the target Git repository, run:

```sh
npx @kotaitos/codemorph init
npx @kotaitos/codemorph analyze
npx @kotaitos/codemorph
```

The no-argument command serves `http://127.0.0.1:4173`; open it in a browser. Use `serve --port 5000` for another port. Each command accepts an optional repository path and otherwise uses the Git repository containing the current directory. Before analysis, the UI displays setup instructions.

The first analysis downloads a pinned `minishlab/potion-multilingual-128M` model into `.codemorph/model/` and uses about 530 MB. Source text is not sent to the model host. After dependencies and the model are ready, analysis and viewing need no network.

## Configuration and map

`init` creates `codemorph.yml` and adds `.codemorph/` to `.git/info/exclude`. The configuration supports gitignore-style `include`/`exclude` patterns. `languages.natural: [all]` segments text across scripts with ICU; use tags such as `[ja, en]` or `[fr]` to limit extraction. `stopwords.ja`, `stopwords.en`, and `stopwords.words.<language tag>` add excluded words. Built-in English stopwords apply only when `en` is explicitly selected. Analysis settings include `min_token_length`, `random_seed`, `cooccurrence.unit` (`paragraph` or `sentence`), and `cooccurrence.min_count`. Unknown or invalid values stop analysis.

Eligible files are tracked or non-ignored untracked Markdown matching `include` but not `exclude`. An unreadable UTF-8 file produces a warning, while other files continue.

The map retains distinct surface forms and places all words at approximate UMAP coordinates. Hover over a word to preview its relations and details, then click to pin it. Hovering over another word temporarily previews that word; leaving restores the pinned word. Click the pinned word again to clear it. Details include cosine similarity from the original vectors, normalized variants, co-occurring words, source paths, lines, and excerpts. Size shows frequency, color shows identifiable language or script, and brightness shows TF-IDF. A map sized to its viewport, collision-aware labels, script filters, search, zoom controls, and reset help navigation. On narrow screens, selected word details open in a bottom panel. UI text switches between Japanese and English. With `all`, words in scripts shared by several languages use labels such as `und-Latn`; the word alone does not establish its language. Japanese runs containing kana use Sudachi. Segmentation and similarity quality vary by language; the embedding model was trained on 101 languages. The read-only API exposes `GET /api/summary`, `/api/map`, and `/api/tokens/{id}`. The summary includes counts by source kind. The server binds only to `127.0.0.1`.

For future program analysis, the core accepts source adapters and stores a kind for each document. Code parsing and identifier extraction are not implemented yet. A new input format will need an adapter and an `include` pattern.

## Development

```sh
mise install --locked
mise run setup
mise run check
mise run build
```

For UI development, run `mise run dev` and open `http://127.0.0.1:5173`. It uses this repository as the analysis target and reloads UI changes.

mise manages Python 3.14.7, Node.js 24, and uv. Project settings route PyPI and npm dependency downloads through Takumi Guard. Pydantic validates configuration; Ruff checks Python; Biome checks TypeScript and other web code. CI uses fixed test embeddings. It does not download the model, analyze the repository, or start the viewer. Remove `.codemorph/` and analyze again if stored results become incompatible.

See [CONTRIBUTING.en.md](CONTRIBUTING.en.md), [SECURITY.md](SECURITY.md), and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). This project uses the [MIT License](LICENSE).
