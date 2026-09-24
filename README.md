# codemorph

[English](README.en.md)

codemorphはGitリポジトリ内のMarkdown本文をローカルで解析し、日本語・英語の頻度、意味の近さ、共起関係をWord Mapで探索するOSSです。文章の良否を採点せず、対象本文を外部へ送信しません。

**公開状況:** アプリは実装済みですが、npmへの`@kotaitos/codemorph`公開は準備中です。以下の`npx`コマンドは公開後に利用できます。開発版は`mise run setup`、`mise run build`の後、`node cli/bin/codemorph.mjs`で実行できます。

## 構成

- [core](core/README.md): PythonによるMarkdown解析、統計計算、SQLite保存
- [cli](cli/README.md): npm起動スクリプトと`init`・`analyze`・`serve`
- [ui](ui/README.md): 読み取り専用HTTP APIとReact/D3のWord Map

coreはHTTPや画面に依存しません。モデルと解析結果は対象リポジトリの`.codemorph/`に保存します。

## 利用方法

macOSまたはLinuxでNode.js 24.11.1以上を用意します。`init`と`analyze`にはPython 3.14と[uv](https://docs.astral.sh/uv/)も必要です。対象Gitリポジトリで実行します。

```sh
npx @kotaitos/codemorph init
npx @kotaitos/codemorph analyze
npx @kotaitos/codemorph
```

引数なしではWord Mapを`http://127.0.0.1:4173`で配信します。ブラウザで開いてください。`serve --port 5000`でポートを変更できます。各コマンドにリポジトリのパスを指定でき、省略時は現在位置を含むGitリポジトリを使います。解析前の起動では空の画面と手順を表示します。

初回の解析は固定コミットの`minishlab/potion-multilingual-128M`を`.codemorph/model/`へ取得し、約530 MBを使います。本文はモデルの取得先へ送られません。依存とモデルの準備後は、解析と閲覧にネットワークを使いません。

## 設定と表示

`init`は`codemorph.yml`を作り、`.codemorph/`を`.git/info/exclude`へ追加します。`include`・`exclude`はリポジトリ相対のgitignore形式パターンです。`languages.natural`は`ja`・`en`、`stopwords.ja`・`stopwords.en`は除外語、`analysis.min_token_length`は最小文字数、`analysis.random_seed`はUMAPのseed、`analysis.cooccurrence.unit`は`paragraph`か`sentence`、`analysis.cooccurrence.min_count`は保存する最小回数を指定します。未知の項目や不正な値では解析を開始しません。

対象はGitの追跡中ファイルと、Gitで無視されていない未追跡ファイルのうち、`include`に一致し`exclude`に一致しないMarkdownです。UTF-8で読めない個別ファイルは警告にして続行します。

Word Mapは元の表記を別々の語として保存し、全語を近似UMAP座標に配置します。選択時には元ベクトルで計算した類似度、同じ正規形の表記、共起語、ファイル・行番号・抜粋を表示します。大きさは頻度、色は言語、透明度はTF-IDFです。検索と「全体を表示」で移動・リセットできます。APIは`GET /api/summary`、`/api/map`、`/api/tokens/{id}`です。サーバーは`127.0.0.1`にのみbindし、SQLiteを読み取り専用で開きます。

## 開発と検査

```sh
mise install --locked
mise run setup
mise run check
mise run build
```

miseはPython 3.14.7、Node.js 24、uvを管理します。PyPIとnpmの依存取得先はプロジェクト設定でTakumi Guardへ固定しています。設定はPydantic、PythonはRuff、TypeScript等はBiomeで検査します。CIは固定テストベクトルを使い、実モデル取得、実リポジトリ解析、閲覧サーバー起動を行いません。解析結果の互換性に問題があれば`.codemorph/`を削除して再解析してください。

[貢献ガイド](CONTRIBUTING.md)・[脆弱性報告](SECURITY.md)・[行動規範](CODE_OF_CONDUCT.md)を参照してください。[MIT License](LICENSE)で公開しています。
