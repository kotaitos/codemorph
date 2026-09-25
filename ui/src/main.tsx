import * as d3 from "d3";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { languageLabel, messages, type UiLocale } from "./i18n";
import "./style.css";
import {
  languageColor,
  pointOpacity,
  pointRadius,
  visibleLabels,
} from "./visuals";

type Token = {
  id: number;
  surface: string;
  language: string;
  normal: string;
  frequency: number;
  tfidf: number;
  x: number;
  y: number;
  marked: number;
};
type Related = {
  id: number;
  surface: string;
  language: string;
  score?: number;
  count?: number;
};
type Detail = {
  token: Token;
  similar: Related[];
  variants: Related[];
  cooccurring: Related[];
  occurrences: { id: number; path: string; line: number; snippet: string }[];
};
type Summary = {
  documents: number;
  tokens: number;
  occurrences: number;
  analyzed: boolean;
};

const WIDTH = 1200;
const HEIGHT = 720;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok || body.error)
    throw new Error(body.error ?? `HTTP ${response.status}`);
  return body as T;
}

function App() {
  const [locale, setLocale] = useState<UiLocale>(() =>
    navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en",
  );
  const [tokens, setTokens] = useState<Token[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<number>();
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [error, setError] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const zoom = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const selectionRequest = useRef(0);
  const t = messages[locale];
  const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    Promise.all([
      getJson<Summary>("/api/summary"),
      getJson<{ tokens: Token[] }>("/api/map"),
    ])
      .then(([nextSummary, map]) => {
        setSummary(nextSummary);
        setTokens(map.tokens);
      })
      .catch((cause) => setError(String(cause)));
  }, []);

  useEffect(() => {
    if (!svg.current) return;
    const behavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.75, 16])
      .on("zoom", (event) => setTransform(event.transform));
    zoom.current = behavior;
    d3.select(svg.current).call(behavior);
    return () => {
      d3.select(svg.current).on(".zoom", null);
    };
  }, []);

  const positions = useMemo(() => {
    if (tokens.length === 0) return new Map<number, { x: number; y: number }>();
    const xDomain = d3.extent(tokens, (token) => token.x) as [number, number];
    const yDomain = d3.extent(tokens, (token) => token.y) as [number, number];
    const x = d3
      .scaleLinear()
      .domain(xDomain[0] === xDomain[1] ? [-1, 1] : xDomain)
      .range([115, WIDTH - 115]);
    const y = d3
      .scaleLinear()
      .domain(yDomain[0] === yDomain[1] ? [-1, 1] : yDomain)
      .range([HEIGHT - 105, 105]);
    return new Map(
      tokens.map((token) => [token.id, { x: x(token.x), y: y(token.y) }]),
    );
  }, [tokens]);
  const languageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const token of tokens)
      counts.set(token.language, (counts.get(token.language) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [tokens]);
  const displayed = useMemo(
    () =>
      language ? tokens.filter((token) => token.language === language) : tokens,
    [tokens, language],
  );
  const selectedId = detail?.token.id;
  const relatedIds = useMemo(
    () =>
      new Set(
        detail
          ? [
              selectedId,
              ...detail.similar.map((item) => item.id),
              ...detail.variants.map((item) => item.id),
            ]
          : [],
      ),
    [detail, selectedId],
  );
  const labels = useMemo(
    () =>
      visibleLabels(
        displayed,
        positions,
        transform,
        WIDTH,
        HEIGHT,
        selectedId,
        hoverId,
      ),
    [displayed, positions, transform, selectedId, hoverId],
  );
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
  const maxTfidf = Math.max(1, ...tokens.map((token) => token.tfidf));
  const hovered = tokens.find((token) => token.id === hoverId);
  const hoverPosition = hovered ? positions.get(hovered.id) : undefined;
  const activeRelations = detail
    ? [
        ...detail.similar
          .slice(0, 8)
          .map((item) => ({ ...item, kind: "similar" })),
        ...detail.variants.map((item) => ({ ...item, kind: "variant" })),
      ]
    : [];

  function select(id: number, focus = false) {
    const request = ++selectionRequest.current;
    getJson<Detail>(`/api/tokens/${id}`)
      .then((next) => {
        if (request === selectionRequest.current) setDetail(next);
      })
      .catch((cause) => setError(String(cause)));
    if (focus && svg.current && zoom.current) {
      const point = positions.get(id);
      if (point) {
        d3.select(svg.current)
          .transition()
          .duration(400)
          .call(
            zoom.current.transform,
            d3.zoomIdentity
              .translate(WIDTH / 2 - point.x * 2.6, HEIGHT / 2 - point.y * 2.6)
              .scale(2.6),
          );
      }
    }
  }

  function reset() {
    ++selectionRequest.current;
    setDetail(null);
    setSearch("");
    setLanguage(null);
    if (svg.current && zoom.current)
      d3.select(svg.current)
        .transition()
        .duration(350)
        .call(zoom.current.transform, d3.zoomIdentity);
  }

  function changeZoom(factor: number) {
    if (svg.current && zoom.current)
      d3.select(svg.current)
        .transition()
        .duration(250)
        .call(zoom.current.scaleBy, factor);
  }

  function filterLanguage(next: string | null) {
    setLanguage(next);
    if (next && detail?.token.language !== next) setDetail(null);
  }

  function relatedList(items: Related[], metric: "score" | "count" | null) {
    return items.length ? (
      <div className="chips">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              filterLanguage(null);
              select(item.id, true);
            }}
          >
            <span
              className="chip-dot"
              style={{ backgroundColor: languageColor(item.language) }}
            />
            {item.surface}
            {metric && (
              <small>
                {metric === "score" ? item.score?.toFixed(2) : item.count}
              </small>
            )}
          </button>
        ))}
      </div>
    ) : (
      <p className="muted">{t.none}</p>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">✳</span>
          <span>codemorph</span>
          <span className="brand-divider" />
          <span className="brand-subtitle">Word Map</span>
        </div>
        <div className="header-actions">
          <span className="header-meta">
            <span className="status-dot" /> {t.local}
          </span>
          <fieldset className="locale-switch" aria-label={t.uiLanguage}>
            <button
              type="button"
              aria-pressed={locale === "ja"}
              onClick={() => setLocale("ja")}
            >
              日本語
            </button>
            <button
              type="button"
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
            >
              English
            </button>
          </fieldset>
        </div>
      </header>
      <main className="workspace">
        <section className="map-column">
          <div className="toolbar">
            <div>
              <p className="eyebrow">{t.explore}</p>
              <h1>Word Map</h1>
              <p className="intro">{t.intro}</p>
            </div>
            <button type="button" className="reset" onClick={reset}>
              {t.reset} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="search-wrap">
            <span className="search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              aria-label={t.search}
              placeholder={`${t.search}…`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matching[0]) {
                  filterLanguage(null);
                  select(matching[0].id, true);
                  setSearch("");
                }
                if (event.key === "Escape") setSearch("");
              }}
            />
            {matching.length > 0 && (
              <div className="search-results">
                {matching.map((token) => (
                  <button
                    type="button"
                    key={token.id}
                    onClick={() => {
                      filterLanguage(null);
                      select(token.id, true);
                      setSearch("");
                    }}
                  >
                    <span
                      className="language-dot"
                      style={{ backgroundColor: languageColor(token.language) }}
                    />
                    <span>{token.surface}</span>
                    <small>{formatter.format(token.frequency)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="map-shell">
            <div className="map-topline">
              <span>{t.graph}</span>
              <span>{t.graphHint}</span>
            </div>
            <div className="zoom-controls">
              <button
                type="button"
                onClick={() => changeZoom(1.6)}
                aria-label={t.zoomIn}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1 / 1.6)}
                aria-label={t.zoomOut}
              >
                −
              </button>
            </div>
            {error && (
              <div className="empty" role="alert">
                <h2>{t.graphError}</h2>
                <p>{error}</p>
              </div>
            )}
            {!error && summary && !summary.analyzed && (
              <div className="empty">
                <span className="empty-icon">✳</span>
                <h2>{t.emptyTitle}</h2>
                <p>{t.emptyHelp}</p>
                <code>npx @kotaitos/codemorph init</code>
                <br />
                <code>npx @kotaitos/codemorph analyze</code>
              </div>
            )}
            {!error && summary?.analyzed && tokens.length === 0 && (
              <div className="empty">
                <h2>{t.noWords}</h2>
                <p>{t.noWordsHelp}</p>
              </div>
            )}
            <svg
              ref={svg}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={t.graph}
            >
              <g className="map-guides">
                <circle cx={WIDTH / 2} cy={HEIGHT / 2} r="170" />
                <circle cx={WIDTH / 2} cy={HEIGHT / 2} r="335" />
              </g>
              <g transform={transform.toString()}>
                {detail &&
                  activeRelations.map((related) => {
                    const from = positions.get(detail.token.id),
                      to = positions.get(related.id);
                    return from &&
                      to &&
                      (!language || related.language === language) ? (
                      <line
                        key={`${related.kind}-${related.id}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        className={`relation ${related.kind}`}
                      />
                    ) : null;
                  })}
                {displayed.map((token) => {
                  const point = positions.get(token.id);
                  if (!point) return null;
                  const radius = pointRadius(token.frequency);
                  const selected = selectedId === token.id;
                  const active = relatedIds.has(token.id);
                  const dim =
                    selectedId !== undefined && !active && hoverId !== token.id;
                  return (
                    <a
                      key={token.id}
                      className={`word ${dim ? "dim" : ""} ${selected ? "selected" : ""}`}
                      href={`#word-${token.id}`}
                      onMouseEnter={() => setHoverId(token.id)}
                      onMouseLeave={() => setHoverId(undefined)}
                      onClick={(event) => {
                        event.preventDefault();
                        select(token.id);
                      }}
                      aria-label={`${token.surface}: ${t.select}`}
                    >
                      {selected && (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={radius + 11}
                          className="halo"
                        />
                      )}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={Math.max(radius + 6, 13)}
                        fill="transparent"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={radius}
                        className="point"
                        fill={languageColor(token.language)}
                        opacity={
                          dim ? 0.13 : pointOpacity(token.tfidf, maxTfidf)
                        }
                      />
                      {token.marked > 0 && transform.k >= 1.6 && (
                        <circle
                          cx={point.x + radius}
                          cy={point.y - radius}
                          r="3"
                          className="marked"
                        />
                      )}
                    </a>
                  );
                })}
              </g>
              <g className="labels">
                {displayed
                  .filter((token) => labels.has(token.id))
                  .map((token) => {
                    const point = positions.get(token.id);
                    if (!point) return null;
                    const x = point.x * transform.k + transform.x;
                    const y = point.y * transform.k + transform.y;
                    return (
                      <text
                        key={token.id}
                        x={x + pointRadius(token.frequency) * transform.k + 7}
                        y={y + 4}
                        className={`word-label ${selectedId === token.id ? "active" : ""} ${selectedId !== undefined && !relatedIds.has(token.id) ? "dim" : ""}`}
                      >
                        {token.surface}
                      </text>
                    );
                  })}
              </g>
            </svg>
            {hovered && hoverPosition && (
              <div
                className="map-tooltip"
                style={{
                  left: `${Math.min(83, Math.max(4, ((hoverPosition.x * transform.k + transform.x) / WIDTH) * 100))}%`,
                  top: `${Math.min(82, Math.max(8, ((hoverPosition.y * transform.k + transform.y) / HEIGHT) * 100))}%`,
                }}
              >
                <strong>{hovered.surface}</strong>
                <span>
                  {languageLabel(hovered.language, locale)} ·{" "}
                  {t.occurrencesCount} {formatter.format(hovered.frequency)}
                </span>
              </div>
            )}
            <div className="map-caption">{t.sourceHint}</div>
          </div>
          <div className="map-footer">
            <fieldset className="language-filters" aria-label={t.languages}>
              <button
                type="button"
                className={!language ? "active" : ""}
                onClick={() => filterLanguage(null)}
              >
                {t.allLanguages}{" "}
                <small>{formatter.format(tokens.length)}</small>
              </button>
              {languageCounts.map(([code, count]) => (
                <button
                  type="button"
                  key={code}
                  className={language === code ? "active" : ""}
                  onClick={() => filterLanguage(code)}
                >
                  <span
                    className="language-dot"
                    style={{ backgroundColor: languageColor(code) }}
                  />
                  {languageLabel(code, locale)}{" "}
                  <small>{formatter.format(count)}</small>
                </button>
              ))}
            </fieldset>
            <p>{t.sizeHint}</p>
          </div>
        </section>
        <aside className="sidebar">
          <div className="sidebar-section overview">
            <p className="eyebrow">{t.overview}</p>
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
          </div>
          {detail ? (
            <div className="sidebar-section detail">
              <div className="detail-heading">
                <p className="eyebrow">{t.selected}</p>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  aria-label={t.clear}
                >
                  ×
                </button>
              </div>
              <h2>{detail.token.surface}</h2>
              <div className="token-meta">
                <span
                  className="language-dot"
                  style={{
                    backgroundColor: languageColor(detail.token.language),
                  }}
                />
                {languageLabel(detail.token.language, locale)}
                <span>·</span>
                {t.frequency} {formatter.format(detail.token.frequency)}
                <span>·</span>
                {t.tfidf} {detail.token.tfidf.toFixed(2)}
              </div>
              <section>
                <h3>{t.related}</h3>
                <p className="explanation">{t.similarityHint}</p>
                {relatedList(detail.similar, "score")}
              </section>
              <section>
                <h3>{t.variants}</h3>
                {relatedList(detail.variants, null)}
              </section>
              <section>
                <h3>{t.cooccurring}</h3>
                {relatedList(detail.cooccurring, "count")}
              </section>
              <section>
                <h3>{t.occurrences}</h3>
                <div className="occurrences">
                  {detail.occurrences.map((item) => (
                    <div key={item.id}>
                      <div className="file-path">
                        {item.path}:{item.line}
                      </div>
                      <p>{item.snippet}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="sidebar-section hint">
              <div className="hint-symbol">↖</div>
              <h2>{t.choose}</h2>
              <p>{t.chooseHelp}</p>
            </div>
          )}
          <div className="sidebar-footer">{t.stored}</div>
        </aside>
      </main>
    </div>
  );
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
