import assert from "node:assert/strict";
import test from "node:test";
import {
  fitMapPositions,
  languageColor,
  layoutLabels,
  markerScale,
  pointOpacity,
  pointRadius,
} from "./visuals.ts";

test("map fit preserves UMAP distances on wide and tall screens", () => {
  const tokens = [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 2, y: 0 },
    { id: 3, x: 0, y: 2 },
  ];
  for (const [width, height] of [
    [1000, 400],
    [400, 1000],
  ]) {
    const points = fitMapPositions(tokens, width, height);
    const origin = points.get(1);
    const east = points.get(2);
    const north = points.get(3);
    assert.ok(origin && east && north);
    assert.ok(Math.abs(east.x - origin.x - (origin.y - north.y)) < 1e-9);
    assert.equal(east.y, origin.y);
    assert.equal(north.x, origin.x);
  }
});

test("frequency and TF-IDF map to bounded visual channels", () => {
  assert.ok(pointRadius(100) > pointRadius(1));
  assert.equal(pointRadius(10000), 11);
  assert.ok(pointOpacity(1, 10) < pointOpacity(10, 10));
  assert.equal(pointOpacity(10, 10), 1);
  assert.equal(languageColor("und-Cyrl"), languageColor("und-Cyrl"));
  assert.ok(markerScale(350, 480, 750) < markerScale(1000, 600, 750));
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
  const labels = layoutLabels(
    tokens,
    positions,
    { x: 0, y: 0, k: 1 },
    400,
    200,
    1,
  );
  assert.deepEqual([...labels.keys()], [1]);
  const selected = layoutLabels(
    tokens,
    positions,
    { x: 0, y: 0, k: 1 },
    400,
    200,
    1,
    2,
  );
  assert.ok(selected.has(2));
});

test("small maps limit label density and can place labels on the left edge", () => {
  const tokens = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    surface: `label-${index}`,
    frequency: 30 - index,
    tfidf: 1,
    marked: 0,
    x: 0,
    y: 0,
  }));
  const positions = new Map(
    tokens.map((token, index) => [
      token.id,
      { x: 40 + (index % 6) * 52, y: 80 + Math.floor(index / 6) * 65 },
    ]),
  );
  const labels = layoutLabels(
    tokens,
    positions,
    { x: 0, y: 0, k: 1 },
    350,
    480,
    0.6,
  );
  assert.ok(labels.size <= 8);
  const edge = layoutLabels(
    [tokens[0]],
    new Map([[1, { x: 330, y: 200 }]]),
    { x: 0, y: 0, k: 1 },
    350,
    480,
    0.6,
    1,
  );
  assert.equal(edge.get(1)?.anchor, "end");
});
