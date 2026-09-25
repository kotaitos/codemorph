import assert from "node:assert/strict";
import test from "node:test";
import {
  languageColor,
  pointOpacity,
  pointRadius,
  visibleLabels,
} from "./visuals.ts";

test("frequency and TF-IDF map to bounded visual channels", () => {
  assert.ok(pointRadius(100) > pointRadius(1));
  assert.equal(pointRadius(10000), 11);
  assert.ok(pointOpacity(1, 10) < pointOpacity(10, 10));
  assert.equal(pointOpacity(10, 10), 1);
  assert.equal(languageColor("und-Cyrl"), languageColor("und-Cyrl"));
});

test("labels prioritize active words and avoid overlapping other labels", () => {
  const tokens = [
    {
      id: 1,
      surface: "long-label",
      frequency: 10,
      tfidf: 2,
      marked: 0,
      x: 0,
      y: 0,
    },
    { id: 2, surface: "second", frequency: 1, tfidf: 1, marked: 0, x: 0, y: 0 },
  ];
  const positions = new Map([
    [1, { x: 50, y: 50 }],
    [2, { x: 55, y: 50 }],
  ]);
  const labels = visibleLabels(
    tokens,
    positions,
    { x: 0, y: 0, k: 1 },
    400,
    200,
  );
  assert.deepEqual([...labels], [1]);
  const selected = visibleLabels(
    tokens,
    positions,
    { x: 0, y: 0, k: 1 },
    400,
    200,
    2,
  );
  assert.ok(selected.has(2));
});
