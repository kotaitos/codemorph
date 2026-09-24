# codemorph

[日本語](README.md)

codemorph is an open source project in development for exploring words in Git tracked Markdown through a local Word Map. It is intended to show Japanese and English word frequency, semantic similarity, and co-occurrence. It will not score writing quality or send analyzed text to an external service.

**Current status:** This repository contains the initial project setup. The analysis CLI, interface, and npm package have not been released.

## Planned components

- [core](core/README.md): Python package for Markdown analysis, statistics, and SQLite storage
- [cli](cli/README.md): CLI with `init`, `analyze`, and `serve` commands
- [ui](ui/README.md): Read-only SQLite API and Word Map

The planned distribution command is `npx @kotaitos/codemorph`. It is not available yet.

## Development setup

The initial target platforms are macOS and Linux. mise manages development tool versions.

```sh
mise install --locked
mise run setup
mise run check
```

For now, `check` validates the public documentation. Analysis and UI tests will be added with their implementations. Do not commit models or analysis output.

## Contributing and contact

- Propose changes: [CONTRIBUTING.en.md](CONTRIBUTING.en.md)
- Report a vulnerability: [SECURITY.md](SECURITY.md)
- Community expectations: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

This project is released under the [MIT License](LICENSE).
