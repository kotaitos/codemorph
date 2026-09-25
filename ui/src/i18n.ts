export type UiLocale = "ja" | "en";

export const messages = {
  ja: {
    uiLanguage: "画面の言語",
    local: "ローカル・読み取り専用",
    explore: "語彙を探索",
    intro: "リポジトリ内の対象ファイルから、語の分布とつながりを見ます。",
    reset: "全体を表示",
    search: "単語を検索",
    graph: "意味の地図",
    graphHint: "ドラッグで移動 · スクロールで拡大",
    zoomIn: "拡大",
    zoomOut: "縮小",
    select: "選択",
    emptyTitle: "まだ解析結果がありません",
    emptyHelp: "次のコマンドで設定と解析を実行してください。",
    noWords: "表示できる語がありません",
    noWordsHelp: "設定と対象ファイルを確認し、再解析してください。",
    graphError: "地図を読み込めませんでした",
    frequency: "出現頻度",
    tfidf: "TF-IDF",
    similarity: "意味の近さ",
    similarityHint:
      "地図上の距離は近似です。数値は元のベクトルで計算しています。",
    sizeHint: "大きさ＝出現頻度 · 明るさ＝TF-IDF",
    sourceHint: "座標はUMAPによる近似。距離そのものは類似度ではありません。",
    languages: "文字体系・言語",
    allLanguages: "すべて",
    overview: "解析の概要",
    sourceKinds: "解析対象",
    frequentWords: "よく出る語",
    files: "ファイル",
    words: "語",
    uses: "出現",
    selected: "選択した語",
    clear: "選択を解除",
    related: "意味が近い語",
    variants: "同じ正規形の表記",
    cooccurring: "共起語",
    occurrences: "出現箇所",
    none: "なし",
    choose: "語を選択",
    chooseHelp: "地図上の点、検索結果、または詳細の関連語から選べます。",
    connections: "語のつながり",
    connectionsHelp: "選択語と意味が近い語・別表記を線で示します。",
    stored: "解析結果はこの端末に保存されています。",
    script: "文字",
    marked: "拡大時: TODO / FIXME",
    occurrencesCount: "出現回数",
  },
  en: {
    uiLanguage: "Interface language",
    local: "Local · read only",
    explore: "Explore vocabulary",
    intro: "Explore terms and their connections across repository files.",
    reset: "Show all",
    search: "Search words",
    graph: "Semantic map",
    graphHint: "Drag to pan · scroll to zoom",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    select: "Select",
    emptyTitle: "No analysis yet",
    emptyHelp: "Run these commands to configure and analyze your repository.",
    noWords: "No words to display",
    noWordsHelp:
      "Check the configuration and source files, then analyze again.",
    graphError: "Could not load the map",
    frequency: "Frequency",
    tfidf: "TF-IDF",
    similarity: "Similarity",
    similarityHint:
      "Map distances are approximate. Scores use the original vectors.",
    sizeHint: "Size = frequency · brightness = TF-IDF",
    sourceHint:
      "UMAP coordinates are approximate; distance is not a similarity score.",
    languages: "Scripts and languages",
    allLanguages: "All",
    overview: "Corpus overview",
    sourceKinds: "Sources",
    frequentWords: "Frequent words",
    files: "Files",
    words: "Words",
    uses: "Uses",
    selected: "Selected word",
    clear: "Clear selection",
    related: "Similar words",
    variants: "Other surface forms",
    cooccurring: "Co-occurring words",
    occurrences: "Occurrences",
    none: "None",
    choose: "Select a word",
    chooseHelp:
      "Select a point, a search result, or a related word in the details.",
    connections: "Word connections",
    connectionsHelp:
      "Lines connect the selected word to similar and variant words.",
    stored: "Analysis data is stored on this device.",
    script: "script",
    marked: "At zoom: TODO / FIXME",
    occurrencesCount: "Occurrences",
  },
} as const;

export function languageLabel(code: string, locale: UiLocale): string {
  if (code.startsWith("und-")) {
    const script = code.slice(4);
    try {
      const name = new Intl.DisplayNames([locale], { type: "script" }).of(
        script,
      );
      return `${name ?? script} ${messages[locale].script}`;
    } catch {
      return `${script} ${messages[locale].script}`;
    }
  }
  try {
    return (
      new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
