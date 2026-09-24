export type VisualToken = { frequency: number; tfidf: number; marked: number };

export function pointRadius(frequency: number): number {
  return Math.min(17, 3.5 + Math.sqrt(Math.max(0, frequency)) * 2);
}

export function pointOpacity(tfidf: number, maxTfidf: number): number {
  return 0.38 + 0.62 * Math.sqrt(Math.max(0, tfidf) / Math.max(1, maxTfidf));
}

export function showsLabel(
  token: VisualToken,
  zoom: number,
  count: number,
  selected: boolean,
): boolean {
  return selected || zoom >= 2 || (count < 45 && token.frequency > 1);
}

export function showsMark(token: VisualToken, zoom: number): boolean {
  return token.marked > 0 && zoom >= 2;
}
