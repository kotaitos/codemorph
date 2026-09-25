# core

GitリポジトリのMarkdown本文から多言語の語を抽出し、頻度、TF-IDF、共起、ベクトル類似度、UMAP座標を計算してSQLiteへ保存します。ICUでUnicodeの語境界と文境界を判定し、かなを含む日本語部分はSudachiで解析します。設定と解析用データモデルはPydanticで検証します。HTTPと画面には依存しません。

多言語モデルは固定コミットから対象リポジトリの`.codemorph/model/`へ取得します。本文はローカルで処理します。SQLiteは一時ファイルへ完全に書き込んでから置き換えます。

入力形式は`SourceAdapter`で選び、現在は`MarkdownSource`のみを提供します。アダプターは対象ファイルと、行番号を持つ解析単位を返します。文書の入力種別はSQLiteへ保存します。将来のコード解析は別アダプターで追加でき、現在はソースコードを解析しません。

## English

The Python core extracts multilingual surface forms from Git repository Markdown, computes frequency, TF-IDF, co-occurrence, embedding similarity, and UMAP positions, then writes SQLite. ICU finds Unicode word and sentence boundaries; Japanese runs containing kana use Sudachi. Pydantic validates configuration and analysis data models. It has no HTTP or UI dependency. The pinned model is downloaded to `.codemorph/model/` and text is processed locally. A complete temporary SQLite file replaces the previous result atomically.

Input formats use `SourceAdapter`; only `MarkdownSource` is provided today. An adapter identifies files and returns analyzable blocks with source lines. SQLite stores each document's source kind. A later code adapter can use this boundary; source code is not analyzed yet.
