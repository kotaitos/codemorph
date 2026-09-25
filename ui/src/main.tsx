import * as d3 from "d3";
import {
  StrictMode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { DetailPanel } from "./DetailPanel";
import { ExplorerPanel } from "./ExplorerPanel";
import { messages, type UiLocale } from "./i18n";
import { Icon } from "./icons";
import type { Detail, Summary, Token } from "./types";
import {
  fitMapPositions,
  languageColor,
  layoutLabels,
  markerScale,
  pointOpacity,
  pointRadius,
} from "./visuals";
import "./style.css";
import "./styles/explorer.css";
import "./styles/map.css";
import "./styles/detail.css";
import "./styles/responsive.css";

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
  const [pinnedDetail, setPinnedDetail] = useState<Detail | null>(null);
  const [previewDetail, setPreviewDetail] = useState<Detail | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<number>();
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [mapSize, setMapSize] = useState({ width: 1200, height: 720 });
  const [error, setError] = useState("");
  const mapShell = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const zoom = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const selectionRequest = useRef(0);
  const pendingSelectionId = useRef<number | null>(null);
  const previewRequest = useRef(0);
  const previewTargetId = useRef<number | null>(null);
  const previewTimer = useRef<number | null>(null);
  const detailCache = useRef(new Map<number, Detail>());
  const t = messages[locale];
  const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const { width: WIDTH, height: HEIGHT } = mapSize;

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

  useLayoutEffect(() => {
    const element = mapShell.current;
    if (!element) return;
    const measure = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      setMapSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
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

  const positions = useMemo(
    () => fitMapPositions(tokens, WIDTH, HEIGHT),
    [tokens, WIDTH, HEIGHT],
  );
  const displayed = useMemo(
    () =>
      language ? tokens.filter((token) => token.language === language) : tokens,
    [tokens, language],
  );
  const detail =
    previewDetail && previewDetail.token.id === hoverId
      ? previewDetail
      : pinnedDetail;
  const isPreview = detail !== null && detail === previewDetail;
  const selectedId = detail?.token.id;
  // The selected point must stay above overlapping hit targets so it can be clicked again.
  const plottedTokens = useMemo(() => {
    if (selectedId === undefined) return displayed;
    const selected = displayed.find((token) => token.id === selectedId);
    return selected
      ? [...displayed.filter((token) => token.id !== selectedId), selected]
      : displayed;
  }, [displayed, selectedId]);
  const pointScale = markerScale(WIDTH, HEIGHT, displayed.length);
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
      layoutLabels(
        detail
          ? displayed.filter((token) => relatedIds.has(token.id))
          : displayed,
        positions,
        transform,
        WIDTH,
        HEIGHT,
        pointScale,
        selectedId,
        hoverId,
      ),
    [
      displayed,
      detail,
      relatedIds,
      positions,
      transform,
      selectedId,
      hoverId,
      WIDTH,
      HEIGHT,
      pointScale,
    ],
  );
  const maxTfidf = Math.max(1, ...tokens.map((token) => token.tfidf));
  const activeRelations = detail
    ? [
        ...detail.similar
          .slice(0, 8)
          .map((item) => ({ ...item, kind: "similar" })),
        ...detail.variants.map((item) => ({ ...item, kind: "variant" })),
      ]
    : [];
  const activePoint =
    selectedId === undefined ? undefined : positions.get(selectedId);
  const inspectorSide =
    activePoint && activePoint.x >= WIDTH / 2 ? "left" : "right";

  useEffect(() => {
    if (
      focusId === null ||
      pinnedDetail?.token.id !== focusId ||
      !svg.current ||
      !zoom.current
    )
      return;
    const point = positions.get(focusId);
    if (!point) return;
    d3.select(svg.current)
      .interrupt()
      .transition()
      .duration(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400,
      )
      .call(
        zoom.current.transform,
        d3.zoomIdentity
          .translate(WIDTH / 2 - point.x * 2.6, HEIGHT / 2 - point.y * 2.6)
          .scale(2.6),
      );
  }, [focusId, pinnedDetail?.token.id, positions, WIDTH, HEIGHT]);

  function clearPreview() {
    ++previewRequest.current;
    if (previewTimer.current !== null)
      window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
    previewTargetId.current = null;
    setHoverId(undefined);
    setPreviewDetail(null);
  }

  function startPreview(id: number, delay = 80) {
    if (previewTargetId.current === id) return;
    ++previewRequest.current;
    if (previewTimer.current !== null)
      window.clearTimeout(previewTimer.current);
    previewTargetId.current = id;
    setHoverId(id);
    setPreviewDetail(null);
    if (pinnedDetail?.token.id === id) return;
    const cached = detailCache.current.get(id);
    if (cached) {
      setPreviewDetail(cached);
      return;
    }
    const request = previewRequest.current;
    previewTimer.current = window.setTimeout(() => {
      previewTimer.current = null;
      getJson<Detail>(`/api/tokens/${id}`)
        .then((next) => {
          detailCache.current.set(id, next);
          if (request === previewRequest.current) setPreviewDetail(next);
        })
        .catch(() => {
          // A transient hover preview must not replace the map with an error.
        });
    }, delay);
  }

  function select(id: number, focus = false) {
    if (pinnedDetail?.token.id === id || pendingSelectionId.current === id) {
      clearSelection();
      return;
    }
    const preview =
      previewDetail?.token.id === id
        ? previewDetail
        : detailCache.current.get(id);
    clearPreview();
    setFocusId(focus ? id : null);
    const request = ++selectionRequest.current;
    if (preview) {
      pendingSelectionId.current = null;
      setPinnedDetail(preview);
      return;
    }
    pendingSelectionId.current = id;
    getJson<Detail>(`/api/tokens/${id}`)
      .then((next) => {
        if (request === selectionRequest.current) {
          detailCache.current.set(id, next);
          pendingSelectionId.current = null;
          setPinnedDetail(next);
        }
      })
      .catch((cause) => {
        if (request === selectionRequest.current) {
          pendingSelectionId.current = null;
          setError(String(cause));
        }
      });
  }

  function clearSelection() {
    ++selectionRequest.current;
    pendingSelectionId.current = null;
    clearPreview();
    setPinnedDetail(null);
    setFocusId(null);
  }

  function reset() {
    clearSelection();
    setLanguage(null);
    if (svg.current && zoom.current)
      d3.select(svg.current)
        .transition()
        .duration(
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 350,
        )
        .call(zoom.current.transform, d3.zoomIdentity);
  }

  function changeZoom(factor: number) {
    if (svg.current && zoom.current)
      d3.select(svg.current)
        .transition()
        .duration(
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 250,
        )
        .call(zoom.current.scaleBy, factor);
  }

  function filterLanguage(next: string | null) {
    setLanguage(next);
    if (next && pinnedDetail?.token.language !== next) clearSelection();
    else clearPreview();
  }

  function chooseFromPanel(id: number) {
    filterLanguage(null);
    select(id, true);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-name">codemorph</span>
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
        <ExplorerPanel
          locale={locale}
          summary={summary}
          tokens={tokens}
          language={language}
          onLanguage={filterLanguage}
          onSelect={chooseFromPanel}
        />
        <section className="map-column" aria-label={t.graph}>
          <div className="map-heading">
            <div>
              <p className="eyebrow">{t.graph}</p>
              <h2>{detail ? t.connections : t.choose}</h2>
              <p>{detail ? t.connectionsHelp : t.chooseHelp}</p>
            </div>
            <button type="button" className="fit-button" onClick={reset}>
              <Icon name="fit" />
              <span>{t.reset}</span>
            </button>
          </div>
          <div className="map-shell" ref={mapShell}>
            <div className="map-topline">
              <span>{t.graphHint}</span>
              <span>
                {formatter.format(displayed.length)} {t.words}
              </span>
            </div>
            <fieldset className="zoom-controls" aria-label={t.graph}>
              <button
                type="button"
                onClick={() => changeZoom(1.6)}
                aria-label={t.zoomIn}
                title={t.zoomIn}
              >
                <Icon name="plus" />
              </button>
              <button
                type="button"
                onClick={() => changeZoom(1 / 1.6)}
                aria-label={t.zoomOut}
                title={t.zoomOut}
              >
                <Icon name="minus" />
              </button>
            </fieldset>
            {error && (
              <div className="empty" role="alert">
                <h2>{t.graphError}</h2>
                <p>{error}</p>
              </div>
            )}
            {!error && summary && !summary.analyzed && (
              <div className="empty">
                <h2>{t.emptyTitle}</h2>
                <p>{t.emptyHelp}</p>
                <code>npx @kotaitos/codemorph init</code>
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
                <circle
                  cx={WIDTH / 2}
                  cy={HEIGHT / 2}
                  r={Math.min(WIDTH, HEIGHT) * 0.27}
                />
                <circle
                  cx={WIDTH / 2}
                  cy={HEIGHT / 2}
                  r={Math.min(WIDTH, HEIGHT) * 0.47}
                />
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
                {plottedTokens.map((token) => {
                  const point = positions.get(token.id);
                  if (!point) return null;
                  const radius = pointRadius(token.frequency) * pointScale;
                  const visibleRadius = radius / transform.k;
                  const selected = selectedId === token.id;
                  const active = relatedIds.has(token.id);
                  const dim =
                    selectedId !== undefined && !active && hoverId !== token.id;
                  return (
                    <a
                      key={token.id}
                      className={`word ${dim ? "dim" : ""} ${selected ? "selected" : ""}`}
                      href={`#word-${token.id}`}
                      onMouseEnter={() => {
                        if (
                          window.matchMedia(
                            "(hover: hover) and (pointer: fine)",
                          ).matches
                        )
                          startPreview(token.id);
                      }}
                      onMouseLeave={clearPreview}
                      onFocus={() => startPreview(token.id, 0)}
                      onBlur={clearPreview}
                      onClick={(event) => {
                        event.preventDefault();
                        select(token.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === " ") {
                          event.preventDefault();
                          select(token.id);
                        }
                      }}
                      aria-label={`${token.surface}: ${pinnedDetail?.token.id === token.id ? t.clear : t.pin}`}
                    >
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={Math.max(radius + 6, 13) / transform.k}
                        fill="transparent"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={visibleRadius}
                        className="point"
                        fill={languageColor(token.language)}
                        opacity={
                          dim ? 0.07 : pointOpacity(token.tfidf, maxTfidf)
                        }
                      />
                      {token.marked > 0 && transform.k >= 1.6 && (
                        <circle
                          cx={point.x + visibleRadius}
                          cy={point.y - visibleRadius}
                          r={3 / transform.k}
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
                    const placement = labels.get(token.id);
                    if (!placement) return null;
                    return (
                      <text
                        key={token.id}
                        x={placement.x}
                        y={placement.y}
                        textAnchor={placement.anchor}
                        className={`word-label ${selectedId === token.id ? "active" : ""} ${selectedId !== undefined && !relatedIds.has(token.id) ? "dim" : ""}`}
                      >
                        {token.surface}
                      </text>
                    );
                  })}
              </g>
            </svg>
            <div className="map-caption">{t.sourceHint}</div>
          </div>
          <div className="map-footer">
            <span>{t.sizeHint}</span>
            <span>{t.marked}</span>
          </div>
        </section>
        {detail && (
          <DetailPanel
            detail={detail}
            locale={locale}
            preview={isPreview}
            side={inspectorSide}
            onClose={clearSelection}
            onSelect={chooseFromPanel}
          />
        )}
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
