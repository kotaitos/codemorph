# ui

Word MapはReactとD3で描画します。TypeScriptのNode.jsサーバーはcoreが生成したSQLiteを読み取り専用で開き、`GET /api/summary`、`GET /api/map`、`GET /api/tokens/{id}`を提供します。ビルド結果は`ui/dist/`に生成され、npmパッケージに同梱します。

開発中はリポジトリのルートで`mise run dev`を実行し、`http://127.0.0.1:5173`を開きます。現在のGitリポジトリの解析結果を読み、画面の変更を自動反映します。別の対象は`mise run dev -- /path/to/repository`で指定できます。

探索パネルで検索・言語の絞り込み・件数を確認し、中央の地図で語を選択します。詳細パネルは選択時だけ表示します。[デザインシステム](../DESIGN.md)に視覚と操作の基準を記録しています。

語の大きさは頻度、色は判別可能な言語または文字体系、明るさはTF-IDFです。地図は表示領域に合わせて描画し、ラベルの衝突を避けます。文字体系ごとの絞り込み、検索、拡大・縮小、全体表示を提供します。選択語の類似語・同じ正規形の表記を線で表示し、詳細には共起語と出現箇所を示します。狭い画面では詳細を下部パネルに表示します。画面の固定文言は日本語と英語で切り替えられます。概要には解析した入力種別の件数も示します。

## English

The explorer panel holds search, language filters, and counts; details appear only after selection. The [design system](../DESIGN.md) defines visual and interaction rules.

React and D3 render the Word Map. The TypeScript Node.js server opens the core SQLite output read-only and exposes `GET /api/summary`, `/api/map`, and `/api/tokens/{id}`. Built files in `ui/dist/` are bundled in the npm package. Word size encodes frequency, color encodes an identifiable language or script, and brightness encodes TF-IDF. The map fills its viewport and labels avoid collisions; script filters, search, zoom, and reset support navigation. Selection draws relations and shows co-occurring words and occurrences. On narrow screens, details open in a bottom panel. The overview also shows counts by source kind. All fixed UI text switches between Japanese and English.

For UI development, run `mise run dev` from the repository root and open `http://127.0.0.1:5173`. It reads the current Git repository's analysis results and reloads UI changes. Pass another target with `mise run dev -- /path/to/repository`.
