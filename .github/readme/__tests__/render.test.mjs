import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateLanguages,
  barSegments,
  escapeXml,
  formatUptime,
  recentRepos,
  renderProjectCard,
  wrapText,
} from "../render.mjs";

const repo = (...langs) => ({
  languages: langs.map(([name, size]) => ({ name, size })),
});

test("recentRepos: pushed 3y+1d ago is out, 3y-1d ago is in", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const old = { name: "old", pushedAt: "2023-10-29T12:00:00Z" };
  const fresh = { name: "fresh", pushedAt: "2023-10-31T12:00:00Z" };
  assert.deepEqual(recentRepos([old, fresh], now), [fresh]);
});

test("aggregateLanguages: no languages gives no bar", () => {
  assert.deepEqual(aggregateLanguages([]), []);
  assert.deepEqual(aggregateLanguages([repo()]), []);
});

test("aggregateLanguages: a single language is 100%", () => {
  assert.deepEqual(aggregateLanguages([repo(["Go", 10])]), [
    { name: "Go", percent: 100, bytes: 10 },
  ]);
});

test("aggregateLanguages: sums a language across repos", () => {
  const out = aggregateLanguages([repo(["Go", 30], ["Ruby", 10]), repo(["Go", 30])]);
  assert.deepEqual(out, [
    { name: "Go", percent: 86, bytes: 60 },
    { name: "Ruby", percent: 14, bytes: 10 },
  ]);
});

test("aggregateLanguages: more than five becomes top five plus Other", () => {
  const out = aggregateLanguages([
    repo(["A", 50], ["B", 20], ["C", 10], ["D", 8], ["E", 6], ["F", 4], ["G", 2]),
  ]);
  assert.deepEqual(
    out.map((l) => [l.name, l.percent]),
    [["A", 50], ["B", 20], ["C", 10], ["D", 8], ["E", 6], ["Other", 6]],
  );
});

test("aggregateLanguages: exactly five has no Other", () => {
  const out = aggregateLanguages([
    repo(["A", 5], ["B", 4], ["C", 3], ["D", 2], ["E", 1]),
  ]);
  assert.deepEqual(out.map((l) => l.name), ["A", "B", "C", "D", "E"]);
});

test("aggregateLanguages: Jupyter Notebook is dropped before ranking", () => {
  const out = aggregateLanguages([repo(["Jupyter Notebook", 1000], ["Python", 10])]);
  assert.deepEqual(out, [{ name: "Python", percent: 100, bytes: 10 }]);
  assert.deepEqual(aggregateLanguages([repo(["Jupyter Notebook", 1000])]), []);
});

test("aggregateLanguages: shown percents sum to 100 after rounding", () => {
  const thirds = aggregateLanguages([repo(["A", 1], ["B", 1], ["C", 1])]);
  assert.deepEqual(thirds.map((l) => l.percent), [34, 33, 33]);
  const twoThirds = aggregateLanguages([repo(["A", 2], ["B", 1])]);
  assert.deepEqual(twoThirds.map((l) => l.percent), [67, 33]);
});

test("formatUptime: whole years and months", () => {
  assert.equal(
    formatUptime("2016-12-30T07:46:40Z", new Date("2026-10-30T12:00:00Z")),
    "9y 10m",
  );
  assert.equal(
    formatUptime("2016-12-30T07:46:40Z", new Date("2026-12-30T12:00:00Z")),
    "10y 0m",
  );
});

test("formatUptime: a month only counts once its day-of-month is reached", () => {
  assert.equal(
    formatUptime("2016-12-30T07:46:40Z", new Date("2026-10-29T12:00:00Z")),
    "9y 9m",
  );
});

test("formatUptime: under a year drops the year part", () => {
  assert.equal(
    formatUptime("2026-06-15T00:00:00Z", new Date("2026-10-30T00:00:00Z")),
    "4m",
  );
  assert.equal(
    formatUptime("2026-10-02T00:00:00Z", new Date("2026-10-30T00:00:00Z")),
    "0m",
  );
});

test("wrapText: a line that exactly fits stays on one line", () => {
  assert.deepEqual(wrapText("aaa bbb", 7), ["aaa bbb"]);
  assert.deepEqual(wrapText("aaa bbb", 6), ["aaa", "bbb"]);
});

test("wrapText: a word longer than the width gets its own unbroken line", () => {
  assert.deepEqual(wrapText("a verylongword b", 4), ["a", "verylongword", "b"]);
  assert.deepEqual(wrapText("verylongword", 4), ["verylongword"]);
});

test("wrapText: empty text gives no lines", () => {
  assert.deepEqual(wrapText("", 10), []);
});

test("escapeXml: escapes & < > and double quotes, & first", () => {
  assert.equal(escapeXml(`a & b <c> "d"`), "a &amp; b &lt;c&gt; &quot;d&quot;");
  assert.equal(escapeXml("&lt;"), "&amp;lt;");
});

test("barSegments: widths are integers that sum exactly to the bar width", () => {
  const segs = barSegments(
    [
      { name: "A", percent: 34, bytes: 1 },
      { name: "B", percent: 33, bytes: 1 },
      { name: "C", percent: 33, bytes: 1 },
    ],
    100,
  );
  assert.deepEqual(segs.map((s) => [s.x, s.width]), [[0, 34], [34, 33], [67, 33]]);
  const odd = barSegments(
    [
      { name: "A", percent: 34, bytes: 1 },
      { name: "B", percent: 33, bytes: 1 },
      { name: "C", percent: 33, bytes: 1 },
    ],
    200,
  );
  assert.deepEqual(odd.map((s) => [s.x, s.width]), [[0, 68], [68, 66], [134, 66]]);
});

const card = { slug: "o/r", dir: "r", title: "R", blurb: "A short blurb." };

test("renderProjectCard: zero stars hides the star shape and the count", () => {
  const svg = renderProjectCard(card, { stars: 0, language: "Go" }, "#9d8ff2");
  assert.ok(!svg.includes("<polygon"));
  assert.ok(!svg.includes('text-anchor="end"'));
  assert.ok(svg.includes(">Go<"));
});

test("renderProjectCard: one star shows the star shape and the count", () => {
  const svg = renderProjectCard(card, { stars: 1, language: "Go" }, "#9d8ff2");
  assert.ok(svg.includes("<polygon"));
  assert.ok(svg.includes('text-anchor="end">1</text>'));
});
