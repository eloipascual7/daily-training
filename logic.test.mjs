import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayISO,
  defaultProgressState,
  serializeProgress,
  deserializeProgress,
  pushRecent,
  accountingModeForDate,
  pickAccountingQuestion,
  pickAccountingTopic,
  pickAccountingSession,
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

test("accountingModeForDate: Mon/Wed/Fri/Sun are case, Tue/Thu/Sat are quiz", () => {
  assert.strictEqual(accountingModeForDate("2026-09-14"), "case"); // Monday
  assert.strictEqual(accountingModeForDate("2026-09-15"), "quiz"); // Tuesday
  assert.strictEqual(accountingModeForDate("2026-09-16"), "case"); // Wednesday
  assert.strictEqual(accountingModeForDate("2026-09-17"), "quiz"); // Thursday
  assert.strictEqual(accountingModeForDate("2026-09-18"), "case"); // Friday
  assert.strictEqual(accountingModeForDate("2026-09-19"), "quiz"); // Saturday
  assert.strictEqual(accountingModeForDate("2026-09-20"), "case"); // Sunday
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

test("pickAccountingTopic only considers topics that have a question of that mode", () => {
  const topic = pickAccountingTopic(sessionBank, "case", [], () => 0);
  assert.strictEqual(topic, "leases"); // the only topic with a "case" question
});

test("pickAccountingTopic avoids recently used topics, falling back when exhausted", () => {
  const allQuizTopics = ["leases", "inventory", "provisions", "fair-value"];
  assert.strictEqual(pickAccountingTopic(sessionBank, "quiz", allQuizTopics, () => 0), "leases");
  assert.notStrictEqual(pickAccountingTopic(sessionBank, "quiz", ["leases"], () => 0), "leases");
});

test("pickAccountingSession mixes topic-of-the-day questions with others, no duplicates, correct size", () => {
  const session = pickAccountingSession(sessionBank, "quiz", "leases", [], 4, Math.random);
  assert.strictEqual(session.length, 4);
  const ids = session.map((q) => q.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(session.some((q) => q.topic === "leases"));
  assert.ok(session.some((q) => q.topic !== "leases"));
});

test("pickAccountingSession never exceeds the available pool for that mode", () => {
  const session = pickAccountingSession(sessionBank, "quiz", "leases", [], 10, Math.random);
  assert.strictEqual(session.length, 5); // only 5 "quiz" questions exist in sessionBank
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
