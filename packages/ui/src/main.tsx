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
  const [detail, setDetail] = useState<Detail | null>(null);
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
    const element = svg.current;
    if (!element) return;
    let gestureStartScale: number | null = null;
    const behavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.75, 16])
      .filter((event) =>
        event.type === "wheel"
          ? event.ctrlKey && gestureStartScale === null
          : !event.ctrlKey && !event.button,
      )
      .on("zoom", (event) => setTransform(event.transform));
    zoom.current = behavior;
    const selection = d3.select(element).call(behavior);
    selection.on(
      "wheel.pan",
      (event: WheelEvent) => {
        event.preventDefault();
        if (event.ctrlKey || gestureStartScale !== null) return;
        const unit =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? element.clientHeight
              : 1;
        const scale = d3.zoomTransform(element).k;
        selection.call(
          behavior.translateBy,
          (-event.deltaX * unit) / scale,
          (-event.deltaY * unit) / scale,
        );
      },
      { passive: false },
    );

    // Safari sends trackpad pinch as gesture events instead of Ctrl + wheel.
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStartScale = d3.zoomTransform(element).k;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      if (gestureStartScale === null) return;
      const gesture = event as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      selection.call(
        behavior.scaleTo,
        gestureStartScale * gesture.scale,
        d3.pointer(gesture, element),
      );
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      gestureStartScale = null;
    };
    element.addEventListener("gesturestart", onGestureStart, {
      passive: false,
    });
    element.addEventListener("gesturechange", onGestureChange, {
      passive: false,
    });
    element.addEventListener("gestureend", onGestureEnd, { passive: false });
    return () => {
      selection.on(".zoom", null).on(".pan", null);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGestureChange);
      element.removeEventListener("gestureend", onGestureEnd);
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
      detail?.token.id !== focusId ||
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
  }, [focusId, detail?.token.id, positions, WIDTH, HEIGHT]);

  function select(id: number, focus = false) {
    if (detail?.token.id === id || pendingSelectionId.current === id) {
      clearSelection();
      return;
    }
    setFocusId(focus ? id : null);
    const request = ++selectionRequest.current;
    const cached = detailCache.current.get(id);
    if (cached) {
      pendingSelectionId.current = null;
      setDetail(cached);
      return;
    }
    pendingSelectionId.current = id;
    getJson<Detail>(`/api/tokens/${id}`)
      .then((next) => {
        if (request === selectionRequest.current) {
          detailCache.current.set(id, next);
          pendingSelectionId.current = null;
          setDetail(next);
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
    setDetail(null);
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
    if (next && detail?.token.language !== next) clearSelection();
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
                      onMouseEnter={() => setHoverId(token.id)}
                      onMouseLeave={() => setHoverId(undefined)}
                      onFocus={() => setHoverId(token.id)}
                      onBlur={() => setHoverId(undefined)}
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
                      aria-label={`${token.surface}: ${selected ? t.clear : t.showDetails}`}
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
