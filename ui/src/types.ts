export type Token = {
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

export type Related = {
  id: number;
  surface: string;
  language: string;
  score?: number;
  count?: number;
};

export type Detail = {
  token: Token;
  similar: Related[];
  variants: Related[];
  cooccurring: Related[];
  occurrences: {
    id: number;
    path: string;
    kind: string;
    line: number;
    snippet: string;
  }[];
};

export type Summary = {
  documents: number;
  tokens: number;
  occurrences: number;
  analyzed: boolean;
  sources: { kind: string; count: number }[];
};
