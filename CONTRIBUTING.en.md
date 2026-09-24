# Contributing

[日本語](CONTRIBUTING.md)

codemorph is in early development. Use GitHub Issues for bug reports and feature proposals. For a proposal that changes the overall approach, open an issue before starting implementation.

## Sending a change

1. Fork the repository and create a branch from `main`.
2. Prepare the development environment with `mise install --locked` and `mise run setup`.
3. Add and run relevant checks, then run `mise run check`.
4. Fill in the pull request template with the change, verification steps, and related issue.

Do not commit source documents being analyzed, downloaded models, `.codemorph/` output, or secrets. Do not add a GitHub Actions workflow that runs the analysis or viewing server.

Pull requests pass CI and code owner review before merging. See [SECURITY.md](SECURITY.md) for vulnerability reports.

## For npm publishers

Publish only after CI succeeds on `main`. Takumi Guard is read-only, so explicitly use the npm registry for login and publication. `npm publish` builds the UI assets through `prepack`.

```sh
npm login --registry=https://registry.npmjs.org/
npm publish --registry=https://registry.npmjs.org/ --access public
```
