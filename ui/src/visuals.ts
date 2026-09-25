export type VisualToken = {
  id: number;
  frequency: number;
  tfidf: number;
  marked: number;
  surface: string;
  x: number;
  y: number;
};

export type ViewTransform = { x: number; y: number; k: number };

export function fitMapPositions<T extends { id: number; x: number; y: number }>(
  tokens: T[],
  width: number,
  height: number,
): Map<number, { x: number; y: number }> {
  if (tokens.length === 0) return new Map();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const token of tokens) {
    minX = Math.min(minX, token.x);
    maxX = Math.max(maxX, token.x);
    minY = Math.min(minY, token.y);
    maxY = Math.max(maxY, token.y);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const paddingX = Math.min(80, width * 0.12);
  const paddingY = Math.min(80, height * 0.12);
  const scale =
    spanX === 0 && spanY === 0
      ? 1
      : Math.min(
          (width - 2 * paddingX) / Math.max(spanX, 1e-9),
          (height - 2 * paddingY) / Math.max(spanY, 1e-9),
        );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return new Map(
    tokens.map((token) => [
      token.id,
      {
        x: width / 2 + (token.x - centerX) * scale,
        y: height / 2 - (token.y - centerY) * scale,
      },
    ]),
  );
}

export function pointRadius(frequency: number): number {
  return Math.min(11, 3 + Math.sqrt(Math.max(0, frequency)) * 1.55);
}

export function pointOpacity(tfidf: number, maxTfidf: number): number {
  return 0.55 + 0.45 * Math.sqrt(Math.max(0, tfidf) / Math.max(1, maxTfidf));
}

const SCRIPT_COLORS: Record<string, string> = {
  ja: "#69d8c3",
  en: "#f3b467",
  Latn: "#f3b467",
  Hani: "#69d8c3",
  Cyrl: "#a5b5ff",
  Arab: "#e3a5eb",
  Deva: "#f2a6a2",
  Thai: "#9ec9ef",
  Hang: "#a9d88e",
};

export function languageColor(language: string): string {
  const script = language.startsWith("und-") ? language.slice(4) : language;
  if (SCRIPT_COLORS[script]) return SCRIPT_COLORS[script];
  let hash = 0;
  for (const char of script) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 69% 72%)`;
}

export function markerScale(
  width: number,
  height: number,
  count: number,
): number {
  if (count === 0) return 1;
  return Math.max(
    0.55,
    Math.min(1, Math.sqrt((width * height) / (count * 700))),
  );
}

export type LabelPlacement = { x: number; y: number; anchor: "start" | "end" };

export function layoutLabels<T extends VisualToken>(
  tokens: T[],
  positions: Map<number, { x: number; y: number }>,
  transform: ViewTransform,
  width: number,
  height: number,
  scale: number,
  activeId?: number,
  hoverId?: number,
): Map<number, LabelPlacement> {
  const ordered = tokens
    .filter((token) => positions.has(token.id))
    .sort((a, b) => {
      const priority = (token: T) =>
        (token.id === activeId ? 100000 : 0) +
        (token.id === hoverId ? 50000 : 0) +
        (token.marked ? 400 : 0) +
        token.frequency * 10 +
        token.tfidf;
      return priority(b) - priority(a) || a.id - b.id;
    });
  const baseLimit = Math.max(
    8,
    Math.min(36, Math.floor((width * height) / 20000)),
  );
  const maximum = Math.min(
    ordered.length,
    Math.floor(
      baseLimit * (transform.k >= 2.5 ? 3 : transform.k >= 1.5 ? 2 : 1),
    ),
  );
  const boxes: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    cx: number;
    cy: number;
  }[] = [];
  const result = new Map<number, LabelPlacement>();
  for (const token of ordered) {
    if (result.size >= maximum) break;
    const position = positions.get(token.id);
    if (!position) continue;
    const x = position.x * transform.k + transform.x;
    const y = position.y * transform.k + transform.y;
    if (x < 10 || x > width - 10 || y < 46 || y > height - 34) continue;
    const estimatedWidth = Math.min(
      200,
      Array.from(token.surface).reduce(
        (sum, char) => sum + ((char.codePointAt(0) ?? 0) > 0x2e80 ? 13 : 7.5),
        0,
      ) + 8,
    );
    const gap = pointRadius(token.frequency) * scale + 8;
    const placeRight = x + gap + estimatedWidth < width - 10;
    const labelX = placeRight ? x + gap : x - gap;
    const box = {
      left: placeRight ? labelX : labelX - estimatedWidth,
      right: placeRight ? labelX + estimatedWidth : labelX,
      top: y - 12,
      bottom: y + 10,
      cx: x,
      cy: y,
    };
    if (box.left < 10 || box.right > width - 10) continue;
    if (
      token.id !== activeId &&
      token.id !== hoverId &&
      boxes.some(
        (other) =>
          (box.left < other.right &&
            box.right > other.left &&
            box.top < other.bottom &&
            box.bottom > other.top) ||
          Math.hypot(box.cx - other.cx, box.cy - other.cy) <
            (width < 500 ? 48 : 38),
      )
    )
      continue;
    boxes.push(box);
    result.set(token.id, {
      x: labelX,
      y: y + 4,
      anchor: placeRight ? "start" : "end",
    });
  }
  return result;
}
