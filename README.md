# codemorph

[English](README.en.md)

codemorphは、Gitリポジトリで管理するMarkdown本文の語をローカルで分析し、Word Mapで探索するための開発中のOSSです。日本語と英語の頻度、意味の近さ、共起関係を扱う予定です。文章の良否は採点せず、解析対象の文章を外部へ送信しません。

**現在の状態:** リポジトリの初期設定段階です。解析CLI、画面、npmパッケージはまだ公開していません。

## 計画している構成

- [core](core/README.md): Markdown解析、統計計算、SQLite保存を行うPythonパッケージ
- [cli](cli/README.md): `init`、`analyze`、`serve`を提供するCLI
- [ui](ui/README.md): SQLiteを読み取り専用で参照するAPIとWord Map

公開時は`npx @kotaitos/codemorph`から起動できるようにする予定です。実装と配布が完了するまでは、このコマンドを利用手順として案内しません。

## 開発環境

macOSとLinuxを初期対象とします。開発ツールのバージョンはmiseで管理します。

```sh
mise install --locked
mise run setup
mise run check
```

現時点の`check`は公開文書を検査します。解析と画面のテストは実装時に追加します。モデルや解析結果はGitへコミットしないでください。

## 参加と連絡

- 変更の提案: [CONTRIBUTING.md](CONTRIBUTING.md)
- 脆弱性の報告: [SECURITY.md](SECURITY.md)
- コミュニティの行動規範: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

このプロジェクトは[MIT License](LICENSE)で公開しています。
