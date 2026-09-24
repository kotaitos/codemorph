import * as d3 from "d3";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { pointOpacity, pointRadius, showsLabel, showsMark } from "./visuals";

type Token = {
  id: number;
  surface: string;
  language: "ja" | "en";
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
const formatter = new Intl.NumberFormat("ja-JP");

function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [error, setError] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const zoom = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/summary").then((response) => response.json()),
      fetch("/api/map").then((response) => response.json()),
    ])
      .then(([nextSummary, map]) => {
        if (map.error) throw new Error(map.error);
        setSummary(nextSummary);
        setTokens(map.tokens);
      })
      .catch((cause) => setError(String(cause)));
  }, []);

  useEffect(() => {
    if (!svg.current) return;
    const behavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 16])
      .on("zoom", (event) => setTransform(event.transform));
    zoom.current = behavior;
    d3.select(svg.current).call(behavior);
    return () => {
      d3.select(svg.current).on(".zoom", null);
    };
  }, []);

  const positions = useMemo(() => {
    const xDomain = d3.extent(tokens, (token) => token.x) as [number, number];
    const yDomain = d3.extent(tokens, (token) => token.y) as [number, number];
    const x = d3
      .scaleLinear()
      .domain(xDomain[0] === xDomain[1] ? [-1, 1] : xDomain)
      .range([90, WIDTH - 90]);
    const y = d3
      .scaleLinear()
      .domain(yDomain[0] === yDomain[1] ? [-1, 1] : yDomain)
      .range([HEIGHT - 90, 90]);
    return new Map(
      tokens.map((token) => [token.id, { x: x(token.x), y: y(token.y) }]),
    );
  }, [tokens]);
  const selected = detail?.token.id;
  const activeRelations = detail
    ? [
        ...detail.similar
          .slice(0, 8)
          .map((item) => ({ ...item, kind: "similar" })),
        ...detail.variants.map((item) => ({ ...item, kind: "variant" })),
      ]
    : [];
  const matching = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return [];
    return tokens
      .filter((token) => token.surface.toLocaleLowerCase().includes(query))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8);
  }, [search, tokens]);
  const maxTfidf = Math.max(1, ...tokens.map((token) => token.tfidf));

  function select(id: number, focus = false) {
    fetch(`/api/tokens/${id}`)
      .then((response) => response.json())
      .then((next) => {
        if (next.error) throw new Error(next.error);
        setDetail(next);
      })
      .catch((cause) => setError(String(cause)));
    if (focus && svg.current && zoom.current) {
      const point = positions.get(id);
      if (point)
        d3.select(svg.current)
          .transition()
          .duration(450)
          .call(
            zoom.current.transform,
            d3.zoomIdentity
              .translate(WIDTH / 2 - point.x * 3, HEIGHT / 2 - point.y * 3)
              .scale(3),
          );
    }
  }

  function reset() {
    setDetail(null);
    setSearch("");
    if (svg.current && zoom.current)
      d3.select(svg.current)
        .transition()
        .duration(350)
        .call(zoom.current.transform, d3.zoomIdentity);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">✳</span>
          <span>codemorph</span>
          <span className="brand-divider" />{" "}
          <span className="brand-subtitle">Word Map</span>
        </div>
        <div className="header-meta">
          LOCAL / READ ONLY <span className="status-dot" />
        </div>
      </header>
      <main className="workspace">
        <section className="map-column">
          <div className="toolbar">
            <div>
              <p className="eyebrow">EXPLORE YOUR VOCABULARY</p>
              <h1>Word Map</h1>
              <p className="intro">
                Markdownに現れる言葉のつながりを探索します。
              </p>
            </div>
            <button type="button" className="reset" onClick={reset}>
              全体を表示 <span>↗</span>
            </button>
          </div>
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              aria-label="単語を検索"
              placeholder="単語を検索…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {matching.length > 0 && (
              <div className="search-results">
                {matching.map((token) => (
                  <button
                    type="button"
                    key={token.id}
                    onClick={() => {
                      select(token.id, true);
                      setSearch("");
                    }}
                  >
                    <span className={`language-dot ${token.language}`} />
                    {token.surface}
                    <small>{formatter.format(token.frequency)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="map-shell">
            <div className="map-topline">
              <span>SEMANTIC SPACE</span>
              <span>DRAG TO PAN · SCROLL TO ZOOM</span>
            </div>
            {error && <div className="empty">{error}</div>}
            {!error && summary && !summary.analyzed && (
              <div className="empty">
                <span className="empty-icon">✳</span>
                <h2>まだ解析結果がありません</h2>
                <p>
                  <code>npx @kotaitos/codemorph init</code>、続けて
                  <br />
                  <code>npx @kotaitos/codemorph analyze</code>{" "}
                  を実行してください。
                </p>
              </div>
            )}
            {!error && summary?.analyzed && tokens.length === 0 && (
              <div className="empty">
                <h2>表示できる語がありません</h2>
                <p>設定とMarkdown本文を確認し、再解析してください。</p>
              </div>
            )}
            <svg
              ref={svg}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              aria-label="単語の意味空間を示す地図"
              role="img"
            >
              <g transform={transform.toString()}>
                {detail &&
                  activeRelations.map((related) => {
                    const from = positions.get(detail.token.id),
                      to = positions.get(related.id);
                    return from && to ? (
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
                {tokens.map((token) => {
                  const point = positions.get(token.id);
                  if (!point) return null;
                  const radius = pointRadius(token.frequency);
                  const highlighted = selected === token.id;
                  const opacity = pointOpacity(token.tfidf, maxTfidf);
                  return (
                    <a
                      key={token.id}
                      className="word"
                      href={`#word-${token.id}`}
                      aria-label={`${token.surface} を選択`}
                      onClick={(event) => {
                        event.preventDefault();
                        select(token.id);
                      }}
                    >
                      {highlighted && (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={radius + 8}
                          className="halo"
                        />
                      )}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={radius + 5}
                        fill="transparent"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={radius}
                        className={`point ${token.language}`}
                        opacity={opacity}
                      />
                      {showsLabel(
                        token,
                        transform.k,
                        tokens.length,
                        highlighted,
                      ) && (
                        <text
                          x={point.x + radius + 5}
                          y={point.y + 4}
                          className="word-label"
                        >
                          {token.surface}
                          {showsMark(token, transform.k) ? " ◆" : ""}
                        </text>
                      )}
                    </a>
                  );
                })}
              </g>
            </svg>
            <div className="legend">
              <span>
                <i className="language-dot ja" /> 日本語
              </span>
              <span>
                <i className="language-dot en" /> English
              </span>
              <span className="legend-note">
                大きさ = 頻度 · 透明度 = TF-IDF
              </span>
            </div>
          </div>
        </section>
        <aside className="sidebar">
          <div className="sidebar-section overview">
            <p className="eyebrow">CORPUS OVERVIEW</p>
            <h2>解析の概要</h2>
            <div className="stats">
              <div>
                <strong>{formatter.format(summary?.documents ?? 0)}</strong>
                <span>FILES</span>
              </div>
              <div>
                <strong>{formatter.format(summary?.tokens ?? 0)}</strong>
                <span>WORDS</span>
              </div>
              <div>
                <strong>{formatter.format(summary?.occurrences ?? 0)}</strong>
                <span>USES</span>
              </div>
            </div>
          </div>
          {detail ? (
            <div className="sidebar-section detail">
              <p className="eyebrow">
                SELECTED WORD{" "}
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  aria-label="選択を解除"
                >
                  ×
                </button>
              </p>
              <h2>{detail.token.surface}</h2>
              <div className="token-meta">
                <span>
                  {detail.token.language === "ja" ? "日本語" : "English"}
                </span>
                <span>頻度 {detail.token.frequency}</span>
                <span>TF-IDF {detail.token.tfidf.toFixed(2)}</span>
              </div>
              <h3>意味が近い語</h3>
              <div className="chips">
                {detail.similar.length ? (
                  detail.similar.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => select(item.id, true)}
                    >
                      {item.surface} <small>{item.score?.toFixed(2)}</small>
                    </button>
                  ))
                ) : (
                  <span className="muted">なし</span>
                )}
              </div>
              <h3>同じ正規形の表記</h3>
              <div className="chips">
                {detail.variants.length ? (
                  detail.variants.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => select(item.id, true)}
                    >
                      {item.surface}
                    </button>
                  ))
                ) : (
                  <span className="muted">なし</span>
                )}
              </div>
              <h3>共起語</h3>
              <div className="chips">
                {detail.cooccurring.length ? (
                  detail.cooccurring.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => select(item.id, true)}
                    >
                      {item.surface} <small>{item.count}</small>
                    </button>
                  ))
                ) : (
                  <span className="muted">なし</span>
                )}
              </div>
              <h3>出現箇所</h3>
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
            </div>
          ) : (
            <div className="sidebar-section hint">
              <div className="hint-symbol">↖</div>
              <h2>言葉を選択</h2>
              <p>
                地図上の点を選ぶと、意味の近い語、共起語、出現箇所を確認できます。
              </p>
            </div>
          )}
          <div className="sidebar-footer">
            分析結果はこの端末に保存されています。
          </div>
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
