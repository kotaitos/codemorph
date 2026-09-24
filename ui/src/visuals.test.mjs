import assert from "node:assert/strict";
import test from "node:test";
import { pointOpacity, pointRadius, showsLabel, showsMark } from "./visuals.ts";

test("frequency and TF-IDF map to bounded visual channels", () => {
  assert.ok(pointRadius(100) > pointRadius(1));
  assert.equal(pointRadius(10000), 17);
  assert.ok(pointOpacity(1, 10) < pointOpacity(10, 10));
  assert.equal(pointOpacity(10, 10), 1);
});

test("zoom reveals labels and TODO marks", () => {
  const token = { frequency: 1, tfidf: 1, marked: 1 };
  assert.equal(showsLabel(token, 1, 100, false), false);
  assert.equal(showsMark(token, 1), false);
  assert.equal(showsLabel(token, 2, 100, false), true);
  assert.equal(showsMark(token, 2), true);
  assert.equal(showsLabel(token, 1, 100, true), true);
});
