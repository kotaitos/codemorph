# ui

Word MapはReactとD3で描画します。TypeScriptのNode.jsサーバーはcoreが生成したSQLiteを読み取り専用で開き、`GET /api/summary`、`GET /api/map`、`GET /api/tokens/{id}`を提供します。ビルド結果は`ui/dist/`に生成され、npmパッケージに同梱します。

開発中はリポジトリのルートで`mise run dev`を実行し、`http://127.0.0.1:5173`を開きます。現在のGitリポジトリの解析結果を読み、画面の変更を自動反映します。別の対象は`mise run dev -- /path/to/repository`で指定できます。

語の大きさは頻度、色は言語、透明度はTF-IDFです。拡大時にラベルやTODO等の印を増やし、選択語の類似語・同じ正規形の表記を線で表示します。詳細には共起語と出現箇所が並びます。

## English

React and D3 render the Word Map. The TypeScript Node.js server opens the core SQLite output read-only and exposes `GET /api/summary`, `/api/map`, and `/api/tokens/{id}`. Built files in `ui/dist/` are bundled in the npm package. Word size encodes frequency, color encodes language, and opacity encodes TF-IDF. Zoom reveals labels and TODO markers; selection draws relations and shows co-occurring words and occurrences.

For UI development, run `mise run dev` from the repository root and open `http://127.0.0.1:5173`. It reads the current Git repository's analysis results and reloads UI changes. Pass another target with `mise run dev -- /path/to/repository`.
