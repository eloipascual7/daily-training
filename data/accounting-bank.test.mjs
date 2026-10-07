import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const bank = JSON.parse(readFileSync(new URL("./accounting-bank.json", import.meta.url)));
const review = JSON.parse(readFileSync(new URL("./accounting-review.json", import.meta.url)));
const lessons = JSON.parse(readFileSync(new URL("./accounting-lessons.json", import.meta.url)));

test("accounting bank has at least 24 questions", () => {
  assert.ok(bank.length >= 24, `expected at least 24 questions, got ${bank.length}`);
});

test("all ids are unique and correctly formatted", () => {
  const ids = bank.map((q) => q.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^acc-\d{4}$/);
});

test("every question has a valid shape with exactly one correct option and a cited source", () => {
  for (const q of bank) {
    assert.ok(q.type === "case" || q.type === "quiz", `bad type on ${q.id}`);
    assert.ok(typeof q.topic === "string" && q.topic.length > 0, `missing topic on ${q.id}`);
    assert.ok(Array.isArray(q.frameworks) && q.frameworks.length > 0, `missing frameworks on ${q.id}`);
    assert.ok(typeof q.prompt === "string" && q.prompt.length > 0, `missing prompt on ${q.id}`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `need >=2 options on ${q.id}`);
    const correctCount = q.options.filter((o) => o.correct === true).length;
    assert.strictEqual(correctCount, 1, `expected exactly one correct option on ${q.id}`);
    assert.ok(typeof q.explanation === "string" && q.explanation.length > 0, `missing explanation on ${q.id}`);
    assert.ok(typeof q.source === "string" && q.source.length > 0, `missing source citation on ${q.id}`);
  }
});

test("both case and quiz types are present", () => {
  assert.ok(bank.some((q) => q.type === "case"));
  assert.ok(bank.some((q) => q.type === "quiz"));
});

test("every topic has at least 4 questions (daily deep-dive) and a lesson", () => {
  const counts = {};
  for (const q of bank) counts[q.topic] = (counts[q.topic] || 0) + 1;
  for (const [topic, n] of Object.entries(counts)) {
    assert.ok(n >= 4, `topic ${topic} has only ${n} questions`);
    assert.ok(lessons.some((l) => l.topic === topic), `topic ${topic} has no lesson`);
  }
});

test("review bank: at least 40 questions, valid shape, unique ids", () => {
  assert.ok(review.length >= 40);
  assert.strictEqual(new Set(review.map((q) => q.id)).size, review.length);
  for (const q of review) {
    assert.match(q.id, /^rev-\d{4}$/);
    assert.strictEqual(q.type, "review");
    assert.ok(q.prompt && q.explanation && q.source, `incomplete ${q.id}`);
    assert.strictEqual(q.options.filter((o) => o.correct === true).length, 1, `one correct option on ${q.id}`);
  }
});

// Option length must not give the answer away.
function lengthTells(questions) {
  let longest = 0;
  const outliers = [];
  for (const q of questions) {
    const correct = q.options.find((o) => o.correct).label.length;
    const wrong = q.options.filter((o) => !o.correct).map((o) => o.label.length);
    if (correct > Math.max(...wrong)) longest++;
    if (correct > 1.2 * Math.max(...wrong) || correct < 0.75 * Math.min(...wrong)) outliers.push(q.id);
  }
  return { longestShare: longest / questions.length, outliers };
}

for (const [name, questions] of [["bank", bank], ["review", review]]) {
  test(`${name}: the correct option never stands out by length`, () => {
    const { longestShare, outliers } = lengthTells(questions);
    assert.deepStrictEqual(outliers, [], "correct option >20% longer than every distractor, or much shorter");
    assert.ok(longestShare <= 0.45, `correct option is the longest in ${Math.round(longestShare * 100)}% of questions`);
  });
}
