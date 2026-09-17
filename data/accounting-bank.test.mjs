import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const bank = JSON.parse(readFileSync(new URL("./accounting-bank.json", import.meta.url)));

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
