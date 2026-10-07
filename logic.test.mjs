import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayISO,
  defaultProgressState,
  serializeProgress,
  deserializeProgress,
  pushRecent,
  pickAccountingQuestion,
  pickAccountingTopic,
  pickAccountingSession,
  pickReviewQuestion,
  getBlockById,
  pickFrenchExercise,
  advanceFrenchState,
  nextEnglishFocus,
  pickEnglishExercise,
} from "./logic.js";

test("todayISO formats a fixed date as YYYY-MM-DD", () => {
  assert.strictEqual(todayISO(new Date(2026, 0, 5)), "2026-01-05");
  assert.strictEqual(todayISO(new Date(2026, 10, 23)), "2026-11-23");
});

test("defaultProgressState has the expected shape", () => {
  const state = defaultProgressState();
  assert.strictEqual(state.streakDays, 0);
  assert.strictEqual(state.lastCompletedDate, null);
  assert.deepStrictEqual(state.accounting, { recentIds: [], recentTopics: [] });
  assert.strictEqual(state.french.currentBlockId, "passe-compose");
  assert.strictEqual(state.french.consecutiveCorrect, 0);
  assert.deepStrictEqual(state.english, { lastFocus: null, recentIds: [] });
});

test("serializeProgress + deserializeProgress round-trip", () => {
  const state = defaultProgressState();
  state.streakDays = 7;
  state.accounting.recentIds.push("acc-0001");
  const roundTripped = deserializeProgress(serializeProgress(state));
  assert.deepStrictEqual(roundTripped, state);
});

test("deserializeProgress returns defaults on null/invalid input", () => {
  assert.deepStrictEqual(deserializeProgress(null), defaultProgressState());
  assert.deepStrictEqual(deserializeProgress("not json"), defaultProgressState());
  assert.deepStrictEqual(deserializeProgress("{}"), defaultProgressState());
});

test("pushRecent appends and caps at maxLen, deduplicating", () => {
  let list = [];
  for (const id of ["a", "b", "c"]) list = pushRecent(list, id, 2);
  assert.deepStrictEqual(list, ["b", "c"]);

  const deduped = pushRecent(["x", "y"], "x", 5);
  assert.deepStrictEqual(deduped, ["y", "x"]);
});

test("pickAccountingQuestion filters by mode and avoids recent ids", () => {
  const bank = [
    { id: "q1", type: "case" },
    { id: "q2", type: "case" },
    { id: "q3", type: "quiz" },
  ];
  const picked = pickAccountingQuestion(bank, "case", ["q1"], () => 0);
  assert.strictEqual(picked.id, "q2");
});

test("pickAccountingQuestion falls back to full pool when all recently seen", () => {
  const bank = [
    { id: "q1", type: "quiz" },
    { id: "q2", type: "quiz" },
  ];
  const picked = pickAccountingQuestion(bank, "quiz", ["q1", "q2"], () => 0);
  assert.strictEqual(picked.id, "q1");
});

test("pickAccountingQuestion throws when no question matches the mode", () => {
  assert.throws(() => pickAccountingQuestion([{ id: "q1", type: "quiz" }], "case", []));
});

const sessionBank = [
  { id: "a1", type: "quiz", topic: "leases" },
  { id: "a2", type: "quiz", topic: "leases" },
  { id: "a3", type: "quiz", topic: "inventory" },
  { id: "a4", type: "quiz", topic: "provisions" },
  { id: "a5", type: "quiz", topic: "fair-value" },
  { id: "a6", type: "case", topic: "leases" },
];

test("pickAccountingTopic considers every topic regardless of type", () => {
  const topics = new Set();
  for (let i = 0; i < 4; i++) topics.add(pickAccountingTopic(sessionBank, [], () => i / 4));
  assert.deepStrictEqual([...topics].sort(), ["fair-value", "inventory", "leases", "provisions"]);
});

test("pickAccountingTopic avoids recently used topics, falling back when exhausted", () => {
  const allTopics = ["leases", "inventory", "provisions", "fair-value"];
  assert.strictEqual(pickAccountingTopic(sessionBank, allTopics, () => 0), "leases");
  assert.notStrictEqual(pickAccountingTopic(sessionBank, ["leases"], () => 0), "leases");
});

test("pickAccountingSession returns only topic-of-the-day questions (case and quiz mixed), no duplicates", () => {
  const session = pickAccountingSession(sessionBank, "leases", [], 4, Math.random);
  assert.strictEqual(session.length, 3); // only 3 "leases" questions exist in sessionBank
  assert.ok(session.every((q) => q.topic === "leases"));
  assert.strictEqual(new Set(session.map((q) => q.id)).size, 3);
  assert.ok(session.some((q) => q.type === "case") && session.some((q) => q.type === "quiz"));
});

test("pickAccountingSession prefers questions not seen recently", () => {
  const session = pickAccountingSession(sessionBank, "leases", ["a1"], 2, Math.random);
  assert.deepStrictEqual(session.map((q) => q.id).sort(), ["a2", "a6"]);
});

test("pickReviewQuestion avoids recent ids, falls back when exhausted, throws on empty bank", () => {
  const review = [{ id: "r1" }, { id: "r2" }];
  assert.strictEqual(pickReviewQuestion(review, ["r1"], () => 0).id, "r2");
  assert.strictEqual(pickReviewQuestion(review, ["r1", "r2"], () => 0).id, "r1");
  assert.throws(() => pickReviewQuestion([], []));
});

const testLadder = [
  { id: "block-a", order: 1, masteryThreshold: 3, exercises: [{ id: "a1" }, { id: "a2" }] },
  { id: "block-b", order: 2, masteryThreshold: 3, exercises: [{ id: "b1" }] },
];

test("getBlockById returns the matching block", () => {
  assert.strictEqual(getBlockById(testLadder, "block-b").id, "block-b");
});

test("getBlockById throws on unknown id", () => {
  assert.throws(() => getBlockById(testLadder, "nope"));
});

test("pickFrenchExercise avoids recent ids, falls back when exhausted", () => {
  const block = testLadder[0];
  assert.strictEqual(pickFrenchExercise(block, ["a1"], () => 0).id, "a2");
  assert.strictEqual(pickFrenchExercise(block, ["a1", "a2"], () => 0).id, "a1");
});

test("advanceFrenchState resets the counter on an incorrect answer", () => {
  const state = { currentBlockId: "block-a", consecutiveCorrect: 2, recentExerciseIds: [] };
  const next = advanceFrenchState(testLadder, state, false);
  assert.strictEqual(next.currentBlockId, "block-a");
  assert.strictEqual(next.consecutiveCorrect, 0);
});

test("advanceFrenchState increments the counter below mastery threshold", () => {
  const state = { currentBlockId: "block-a", consecutiveCorrect: 1, recentExerciseIds: [] };
  const next = advanceFrenchState(testLadder, state, true);
  assert.strictEqual(next.currentBlockId, "block-a");
  assert.strictEqual(next.consecutiveCorrect, 2);
});

test("advanceFrenchState moves to the next block at mastery threshold", () => {
  const state = { currentBlockId: "block-a", consecutiveCorrect: 2, recentExerciseIds: [] };
  const next = advanceFrenchState(testLadder, state, true);
  assert.strictEqual(next.currentBlockId, "block-b");
  assert.strictEqual(next.consecutiveCorrect, 0);
});

test("advanceFrenchState caps out gracefully on the last block", () => {
  const state = { currentBlockId: "block-b", consecutiveCorrect: 2, recentExerciseIds: [] };
  const next = advanceFrenchState(testLadder, state, true);
  assert.strictEqual(next.currentBlockId, "block-b");
  assert.strictEqual(next.consecutiveCorrect, 3);
  assert.strictEqual(next.completedLadder, true);
});

test("nextEnglishFocus cycles nuance -> vocab-idioms -> writing -> nuance", () => {
  assert.strictEqual(nextEnglishFocus(null), "nuance");
  assert.strictEqual(nextEnglishFocus("nuance"), "vocab-idioms");
  assert.strictEqual(nextEnglishFocus("vocab-idioms"), "writing");
  assert.strictEqual(nextEnglishFocus("writing"), "nuance");
  assert.strictEqual(nextEnglishFocus("unknown-focus"), "nuance");
});

test("pickEnglishExercise filters by focus and avoids recent ids", () => {
  const bank = [
    { id: "e1", focus: "nuance" },
    { id: "e2", focus: "nuance" },
    { id: "e3", focus: "writing" },
  ];
  const picked = pickEnglishExercise(bank, "nuance", ["e1"], () => 0);
  assert.strictEqual(picked.id, "e2");
});
