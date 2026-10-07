import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const ladder = JSON.parse(readFileSync(new URL("./french-ladder.json", import.meta.url)));

test("ladder has at least 3 blocks in ascending order", () => {
  assert.ok(ladder.length >= 3);
  const orders = ladder.map((b) => b.order);
  assert.deepStrictEqual(orders, [...orders].sort((a, b) => a - b));
});

test("the first block is passe-compose (matches defaultProgressState)", () => {
  assert.strictEqual(ladder[0].id, "passe-compose");
});

test("every block has >=8 exercises with a valid shape", () => {
  const validTypes = new Set(["mcq", "fill-blank", "error-spot", "production"]);
  for (const block of ladder) {
    assert.ok(typeof block.masteryThreshold === "number" && block.masteryThreshold > 0);
    assert.ok(block.exercises.length >= 8, `block ${block.id} needs >=8 exercises`);
    for (const ex of block.exercises) {
      assert.ok(validTypes.has(ex.type), `bad type on ${ex.id}`);
      assert.ok(typeof ex.prompt === "string" && ex.prompt.length > 0, `missing prompt on ${ex.id}`);
      assert.ok(typeof ex.correctAnswer === "string" && ex.correctAnswer.length > 0, `missing correctAnswer on ${ex.id}`);
      assert.ok(typeof ex.explanation === "string" && ex.explanation.length > 0, `missing explanation on ${ex.id}`);
      assert.ok(ex.kind === "grammar" || ex.kind === "vocab", `kind must be grammar or vocab on ${ex.id}`);
      if (ex.type === "mcq" && ex.kind === "grammar") {
        const wrong = ex.options.filter((o) => o !== ex.correctAnswer);
        assert.deepStrictEqual(Object.keys(ex.whyWrong ?? {}).sort(), wrong.sort(), `mcq ${ex.id} must explain every wrong option`);
      }
      if (ex.type === "mcq") {
        assert.ok(
          Array.isArray(ex.options) && ex.options.includes(ex.correctAnswer),
          `mcq ${ex.id} must list correctAnswer in options`
        );
      }
    }
  }
});

test("exercise ids are unique across the whole ladder", () => {
  const ids = ladder.flatMap((b) => b.exercises.map((e) => e.id));
  assert.strictEqual(new Set(ids).size, ids.length);
});
