# 貢献ガイド

[English](CONTRIBUTING.en.md)

codemorphは初期開発中です。問題の報告や機能の提案にはGitHub Issuesを使ってください。実装方針が大きく変わる提案は、作業前にIssueで相談してください。

## 変更を送るとき

1. リポジトリをフォークし、`main`から作業ブランチを作ります。
2. `mise install --locked`と`mise run setup`で開発環境を準備します。
3. 変更に応じた検査を追加・実行し、`mise run check`を通します。
4. Pull Requestテンプレートに変更内容、確認方法、関連Issueを記入します。

解析対象の文書、ダウンロードしたモデル、`.codemorph/`の解析結果、秘密情報をコミットしないでください。解析や閲覧をGitHub Actionsで実行する構成も追加しないでください。

Pull RequestはCIとコードオーナーのレビューを経てマージします。脆弱性の報告方法は[SECURITY.md](SECURITY.md)を参照してください。
