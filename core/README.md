# core

GitリポジトリのMarkdown本文から日本語・英語の語を抽出し、頻度、TF-IDF、共起、ベクトル類似度、UMAP座標を計算してSQLiteへ保存します。設定はPydanticで厳格に検証します。HTTPと画面には依存しません。

多言語モデルは固定コミットから対象リポジトリの`.codemorph/model/`へ取得します。本文はローカルで処理します。SQLiteは一時ファイルへ完全に書き込んでから置き換えます。

## English

The Python core extracts Japanese and English surface forms from Git repository Markdown, computes frequency, TF-IDF, co-occurrence, embedding similarity, and UMAP positions, then writes SQLite. Pydantic strictly validates configuration. It has no HTTP or UI dependency. The pinned model is downloaded to `.codemorph/model/` and text is processed locally. A complete temporary SQLite file replaces the previous result atomically.
