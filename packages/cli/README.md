# cli

`@kotaitos/codemorph`のnpm起動スクリプトは`init`と`analyze`でuvからPython CLIを実行します。`init`は設定とローカル除外を作り、`analyze`はcoreを呼びます。`serve`と引数なしの起動はビルド済みNode.jsサーバーを直接`127.0.0.1`で起動します。対象Gitリポジトリのパスは省略できます。

## English

The npm launcher uses uv and the Python CLI for `init` and `analyze`. `init` creates configuration and a local Git exclusion; `analyze` calls the core. `serve` and the no-argument command start the bundled Node.js server directly on `127.0.0.1`. The target Git repository path is optional.
