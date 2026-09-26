import { useMemo, useState } from "react";
import { languageLabel, messages, type UiLocale } from "./i18n";
import { Icon } from "./icons";
import type { Summary, Token } from "./types";
import { languageColor } from "./visuals";

type Props = {
  locale: UiLocale;
  summary: Summary | null;
  tokens: Token[];
  language: string | null;
  onLanguage: (language: string | null) => void;
  onSelect: (id: number) => void;
};

export function ExplorerPanel({
  locale,
  summary,
  tokens,
  language,
  onLanguage,
  onSelect,
}: Props) {
  const t = messages[locale];
  const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [search, setSearch] = useState("");
  const languageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const token of tokens)
      counts.set(token.language, (counts.get(token.language) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [tokens]);
  const matching = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return [];
    return tokens
      .filter((token) => token.surface.toLocaleLowerCase().includes(query))
      .sort(
        (a, b) =>
          b.frequency - a.frequency || a.surface.localeCompare(b.surface),
      )
      .slice(0, 8);
  }, [search, tokens]);
  const topWords = useMemo(
    () => [...tokens].sort((a, b) => b.frequency - a.frequency).slice(0, 8),
    [tokens],
  );

  function choose(id: number) {
    onLanguage(null);
    onSelect(id);
    setSearch("");
  }

  return (
    <aside className="explorer" aria-label={t.explore}>
      <div className="explorer-heading">
        <p className="eyebrow">{t.explore}</p>
        <h1>Word Map</h1>
        <p>{t.intro}</p>
      </div>
      <div className="explorer-section search-section">
        <label htmlFor="word-search" className="section-label">
          {t.search}
        </label>
        <div className="search-wrap">
          <Icon name="search" className="search-icon" />
          <input
            id="word-search"
            placeholder={`${t.search}…`}
            value={search}
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matching[0]) choose(matching[0].id);
              if (event.key === "Escape") setSearch("");
            }}
          />
          {matching.length > 0 && (
            <div className="search-results">
              {matching.map((token) => (
                <button
                  type="button"
                  key={token.id}
                  onClick={() => choose(token.id)}
                >
                  <span
                    className="language-dot"
                    style={{ backgroundColor: languageColor(token.language) }}
                  />
                  <span className="result-word">{token.surface}</span>
                  <small>{formatter.format(token.frequency)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="explorer-section filters-section">
        <p className="section-label">{t.languages}</p>
        <fieldset className="language-filters" aria-label={t.languages}>
          <button
            type="button"
            aria-pressed={!language}
            onClick={() => onLanguage(null)}
          >
            <span>{t.allLanguages}</span>
            <small>{formatter.format(tokens.length)}</small>
          </button>
          {languageCounts.map(([code, count]) => (
            <button
              type="button"
              key={code}
              aria-pressed={language === code}
              onClick={() => onLanguage(code)}
            >
              <span className="filter-name">
                <span
                  className="language-dot"
                  style={{ backgroundColor: languageColor(code) }}
                />
                {languageLabel(code, locale)}
              </span>
              <small>{formatter.format(count)}</small>
            </button>
          ))}
        </fieldset>
      </div>
      <div className="explorer-section overview-section">
        <p className="section-label">{t.overview}</p>
        <div className="stats">
          <div>
            <strong>{formatter.format(summary?.documents ?? 0)}</strong>
            <span>{t.files}</span>
          </div>
          <div>
            <strong>{formatter.format(summary?.tokens ?? 0)}</strong>
            <span>{t.words}</span>
          </div>
          <div>
            <strong>{formatter.format(summary?.occurrences ?? 0)}</strong>
            <span>{t.uses}</span>
          </div>
        </div>
        {summary && summary.sources.length > 0 && (
          <div className="source-kinds">
            <span>{t.sourceKinds}</span>
            {summary.sources.map((source) => (
              <span className="source-badge" key={source.kind}>
                {source.kind === "markdown" ? "Markdown" : source.kind} ·{" "}
                {formatter.format(source.count)}
              </span>
            ))}
          </div>
        )}
      </div>
      {topWords.length > 0 && (
        <div className="explorer-section frequent-section">
          <p className="section-label">{t.frequentWords}</p>
          <div className="top-words">
            {topWords.map((token, index) => (
              <button
                type="button"
                key={token.id}
                onClick={() => choose(token.id)}
              >
                <span className="rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className="language-dot"
                  style={{ backgroundColor: languageColor(token.language) }}
                />
                <span className="top-word-name">{token.surface}</span>
                <small>{formatter.format(token.frequency)}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="explorer-footer">{t.stored}</p>
    </aside>
  );
}
