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

export function visibleLabels<T extends VisualToken>(
  tokens: T[],
  positions: Map<number, { x: number; y: number }>,
  transform: ViewTransform,
  width: number,
  height: number,
  activeId?: number,
  hoverId?: number,
): Set<number> {
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
  const maximum = Math.min(
    ordered.length,
    transform.k >= 2.5 ? 160 : transform.k >= 1.5 ? 80 : 36,
  );
  const boxes: { left: number; top: number; right: number; bottom: number }[] =
    [];
  const result = new Set<number>();
  for (const token of ordered) {
    if (result.size >= maximum) break;
    const position = positions.get(token.id);
    if (!position) continue;
    const x = position.x * transform.k + transform.x;
    const y = position.y * transform.k + transform.y;
    if (x < 12 || x > width - 12 || y < 12 || y > height - 12) continue;
    const labelX = x + pointRadius(token.frequency) * transform.k + 7;
    const box = {
      left: labelX - 2,
      right: labelX + Math.min(200, Array.from(token.surface).length * 9 + 12),
      top: y - 11,
      bottom: y + 9,
    };
    if (box.right > width - 8) continue;
    if (
      token.id !== activeId &&
      token.id !== hoverId &&
      boxes.some(
        (other) =>
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top,
      )
    )
      continue;
    boxes.push(box);
    result.add(token.id);
  }
  return result;
}
