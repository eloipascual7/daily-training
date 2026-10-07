import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const bank = JSON.parse(readFileSync(new URL("./english-bank.json", import.meta.url)));

test("bank has at least 6 exercises per focus", () => {
  for (const focus of ["nuance", "vocab-idioms", "writing"]) {
    const count = bank.filter((e) => e.focus === focus).length;
    assert.ok(count >= 6, `expected >=6 exercises for focus "${focus}", got ${count}`);
  }
});

test("ids are unique and shape is valid per type", () => {
  const ids = bank.map((e) => e.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const e of bank) {
    assert.match(e.id, /^en-\d{4}$/);
    assert.ok(["mcq", "rewrite"].includes(e.type), `bad type on ${e.id}`);
    assert.ok(typeof e.prompt === "string" && e.prompt.length > 0, `missing prompt on ${e.id}`);
    assert.ok(typeof e.explanation === "string" && e.explanation.length > 0, `missing explanation on ${e.id}`);
    if (e.type === "mcq") {
      assert.ok(Array.isArray(e.options) && e.options.length >= 2, `need options on ${e.id}`);
      assert.strictEqual(
        e.options.filter((o) => o.correct === true).length,
        1,
        `need exactly one correct option on ${e.id}`
      );
    } else {
      assert.ok(typeof e.modelAnswer === "string" && e.modelAnswer.length > 0, `missing modelAnswer on ${e.id}`);
    }
  }
});

test("bank has at least 15 exercises per focus (higher-level bank)", () => {
  for (const focus of ["nuance", "vocab-idioms", "writing"]) {
    assert.ok(bank.filter((e) => e.focus === focus).length >= 15, `focus ${focus} needs >=15`);
  }
});

test("mcq: the correct option never stands out by length", () => {
  for (const e of bank.filter((x) => x.type === "mcq")) {
    const correct = e.options.find((o) => o.correct).label.length;
    const wrong = e.options.filter((o) => !o.correct).map((o) => o.label.length);
    assert.ok(correct <= 1.2 * Math.max(...wrong) && correct >= 0.75 * Math.min(...wrong), `length gives away ${e.id}`);
  }
});
