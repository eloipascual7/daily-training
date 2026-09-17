# Daily Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-cost, mobile-first static web app that runs three consecutive 5-minute practice blocks (accounting/audit standards, French grammar, workplace English) each day, tracking progress in the browser.

**Architecture:** Pure static site (HTML/CSS/ES-module JS), no backend, no build step. All practice logic (question selection, French ladder progression, English focus rotation) lives in a dependency-free pure-function module (`logic.js`) that is imported both by the browser (`script.js`) and by Node's built-in test runner — so the core logic is unit-tested without any test framework dependency. Content lives in three static JSON files. Progress persists in `localStorage`; there is no server-side state.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), Node.js built-in test runner (`node --test`, zero npm dependencies), Cloudflare Pages (free tier) for hosting.

## Global Constraints

- Zero recurring monetary cost — no API calls, no paid hosting tier.
- No build tools, no npm dependencies (Node's built-in `node:test`/`node:assert` only).
- Every accounting/audit question must carry a real, verifiable standard + paragraph citation (see spec §"Fuentes").
- Mobile-first, single page, three blocks run back-to-back without leaving the page.
- Progress persists in `localStorage` under key `daily-training-progress`.

---

## Task 1: Core state utilities (`logic.js` — part 1)

**Files:**
- Create: `logic.js`
- Create: `package.json`
- Test: `logic.test.mjs`

**Interfaces:**
- Produces: `todayISO(date = new Date()) -> string` ("YYYY-MM-DD"), `defaultProgressState() -> ProgressState`, `serializeProgress(state) -> string`, `deserializeProgress(json) -> ProgressState`, `pushRecent(list, id, maxLen = 15) -> string[]`
- `ProgressState` shape: `{ streakDays: number, lastCompletedDate: string|null, accounting: { recentIds: string[] }, french: { currentBlockId: string, consecutiveCorrect: number, recentExerciseIds: string[] }, english: { lastFocus: string|null, recentIds: string[] } }`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "daily-training",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `logic.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayISO,
  defaultProgressState,
  serializeProgress,
  deserializeProgress,
  pushRecent,
} from "./logic.js";

test("todayISO formats a fixed date as YYYY-MM-DD", () => {
  assert.strictEqual(todayISO(new Date(2026, 0, 5)), "2026-01-05");
  assert.strictEqual(todayISO(new Date(2026, 10, 23)), "2026-11-23");
});

test("defaultProgressState has the expected shape", () => {
  const state = defaultProgressState();
  assert.strictEqual(state.streakDays, 0);
  assert.strictEqual(state.lastCompletedDate, null);
  assert.deepStrictEqual(state.accounting, { recentIds: [] });
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `Cannot find module './logic.js'`

- [ ] **Step 4: Implement `logic.js`**

```js
export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultProgressState() {
  return {
    streakDays: 0,
    lastCompletedDate: null,
    accounting: { recentIds: [] },
    french: { currentBlockId: "passe-compose", consecutiveCorrect: 0, recentExerciseIds: [] },
    english: { lastFocus: null, recentIds: [] },
  };
}

export function serializeProgress(state) {
  return JSON.stringify(state);
}

export function deserializeProgress(json) {
  const defaults = defaultProgressState();
  if (!json) return defaults;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== "object") return defaults;
  return {
    streakDays: typeof parsed.streakDays === "number" ? parsed.streakDays : defaults.streakDays,
    lastCompletedDate:
      typeof parsed.lastCompletedDate === "string" ? parsed.lastCompletedDate : defaults.lastCompletedDate,
    accounting: {
      recentIds: Array.isArray(parsed.accounting?.recentIds) ? parsed.accounting.recentIds : [],
    },
    french: {
      currentBlockId:
        typeof parsed.french?.currentBlockId === "string"
          ? parsed.french.currentBlockId
          : defaults.french.currentBlockId,
      consecutiveCorrect:
        typeof parsed.french?.consecutiveCorrect === "number" ? parsed.french.consecutiveCorrect : 0,
      recentExerciseIds: Array.isArray(parsed.french?.recentExerciseIds) ? parsed.french.recentExerciseIds : [],
    },
    english: {
      lastFocus: typeof parsed.english?.lastFocus === "string" ? parsed.english.lastFocus : null,
      recentIds: Array.isArray(parsed.english?.recentIds) ? parsed.english.recentIds : [],
    },
  };
}

export function pushRecent(list, id, maxLen = 15) {
  const next = [...list.filter((x) => x !== id), id];
  while (next.length > maxLen) next.shift();
  return next;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json logic.js logic.test.mjs
git commit -m "feat: add core progress-state utilities"
```

---

## Task 2: Accounting selection logic (`logic.js` — part 2)

**Files:**
- Modify: `logic.js`
- Modify: `logic.test.mjs`

**Interfaces:**
- Consumes: nothing new from Task 1 directly (operates on plain arrays/dates)
- Produces: `accountingModeForDate(dateISO) -> "case"|"quiz"`, `pickAccountingQuestion(bank, mode, recentIds, randomFn = Math.random) -> QuestionObject`

- [ ] **Step 1: Write the failing tests**

Append to `logic.test.mjs`:

```js
import { accountingModeForDate, pickAccountingQuestion } from "./logic.js";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `accountingModeForDate is not a function`

- [ ] **Step 3: Implement**

Append to `logic.js`:

```js
export function accountingModeForDate(dateISO) {
  const day = new Date(`${dateISO}T00:00:00`).getDay(); // 0=Sun..6=Sat
  const caseDays = new Set([0, 1, 3, 5]); // Sun, Mon, Wed, Fri
  return caseDays.has(day) ? "case" : "quiz";
}

export function pickAccountingQuestion(bank, mode, recentIds, randomFn = Math.random) {
  const pool = bank.filter((q) => q.type === mode);
  if (pool.length === 0) throw new Error(`No accounting questions of type "${mode}"`);
  let candidates = pool.filter((q) => !recentIds.includes(q.id));
  if (candidates.length === 0) candidates = pool;
  return candidates[Math.floor(randomFn() * candidates.length)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (9 tests total)

- [ ] **Step 5: Commit**

```bash
git add logic.js logic.test.mjs
git commit -m "feat: add accounting question selection logic"
```

---

## Task 3: French ladder progression logic (`logic.js` — part 3)

**Files:**
- Modify: `logic.js`
- Modify: `logic.test.mjs`

**Interfaces:**
- Produces: `getBlockById(ladder, id) -> Block`, `pickFrenchExercise(block, recentIds, randomFn = Math.random) -> Exercise`, `advanceFrenchState(ladder, frenchState, wasCorrect) -> FrenchState`

- [ ] **Step 1: Write the failing tests**

Append to `logic.test.mjs`:

```js
import { getBlockById, pickFrenchExercise, advanceFrenchState } from "./logic.js";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `getBlockById is not a function`

- [ ] **Step 3: Implement**

Append to `logic.js`:

```js
export function getBlockById(ladder, id) {
  const block = ladder.find((b) => b.id === id);
  if (!block) throw new Error(`Unknown French block id "${id}"`);
  return block;
}

export function pickFrenchExercise(block, recentIds, randomFn = Math.random) {
  let candidates = block.exercises.filter((ex) => !recentIds.includes(ex.id));
  if (candidates.length === 0) candidates = block.exercises;
  return candidates[Math.floor(randomFn() * candidates.length)];
}

export function advanceFrenchState(ladder, frenchState, wasCorrect) {
  const currentIndex = ladder.findIndex((b) => b.id === frenchState.currentBlockId);
  if (currentIndex === -1) throw new Error(`Unknown French block id "${frenchState.currentBlockId}"`);
  const block = ladder[currentIndex];

  if (!wasCorrect) {
    return { ...frenchState, consecutiveCorrect: 0 };
  }

  const consecutiveCorrect = frenchState.consecutiveCorrect + 1;
  if (consecutiveCorrect < block.masteryThreshold) {
    return { ...frenchState, consecutiveCorrect };
  }

  const nextBlock = ladder[currentIndex + 1];
  if (!nextBlock) {
    return { ...frenchState, consecutiveCorrect, completedLadder: true };
  }
  return { ...frenchState, currentBlockId: nextBlock.id, consecutiveCorrect: 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (16 tests total)

- [ ] **Step 5: Commit**

```bash
git add logic.js logic.test.mjs
git commit -m "feat: add French grammar ladder progression logic"
```

---

## Task 4: English rotation logic (`logic.js` — part 4)

**Files:**
- Modify: `logic.js`
- Modify: `logic.test.mjs`

**Interfaces:**
- Produces: `nextEnglishFocus(lastFocus) -> "nuance"|"vocab-idioms"|"writing"`, `pickEnglishExercise(bank, focus, recentIds, randomFn = Math.random) -> Exercise`

- [ ] **Step 1: Write the failing tests**

Append to `logic.test.mjs`:

```js
import { nextEnglishFocus, pickEnglishExercise } from "./logic.js";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `nextEnglishFocus is not a function`

- [ ] **Step 3: Implement**

Append to `logic.js`:

```js
const ENGLISH_FOCUS_ORDER = ["nuance", "vocab-idioms", "writing"];

export function nextEnglishFocus(lastFocus) {
  const index = ENGLISH_FOCUS_ORDER.indexOf(lastFocus);
  if (index === -1) return ENGLISH_FOCUS_ORDER[0];
  return ENGLISH_FOCUS_ORDER[(index + 1) % ENGLISH_FOCUS_ORDER.length];
}

export function pickEnglishExercise(bank, focus, recentIds, randomFn = Math.random) {
  const pool = bank.filter((ex) => ex.focus === focus);
  if (pool.length === 0) throw new Error(`No English exercises for focus "${focus}"`);
  let candidates = pool.filter((ex) => !recentIds.includes(ex.id));
  if (candidates.length === 0) candidates = pool;
  return candidates[Math.floor(randomFn() * candidates.length)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (18 tests total)

- [ ] **Step 5: Commit**

```bash
git add logic.js logic.test.mjs
git commit -m "feat: add English focus rotation logic"
```

---

## Task 5: Accounting content bank

**Files:**
- Create: `data/accounting-bank.json`
- Test: `data/accounting-bank.test.mjs`

**Interfaces:**
- Produces: a JSON array on disk matching `{id, type: "case"|"quiz", topic, frameworks: string[], prompt, options: [{label, correct}], explanation, source}[]`, consumed by `pickAccountingQuestion` (Task 2) at runtime.

- [ ] **Step 1: Write the failing schema test**

Create `data/accounting-bank.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `ENOENT: no such file or directory, open '.../data/accounting-bank.json'`

- [ ] **Step 3: Create `data/accounting-bank.json`**

Content researched from official primary sources (IFRS Foundation standard text, PCAOB, IAASB, Swiss GAAP FER/fer.ch) on 2026-09-17:

```json
[
  {
    "id": "acc-0001",
    "type": "case",
    "topic": "revenue-recognition",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "A Swiss company sells a one-year software license bundled with mandatory post-sale support, invoiced and collected upfront. Under IFRS, when is the license + support revenue recognised? How does Swiss GAAP FER differ?",
    "options": [
      { "label": "Under IFRS 15, the transaction price is allocated between the license and support performance obligations; the license is typically recognised at the point in time control transfers, while support is recognised over the contract term. Swiss GAAP FER has no standalone revenue standard equivalent to IFRS 15 and instead relies on the general realisation principle in FER 2, without a formal multi-step allocation model.", "correct": true },
      { "label": "Both frameworks require immediate recognition of the full amount on invoicing, since cash was collected upfront.", "correct": false },
      { "label": "IFRS 15 defers all revenue until the support period ends, exactly matching Swiss GAAP FER practice.", "correct": false }
    ],
    "explanation": "IFRS 15's 5-step model forces separation of the license and support performance obligations. Swiss GAAP FER, being more principles-based, has no equivalent standalone standard, so practice follows the general prudence/realisation principle in FER 2.",
    "source": "IFRS 15 (5-step model, performance obligations); Swiss GAAP FER 2 (valuation/realisation principle)"
  },
  {
    "id": "acc-0002",
    "type": "quiz",
    "topic": "revenue-recognition",
    "frameworks": ["IFRS"],
    "prompt": "Under IFRS 15, when must an entity recognise revenue over time rather than at a point in time?",
    "options": [
      { "label": "Whenever the customer pays in advance", "correct": false },
      { "label": "When one of the over-time criteria is met - e.g. the customer simultaneously receives and consumes the benefits, or the asset has no alternative use to the entity and it has an enforceable right to payment for performance completed to date", "correct": true },
      { "label": "Only for construction contracts", "correct": false },
      { "label": "Never - all IFRS 15 revenue is recognised at a point in time", "correct": false }
    ],
    "explanation": "IFRS 15 sets out specific over-time recognition criteria (commonly cited as §35); if none is met, revenue is recognised at the point in time control transfers to the customer.",
    "source": "IFRS 15 §35 (over-time recognition criteria)"
  },
  {
    "id": "acc-0003",
    "type": "case",
    "topic": "held-for-sale",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "A group commits to a plan to sell a manufacturing subsidiary; the sale is expected to complete within 6 months and the subsidiary is being actively marketed. How is this reflected under IFRS, and does Swiss GAAP FER have an equivalent requirement?",
    "options": [
      { "label": "Under IFRS 5 §§6-8, once the criteria are met (available for immediate sale, sale highly probable within one year, actively marketed), the disposal group is reclassified as held for sale, measured at the lower of carrying amount and fair value less costs to sell, and depreciation stops. Swiss GAAP FER has no equivalent 'held for sale' reclassification standard - the assets normally continue to be presented and measured as before until actually sold.", "correct": true },
      { "label": "Both frameworks require identical held-for-sale reclassification with a dedicated line item.", "correct": false },
      { "label": "IFRS prohibits reclassification until the sale is legally completed.", "correct": false }
    ],
    "explanation": "IFRS 5 is a dedicated standard for non-current assets/disposal groups held for sale; Swiss GAAP FER has no direct counterpart - one of the most commonly tested IFRS-vs-FER differences.",
    "source": "IFRS 5 §§6-8"
  },
  {
    "id": "acc-0004",
    "type": "quiz",
    "topic": "held-for-sale",
    "frameworks": ["IFRS"],
    "prompt": "Which of these is NOT one of the IFRS 5 conditions for classifying a non-current asset as held for sale?",
    "options": [
      { "label": "The asset must be available for immediate sale in its present condition", "correct": false },
      { "label": "The sale must be highly probable, generally expected within one year", "correct": false },
      { "label": "The asset must have already generated a binding, unconditional sale contract", "correct": true },
      { "label": "Management must be committed to a plan to sell and actively marketing the asset at a reasonable price", "correct": false }
    ],
    "explanation": "IFRS 5 requires the sale to be highly probable and actively marketed, but does not require an already-signed unconditional sale agreement at the classification date.",
    "source": "IFRS 5 §§7-8"
  },
  {
    "id": "acc-0005",
    "type": "case",
    "topic": "inventory",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "At year-end, a client's finished-goods inventory has a cost of CHF 100,000 but, due to a market downturn, an estimated net realisable value of CHF 85,000. How should this be measured under IAS 2, and is the Swiss GAAP FER approach materially different?",
    "options": [
      { "label": "IAS 2.9 requires inventories to be measured at the lower of cost and net realisable value, so the inventory must be written down to CHF 85,000. Swiss GAAP FER 17 follows the same conservative lower-of logic consistent with FER's general prudence principle (FER 2), so the practical outcome is very similar.", "correct": true },
      { "label": "IAS 2 allows inventory to remain at cost regardless of market value declines.", "correct": false },
      { "label": "Only Swiss GAAP FER requires a write-down; IFRS does not.", "correct": false }
    ],
    "explanation": "Both frameworks apply a conservative lower-of approach to inventory, so the numerical outcome is usually the same even though FER's guidance is less detailed than IAS 2's.",
    "source": "IAS 2 §9; Swiss GAAP FER 17 (Vorräte/inventories), general prudence principle FER 2"
  },
  {
    "id": "acc-0006",
    "type": "case",
    "topic": "leases",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "A company signs a 5-year lease for office space (not short-term, not low-value). How is this reflected on the lessee's balance sheet under IFRS 16, compared with Swiss GAAP FER?",
    "options": [
      { "label": "Under IFRS 16 §22, the lessee recognises a right-of-use asset and a lease liability at the commencement date for virtually all leases. Under Swiss GAAP FER 13, the lessee still distinguishes between finance leases (capitalised) and operating leases (kept off-balance-sheet, disclosed in the notes) - a 5-year office lease would often still qualify as an operating lease and stay off-balance-sheet under FER.", "correct": true },
      { "label": "Both frameworks eliminated the operating lease category for lessees.", "correct": false },
      { "label": "IFRS 16 keeps the old operating/finance lease split; only FER changed.", "correct": false }
    ],
    "explanation": "One of the most-tested IFRS-vs-Swiss-GAAP-FER differences: IFRS 16 brought (almost) all leases onto the lessee's balance sheet, while FER 13 still runs the old dual model.",
    "source": "IFRS 16 §22; Swiss GAAP FER 13 (Leasinggeschäfte)"
  },
  {
    "id": "acc-0007",
    "type": "quiz",
    "topic": "leases",
    "frameworks": ["IFRS"],
    "prompt": "Under IFRS 16, a lessee can elect NOT to recognise a right-of-use asset and lease liability for which types of leases?",
    "options": [
      { "label": "Short-term leases (12 months or less, no purchase option) and leases of low-value underlying assets", "correct": true },
      { "label": "Any lease under CHF 1 million", "correct": false },
      { "label": "Leases of real estate only", "correct": false },
      { "label": "There is no such exemption under IFRS 16", "correct": false }
    ],
    "explanation": "IFRS 16 provides two recognition exemptions available to lessees: short-term leases and low-value assets; if elected, lease payments are expensed on a systematic basis instead.",
    "source": "IFRS 16 §§5-8"
  },
  {
    "id": "acc-0008",
    "type": "case",
    "topic": "intangible-assets",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "A company acquires a trademark with no foreseeable limit on the period it will generate cash flows. How is its useful life treated under IAS 38, and how does Swiss GAAP FER 10 differ?",
    "options": [
      { "label": "Under IAS 38, an intangible asset with an indefinite useful life is not amortised; instead it is tested for impairment at least annually under IAS 36. Under Swiss GAAP FER 10, intangible assets are always amortised over their estimated useful life, and if that life cannot be reliably determined, a default period of 5 years is used (up to a maximum of 20 years in justified cases) - FER has no 'indefinite life, no amortisation' category.", "correct": true },
      { "label": "Both frameworks forbid amortising intangible assets.", "correct": false },
      { "label": "IAS 38 always requires a maximum 20-year amortisation period like FER 10.", "correct": false }
    ],
    "explanation": "This indefinite-life treatment (no amortisation, impairment-only) is unique to IFRS; Swiss GAAP FER's more conservative approach always amortises intangibles, defaulting to 5 years when useful life is uncertain.",
    "source": "IAS 38 (indefinite useful life, impairment-only under IAS 36); Swiss GAAP FER 10 (Immaterielle Werte)"
  },
  {
    "id": "acc-0009",
    "type": "quiz",
    "topic": "intangible-assets",
    "frameworks": ["IFRS"],
    "prompt": "How often must an intangible asset with an indefinite useful life be tested for impairment under IAS 36?",
    "options": [
      { "label": "Only when there is an indicator of impairment", "correct": false },
      { "label": "At least annually, and whenever there is an indication of impairment", "correct": true },
      { "label": "Every 5 years", "correct": false },
      { "label": "Never - indefinite-life intangibles are not tested", "correct": false }
    ],
    "explanation": "Unlike most assets (tested only when indicators exist), indefinite-life intangibles and goodwill require a mandatory annual impairment test regardless of indicators.",
    "source": "IAS 36 (annual impairment test for indefinite-life intangibles and goodwill)"
  },
  {
    "id": "acc-0010",
    "type": "case",
    "topic": "ppe",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "After initial recognition, IAS 16 allows a choice of measurement model for a class of property, plant and equipment. What are the options, and how does Swiss GAAP FER 18 compare?",
    "options": [
      { "label": "IAS 16 allows an accounting policy choice, by class of asset, between the cost model and the revaluation model (fair value less subsequent depreciation). Swiss GAAP FER 18 is more conservative and is generally built around the cost model, without an equivalent revaluation option.", "correct": true },
      { "label": "Both frameworks require fair value remeasurement of all PP&E every year.", "correct": false },
      { "label": "IAS 16 only permits the cost model, identical to FER 18.", "correct": false }
    ],
    "explanation": "The revaluation model under IAS 16 is a genuine policy choice not generally mirrored in Swiss GAAP FER, which stays closer to historical cost.",
    "source": "IAS 16 (cost vs revaluation model); Swiss GAAP FER 18 (Sachanlagen)"
  },
  {
    "id": "acc-0011",
    "type": "quiz",
    "topic": "ppe",
    "frameworks": ["IFRS"],
    "prompt": "Under IAS 16, if an aircraft's engine has a materially different useful life from the airframe, how should it be depreciated?",
    "options": [
      { "label": "The whole aircraft must be depreciated as a single unit", "correct": false },
      { "label": "The engine must be identified and depreciated separately as a significant component with its own useful life", "correct": true },
      { "label": "Components are only separated for tax purposes, never for IFRS depreciation", "correct": false },
      { "label": "IAS 16 does not allow component depreciation", "correct": false }
    ],
    "explanation": "IAS 16 requires significant parts of an asset with materially different useful lives to be depreciated separately - the component approach.",
    "source": "IAS 16 (component approach to depreciation)"
  },
  {
    "id": "acc-0012",
    "type": "case",
    "topic": "impairment",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "A cash-generating unit (CGU) shows indicators of impairment. Under IAS 36, how is the impairment test performed, and how does Swiss GAAP FER 20 treat impairment?",
    "options": [
      { "label": "Under IAS 36, the CGU's recoverable amount (the higher of fair value less costs of disposal and value in use) is compared to its carrying amount, with any shortfall recognised as an impairment loss, allocated first to goodwill. Swiss GAAP FER 20 similarly requires a write-down when a carrying amount is not recoverable, but with less detailed and prescriptive guidance than IAS 36 on how to determine the recoverable amount.", "correct": true },
      { "label": "IAS 36 does not use recoverable amount; it always writes assets down to zero.", "correct": false },
      { "label": "Swiss GAAP FER 20 explicitly forbids any impairment write-downs.", "correct": false }
    ],
    "explanation": "Both frameworks require write-downs when carrying amounts aren't recoverable, but IAS 36's CGU/recoverable-amount mechanics are considerably more detailed and prescriptive than FER 20's principles-based approach.",
    "source": "IAS 36 (CGU, recoverable amount); Swiss GAAP FER 20 (Wertbeeinträchtigungen)"
  },
  {
    "id": "acc-0013",
    "type": "quiz",
    "topic": "impairment",
    "frameworks": ["IFRS"],
    "prompt": "Under IAS 36, at what point must an entity test a (non-goodwill, finite-life) asset for impairment?",
    "options": [
      { "label": "Only at the end of every reporting period, regardless of circumstances", "correct": false },
      { "label": "Only when there is an indication that the asset may be impaired", "correct": true },
      { "label": "Only if requested by the auditor", "correct": false },
      { "label": "Never - only goodwill is tested", "correct": false }
    ],
    "explanation": "Unlike goodwill and indefinite-life intangibles (mandatory annual test), most other assets are only tested for impairment when an indicator is identified.",
    "source": "IAS 36 §12 (list of impairment indicators)"
  },
  {
    "id": "acc-0014",
    "type": "case",
    "topic": "financial-instruments",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "A company holds a bond it intends to collect contractual cash flows from until maturity. How is this classified and measured under IFRS 9, and does Swiss GAAP FER have an equivalent classification model?",
    "options": [
      { "label": "Under IFRS 9, the bond is classified based on the entity's business model and the instrument's contractual cash flow characteristics (the SPPI test); if held to collect contractual cash flows that are solely payments of principal and interest, it is measured at amortised cost. Swiss GAAP FER has no equivalent business-model/SPPI classification framework - financial instruments are generally addressed under the general valuation principles of FER 2, without IFRS 9's structured categories.", "correct": true },
      { "label": "Both frameworks use the identical business model and SPPI classification tests.", "correct": false },
      { "label": "IFRS 9 classifies all debt instruments at fair value through profit or loss with no exceptions.", "correct": false }
    ],
    "explanation": "IFRS 9's business-model-plus-SPPI classification approach (amortised cost / FVOCI / FVTPL) has no direct Swiss GAAP FER counterpart.",
    "source": "IFRS 9 (classification and measurement, business model and SPPI test)"
  },
  {
    "id": "acc-0015",
    "type": "quiz",
    "topic": "financial-instruments",
    "frameworks": ["IFRS"],
    "prompt": "What impairment model did IFRS 9 introduce for financial assets, replacing IAS 39's incurred-loss model?",
    "options": [
      { "label": "The expected credit loss (ECL) model, requiring recognition of credit losses before they are actually incurred", "correct": true },
      { "label": "A model that recognises losses only once a default has actually occurred", "correct": false },
      { "label": "IFRS 9 removed impairment requirements for financial assets entirely", "correct": false },
      { "label": "A fair-value-only model with no separate impairment concept", "correct": false }
    ],
    "explanation": "The ECL model was one of the major post-financial-crisis reforms, requiring forward-looking recognition of expected credit losses rather than waiting for a loss event.",
    "source": "IFRS 9 (expected credit loss impairment model)"
  },
  {
    "id": "acc-0016",
    "type": "case",
    "topic": "provisions",
    "frameworks": ["IFRS"],
    "prompt": "A company is being sued and its lawyers believe it is probable (more likely than not) that it will have to pay damages, and the amount can be reliably estimated. Should a provision be recognised under IAS 37?",
    "options": [
      { "label": "Yes - IAS 37 requires recognition of a provision when there is a present obligation as a result of a past event, an outflow of resources is probable, and the amount can be reliably estimated. All three conditions appear to be met here.", "correct": true },
      { "label": "No - provisions can only be recognised once a court judgment is final", "correct": false },
      { "label": "No - lawsuits are always treated only as contingent liabilities disclosed in the notes", "correct": false }
    ],
    "explanation": "IAS 37's three-part recognition test (present obligation, probable outflow, reliable estimate) is met, so a provision - not just a note disclosure - is required.",
    "source": "IAS 37 (recognition criteria for provisions)"
  },
  {
    "id": "acc-0017",
    "type": "quiz",
    "topic": "provisions",
    "frameworks": ["IFRS"],
    "prompt": "Under IAS 37, how is a contingent liability treated, as opposed to a provision?",
    "options": [
      { "label": "It is recognised on the balance sheet at its best estimate, exactly like a provision", "correct": false },
      { "label": "It is only disclosed in the notes (not recognised as a liability), because either the outflow is not probable or the amount cannot be reliably measured", "correct": true },
      { "label": "It is always ignored completely", "correct": false },
      { "label": "It is recognised as revenue", "correct": false }
    ],
    "explanation": "A contingent liability fails at least one of the provision recognition criteria (probable outflow or reliable measurement) and is therefore only disclosed, not recognised.",
    "source": "IAS 37 (provisions vs contingent liabilities)"
  },
  {
    "id": "acc-0018",
    "type": "case",
    "topic": "business-combinations",
    "frameworks": ["IFRS", "SwissGAAP-FER"],
    "prompt": "A company acquires 100% of another company's shares. Under IFRS 3, what method must be used to account for this business combination, and does Swiss GAAP FER 30 allow flexibility that IFRS does not?",
    "options": [
      { "label": "IFRS 3 requires the acquisition method for all business combinations, recognising identifiable assets/liabilities at fair value and any goodwill (with no amortisation, only impairment testing thereafter). Swiss GAAP FER 30 gives more flexibility, permitting goodwill to be either capitalised and amortised over its useful life or offset directly against equity at the acquisition date - a choice not available under IFRS 3.", "correct": true },
      { "label": "Both frameworks require identical treatment of goodwill, including amortisation.", "correct": false },
      { "label": "IFRS 3 allows pooling-of-interests accounting for any acquisition.", "correct": false }
    ],
    "explanation": "The acquisition method is mandatory under IFRS 3 with impairment-only goodwill; Swiss GAAP FER 30's goodwill-against-equity option is a well-known point of divergence.",
    "source": "IFRS 3 (acquisition method, goodwill impairment-only); Swiss GAAP FER 30 (Konzernrechnung)"
  },
  {
    "id": "acc-0019",
    "type": "quiz",
    "topic": "business-combinations",
    "frameworks": ["IFRS"],
    "prompt": "Under IFRS 3, how is goodwill on acquisition calculated (simplest case, no non-controlling interest)?",
    "options": [
      { "label": "Consideration transferred minus the net fair value of identifiable assets acquired and liabilities assumed", "correct": true },
      { "label": "The book value of the target's total assets", "correct": false },
      { "label": "The purchase price divided by the number of years of expected benefit", "correct": false },
      { "label": "Goodwill is never calculated under IFRS - it is always assumed to be zero", "correct": false }
    ],
    "explanation": "Goodwill is the residual: what was paid, minus the fair value of the identifiable net assets acquired.",
    "source": "IFRS 3 (goodwill measurement)"
  },
  {
    "id": "acc-0020",
    "type": "case",
    "topic": "consolidation",
    "frameworks": ["IFRS"],
    "prompt": "A parent holds 40% of the voting rights of an investee but, due to the dispersion of the remaining shares, is able in practice to direct the investee's relevant activities. Should the parent consolidate this investee under IFRS 10?",
    "options": [
      { "label": "Yes, potentially - IFRS 10 defines control based on power over the investee, exposure to variable returns, and the ability to use that power to affect returns; 'de facto control' from a large, dispersed minority stake can meet this definition even below 50% of voting rights.", "correct": true },
      { "label": "No - consolidation always requires legal ownership of more than 50% of voting rights", "correct": false },
      { "label": "IFRS 10 has been withdrawn and consolidation is now voluntary", "correct": false }
    ],
    "explanation": "IFRS 10's control model looks beyond simple voting-rights thresholds to substance (power, returns, the link between them), which can bring de facto control situations into consolidation.",
    "source": "IFRS 10 (definition of control)"
  },
  {
    "id": "acc-0021",
    "type": "quiz",
    "topic": "fair-value",
    "frameworks": ["IFRS"],
    "prompt": "How does IFRS 13 define fair value?",
    "options": [
      { "label": "The price that would be received to sell an asset (or paid to transfer a liability) in an orderly transaction between market participants at the measurement date - an exit price", "correct": true },
      { "label": "The original historical cost of the asset", "correct": false },
      { "label": "The price management believes the asset is worth internally", "correct": false },
      { "label": "The replacement cost of the asset new", "correct": false }
    ],
    "explanation": "IFRS 13 centres fair value on a market-based exit price, not entity-specific value or historical cost.",
    "source": "IFRS 13 (definition of fair value)"
  },
  {
    "id": "acc-0022",
    "type": "case",
    "topic": "income-taxes",
    "frameworks": ["IFRS"],
    "prompt": "A company has an asset whose carrying amount for accounting purposes differs from its tax base because of different depreciation rates. What does IAS 12 require in this situation?",
    "options": [
      { "label": "Recognition of a deferred tax asset or liability for the resulting temporary difference between the carrying amount and the tax base, generally measured at the tax rates expected to apply when the difference reverses", "correct": true },
      { "label": "IAS 12 ignores differences between accounting and tax depreciation", "correct": false },
      { "label": "The difference is always recognised immediately as a current tax expense with no deferred element", "correct": false }
    ],
    "explanation": "This is a textbook temporary difference: different depreciation rates create a deferred tax balance under IAS 12's balance-sheet liability method.",
    "source": "IAS 12 (deferred tax, temporary differences)"
  },
  {
    "id": "acc-0023",
    "type": "quiz",
    "topic": "audit-icfr",
    "frameworks": ["PCAOB"],
    "prompt": "Under PCAOB AS 2201, what is the auditor's objective when auditing internal control over financial reporting (ICFR) as part of an integrated audit?",
    "options": [
      { "label": "To express an opinion on the effectiveness of the company's internal control over financial reporting", "correct": true },
      { "label": "To design the company's internal controls for management", "correct": false },
      { "label": "To guarantee that no fraud will ever occur", "correct": false },
      { "label": "To replace the audit of the financial statements entirely", "correct": false }
    ],
    "explanation": "AS 2201 governs the ICFR audit integrated with the financial statement audit; the auditor's objective is an opinion on ICFR effectiveness, not designing controls or guaranteeing fraud-free operations.",
    "source": "PCAOB AS 2201 - An Audit of Internal Control Over Financial Reporting"
  },
  {
    "id": "acc-0024",
    "type": "case",
    "topic": "audit-risk-assessment",
    "frameworks": ["ISA"],
    "prompt": "At the planning stage of an audit, the engagement team needs to identify and assess the risks of material misstatement in the financial statements. Which standard governs this, and what is its core requirement?",
    "options": [
      { "label": "ISA 315 (Revised 2019) requires the auditor to identify and assess risks of material misstatement through understanding the entity and its environment, including its internal control, in order to design audit procedures that respond to the assessed risks (per ISA 330).", "correct": true },
      { "label": "ISA 315 only applies to listed companies", "correct": false },
      { "label": "Risk assessment is optional and left entirely to auditor judgement without a governing standard", "correct": false }
    ],
    "explanation": "ISA 315 (Revised 2019) is the foundational risk-assessment standard, feeding directly into ISA 330's risk-response requirements.",
    "source": "ISA 315 (Revised 2019) - Identifying and Assessing the Risks of Material Misstatement"
  }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add data/accounting-bank.json data/accounting-bank.test.mjs
git commit -m "content: add initial 24-question accounting/audit bank"
```

---

## Task 6: French grammar ladder content

**Files:**
- Create: `data/french-ladder.json`
- Test: `data/french-ladder.test.mjs`

**Interfaces:**
- Produces: a JSON array of blocks matching `{id, order, name, masteryThreshold, exercises: [{id, type, prompt, options?, correctAnswer, explanation}]}[]`, consumed by `getBlockById`/`pickFrenchExercise`/`advanceFrenchState` (Task 3). Starts at `passe-compose` to match `defaultProgressState()` (Task 1).

- [ ] **Step 1: Write the failing schema test**

Create `data/french-ladder.test.mjs`:

```js
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
      if (ex.type === "mcq") {
        assert.ok(Array.isArray(ex.options) && ex.options.includes(ex.correctAnswer), `mcq ${ex.id} must list correctAnswer in options`);
      }
    }
  }
});

test("exercise ids are unique across the whole ladder", () => {
  const ids = ladder.flatMap((b) => b.exercises.map((e) => e.id));
  assert.strictEqual(new Set(ids).size, ids.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `ENOENT ... french-ladder.json`

- [ ] **Step 3: Create `data/french-ladder.json`**

```json
[
  {
    "id": "passe-compose",
    "order": 1,
    "name": "Passé composé",
    "masteryThreshold": 3,
    "exercises": [
      { "id": "pc-01", "type": "mcq", "prompt": "Elle ___ partie hier soir. (choisis l'auxiliaire correct)", "options": ["a", "est", "avait"], "correctAnswer": "est", "explanation": "'Partir' est un verbe de mouvement qui se conjugue avec l'auxiliaire être au passé composé, avec accord du participe passé au féminin ('partie')." },
      { "id": "pc-02", "type": "fill-blank", "prompt": "Nous ___ (manger) au restaurant hier soir.", "correctAnswer": "avons mangé", "explanation": "'Manger' se conjugue avec avoir; 1ère personne du pluriel: avons + participe passé mangé." },
      { "id": "pc-03", "type": "mcq", "prompt": "Ils sont ___ (arriver) en retard.", "options": ["arrivé", "arrivés", "arrivées"], "correctAnswer": "arrivés", "explanation": "Avec l'auxiliaire être, le participe passé s'accorde en genre et en nombre avec le sujet; 'ils' (masculin pluriel) → arrivés." },
      { "id": "pc-04", "type": "error-spot", "prompt": "Corrige cette phrase : « Elle a resté à la maison. »", "correctAnswer": "Elle est restée à la maison.", "explanation": "'Rester' se conjugue avec être, pas avoir; accord au féminin: restée." },
      { "id": "pc-05", "type": "fill-blank", "prompt": "J'ai ___ (finir) mes devoirs avant le dîner.", "correctAnswer": "fini", "explanation": "'Finir' (2e groupe) forme son participe passé en -i: fini." },
      { "id": "pc-06", "type": "mcq", "prompt": "Vous ___ (voir) ce film la semaine dernière ?", "options": ["avez vu", "avez vue", "êtes vu"], "correctAnswer": "avez vu", "explanation": "'Voir' est irrégulier et se conjugue avec avoir; participe passé: vu." },
      { "id": "pc-07", "type": "production", "prompt": "Écris une phrase au passé composé pour dire que tu as visité Paris la semaine dernière.", "correctAnswer": "J'ai visité Paris la semaine dernière.", "explanation": "Respuesta modelo - autoevalúa si tu frase usa correctamente avoir + participe passé de 'visiter' (visité)." },
      { "id": "pc-08", "type": "error-spot", "prompt": "Corrige cette phrase : « Nous avons allé au cinéma. »", "correctAnswer": "Nous sommes allé(e)s au cinéma.", "explanation": "'Aller' se conjugue toujours avec être au passé composé, jamais avec avoir." }
    ]
  },
  {
    "id": "imparfait",
    "order": 2,
    "name": "Imparfait",
    "masteryThreshold": 3,
    "exercises": [
      { "id": "imp-01", "type": "fill-blank", "prompt": "Quand j'étais petit, je ___ (jouer) tous les jours dans le jardin.", "correctAnswer": "jouais", "explanation": "Imparfait, 1ère personne du singulier: radical jou- + terminaison -ais." },
      { "id": "imp-02", "type": "mcq", "prompt": "Nous ___ (être) très jeunes à cette époque.", "options": ["étions", "étiont", "étaient"], "correctAnswer": "étions", "explanation": "Imparfait de 'être', 1ère personne du pluriel: nous étions." },
      { "id": "imp-03", "type": "fill-blank", "prompt": "Il ___ (faire) beau tous les jours cet été-là.", "correctAnswer": "faisait", "explanation": "Imparfait de 'faire': radical fais- + terminaison -ait." },
      { "id": "imp-04", "type": "mcq", "prompt": "Je ___ (manger) une pomme quand le téléphone a sonné. (quel temps pour l'action de fond ?)", "options": ["mangeais", "ai mangé", "mangerai"], "correctAnswer": "mangeais", "explanation": "L'action de fond (manger) se met à l'imparfait; l'action ponctuelle qui l'interrompt se met au passé composé." },
      { "id": "imp-05", "type": "fill-blank", "prompt": "Nous ___ (habiter) à Paris avant de déménager à Genève.", "correctAnswer": "habitions", "explanation": "Imparfait de 'habiter', 1ère pers. pluriel: habitions." },
      { "id": "imp-06", "type": "mcq", "prompt": "Enfant, tu ___ (aller) à l'école à pied tous les jours. (habitude passée)", "options": ["allais", "es allé", "iras"], "correctAnswer": "allais", "explanation": "Une habitude répétée dans le passé se décrit à l'imparfait, pas au passé composé." },
      { "id": "imp-07", "type": "production", "prompt": "Décris une habitude de ton enfance en utilisant l'imparfait.", "correctAnswer": "Quand j'étais enfant, je regardais des dessins animés tous les samedis matin.", "explanation": "Respuesta modelo - vérifie que tu as bien utilisé l'imparfait pour décrire une habitude répétée." },
      { "id": "imp-08", "type": "error-spot", "prompt": "Corrige cette phrase : « J'ai été fatigué tous les jours cette année-là. »", "correctAnswer": "J'étais fatigué tous les jours cette année-là.", "explanation": "Un état répété/continu dans le passé se décrit à l'imparfait, pas au passé composé." }
    ]
  },
  {
    "id": "futur-simple",
    "order": 3,
    "name": "Futur simple",
    "masteryThreshold": 3,
    "exercises": [
      { "id": "fut-01", "type": "mcq", "prompt": "Je ___ (aller) à Genève demain.", "options": ["irai", "allerai", "vais"], "correctAnswer": "irai", "explanation": "'Aller' a un radical irrégulier au futur simple: ir- + terminaisons." },
      { "id": "fut-02", "type": "fill-blank", "prompt": "Demain, nous ___ (finir) le projet.", "correctAnswer": "finirons", "explanation": "Futur simple régulier: infinitif finir + terminaison -ons." },
      { "id": "fut-03", "type": "mcq", "prompt": "Elle ___ (être) contente du résultat.", "options": ["sera", "serai", "est"], "correctAnswer": "sera", "explanation": "'Être' a un radical irrégulier au futur simple: ser-; 3e pers. sing.: sera." },
      { "id": "fut-04", "type": "error-spot", "prompt": "Corrige cette phrase : « Je vais partirai demain. »", "correctAnswer": "Je partirai demain.", "explanation": "On ne mélange pas le futur proche (aller + infinitif) et le futur simple dans la même construction." },
      { "id": "fut-05", "type": "fill-blank", "prompt": "Ils ___ (avoir) une réunion vendredi prochain.", "correctAnswer": "auront", "explanation": "'Avoir' a un radical irrégulier au futur simple: aur-; 3e pers. pluriel: auront." },
      { "id": "fut-06", "type": "mcq", "prompt": "Quand il ___ (arriver), nous commencerons la réunion.", "options": ["arrivera", "arrive", "arriverait"], "correctAnswer": "arrivera", "explanation": "En français, après 'quand' pour un événement futur, on utilise le futur simple (contrairement à l'anglais 'when he arrives')." },
      { "id": "fut-07", "type": "production", "prompt": "Écris une phrase au futur simple pour parler d'un projet professionnel futur.", "correctAnswer": "L'année prochaine, je terminerai ma formation d'expert-comptable.", "explanation": "Respuesta modelo - vérifie que ton verbe est bien conjugué au futur simple." },
      { "id": "fut-08", "type": "error-spot", "prompt": "Corrige cette phrase : « Quand je serai grand, je deviens médecin. »", "correctAnswer": "Quand je serai grand, je deviendrai médecin.", "explanation": "Les deux propositions liées par 'quand' pour un événement futur doivent être au futur simple." }
    ]
  }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add data/french-ladder.json data/french-ladder.test.mjs
git commit -m "content: add French grammar ladder (passe-compose, imparfait, futur-simple)"
```

---

## Task 7: English practice content

**Files:**
- Create: `data/english-bank.json`
- Test: `data/english-bank.test.mjs`

**Interfaces:**
- Produces: a JSON array matching `{id, focus: "nuance"|"vocab-idioms"|"writing", type: "mcq"|"rewrite", prompt, options?, modelAnswer?, explanation}[]`, consumed by `pickEnglishExercise` (Task 4).

- [ ] **Step 1: Write the failing schema test**

Create `data/english-bank.test.mjs`:

```js
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
      assert.strictEqual(e.options.filter((o) => o.correct === true).length, 1, `need exactly one correct option on ${e.id}`);
    } else {
      assert.ok(typeof e.modelAnswer === "string" && e.modelAnswer.length > 0, `missing modelAnswer on ${e.id}`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `ENOENT ... english-bank.json`

- [ ] **Step 3: Create `data/english-bank.json`**

```json
[
  { "id": "en-0001", "focus": "nuance", "type": "mcq", "prompt": "Which sounds more natural in a professional follow-up email?", "options": [{ "label": "I wanted to follow up regarding the report.", "correct": true }, { "label": "I want to follow up about the report.", "correct": false }], "explanation": "The softened past tense ('wanted') is a common, more polite convention for follow-ups - it reads as less abrupt than the present tense version." },
  { "id": "en-0002", "focus": "nuance", "type": "mcq", "prompt": "Choose the correct preposition: 'We are responsible ___ the year-end close.'", "options": [{ "label": "for", "correct": true }, { "label": "of", "correct": false }, { "label": "about", "correct": false }], "explanation": "'Responsible for' is the standard collocation in English." },
  { "id": "en-0003", "focus": "nuance", "type": "mcq", "prompt": "Which collocation is most universally understood in international business English?", "options": [{ "label": "make a decision", "correct": true }, { "label": "take a decision", "correct": false }], "explanation": "'Take a decision' is common in British/international English, but 'make a decision' is the more universally recognised form with a mixed international audience." },
  { "id": "en-0004", "focus": "nuance", "type": "mcq", "prompt": "Which is more appropriate when addressing a client (vs. a close colleague)?", "options": [{ "label": "Could you possibly clarify this point for us?", "correct": true }, { "label": "Can you clarify this?", "correct": false }], "explanation": "The more indirect, hedged phrasing ('Could you possibly...') signals a more formal, client-facing register." },
  { "id": "en-0005", "focus": "nuance", "type": "mcq", "prompt": "Choose the correct preposition: 'The entity is compliant ___ IFRS.'", "options": [{ "label": "with", "correct": true }, { "label": "to", "correct": false }, { "label": "for", "correct": false }], "explanation": "'Compliant with' is the correct, natural collocation." },
  { "id": "en-0006", "focus": "nuance", "type": "mcq", "prompt": "Which word correctly completes: 'Please ___ me on the best course of action.'", "options": [{ "label": "advise", "correct": true }, { "label": "advice", "correct": false }], "explanation": "'Advise' is the verb; 'advice' is the noun ('I need your advice')." },
  { "id": "en-0007", "focus": "vocab-idioms", "type": "mcq", "prompt": "In accounting, what does it mean to 'close the books'?", "options": [{ "label": "To finalise the accounting records for a period so no further entries are posted", "correct": true }, { "label": "To literally lock a physical ledger", "correct": false }, { "label": "To stop trading permanently", "correct": false }], "explanation": "'Closing the books' is standard terminology for finalising a period's accounting records." },
  { "id": "en-0008", "focus": "vocab-idioms", "type": "mcq", "prompt": "In an audit context, what does a 'red flag' refer to?", "options": [{ "label": "A warning sign suggesting a potential risk or issue that needs further investigation", "correct": true }, { "label": "A mandatory checklist item", "correct": false }, { "label": "A type of financial instrument", "correct": false }], "explanation": "'Red flag' is a common audit/business idiom for a warning indicator." },
  { "id": "en-0009", "focus": "vocab-idioms", "type": "mcq", "prompt": "What does it mean to 'rubber-stamp' something in a business context?", "options": [{ "label": "To approve something automatically or without proper scrutiny", "correct": true }, { "label": "To officially certify a document with a physical seal only", "correct": false }, { "label": "To reject a proposal outright", "correct": false }], "explanation": "'Rubber-stamp' implies approval without real, critical review - relevant when discussing control weaknesses." },
  { "id": "en-0010", "focus": "vocab-idioms", "type": "mcq", "prompt": "In audit terminology, what is a 'walkthrough'?", "options": [{ "label": "Tracing a single transaction through the process end-to-end to confirm the controls in place", "correct": true }, { "label": "A final meeting to sign off the audit opinion", "correct": false }, { "label": "A tour of the client's office", "correct": false }], "explanation": "A walkthrough is a specific audit procedure used to understand a process and confirm controls are designed as described." },
  { "id": "en-0011", "focus": "vocab-idioms", "type": "mcq", "prompt": "What does the term 'going concern' refer to?", "options": [{ "label": "The assumption that an entity will continue operating for the foreseeable future", "correct": true }, { "label": "A worry expressed by the audit committee", "correct": false }, { "label": "A type of provision", "correct": false }], "explanation": "'Going concern' is a fundamental accounting assumption, not a casual worry - important to get this vocabulary precise." },
  { "id": "en-0012", "focus": "vocab-idioms", "type": "mcq", "prompt": "What's the key difference between a 'material weakness' and a 'significant deficiency' in internal control?", "options": [{ "label": "A material weakness is more severe - a reasonable possibility that a material misstatement won't be prevented or detected; a significant deficiency is less severe but still merits attention", "correct": true }, { "label": "They are exactly the same thing, just different terms used in different countries", "correct": false }, { "label": "A significant deficiency is always worse than a material weakness", "correct": false }], "explanation": "This severity ranking is core PCAOB/COSO vocabulary in ICFR reporting." },
  { "id": "en-0013", "focus": "writing", "type": "rewrite", "prompt": "Rewrite more formally for a client email: 'I want you to send me the report.'", "modelAnswer": "Could you please send me the report at your earliest convenience?", "explanation": "Adding a hedge ('could you please') and a soft deadline phrase makes the request more polite and client-appropriate." },
  { "id": "en-0014", "focus": "writing", "type": "rewrite", "prompt": "Write a one-sentence, polite email opener requesting a short extension on a deadline.", "modelAnswer": "I'm writing to ask whether it would be possible to extend the deadline for the file review by two working days.", "explanation": "Notice the indirect framing ('whether it would be possible') rather than a blunt demand." },
  { "id": "en-0015", "focus": "writing", "type": "rewrite", "prompt": "Rewrite this blunt audit comment more diplomatically for a report: 'You did this wrong.'", "modelAnswer": "We noted an exception in the following area, which we recommend management address.", "explanation": "Audit report language stays neutral and process-focused rather than personal or accusatory." },
  { "id": "en-0016", "focus": "writing", "type": "rewrite", "prompt": "Write a brief, professional follow-up email opener after a client hasn't responded in 3 days.", "modelAnswer": "I hope this finds you well - I wanted to follow up on my message from earlier this week, as we haven't yet received the requested documents.", "explanation": "Notice the soft, non-confrontational tone even though it's a reminder." },
  { "id": "en-0017", "focus": "writing", "type": "rewrite", "prompt": "Rewrite this passive, wordy sentence more concisely and actively for a report: 'It was determined by the team that the control was not operating effectively.'", "modelAnswer": "The team determined that the control was not operating effectively.", "explanation": "Active voice is generally clearer and more concise in professional reports; use passive only when the actor is unknown or irrelevant." },
  { "id": "en-0018", "focus": "writing", "type": "rewrite", "prompt": "Write a one-sentence executive-summary opener for an audit finding about a control gap in the procurement process.", "modelAnswer": "Our review identified a control gap in the procurement approval process that increases the risk of unauthorised purchases.", "explanation": "A strong executive-summary sentence states the finding and its risk/impact concisely, up front." }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add data/english-bank.json data/english-bank.test.mjs
git commit -m "content: add initial English nuance/vocab/writing bank"
```

---

## Task 8: Static page shell (HTML/CSS/manifest)

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `manifest.json`

**Interfaces:**
- Produces: DOM elements with fixed ids consumed by `script.js` (Task 9): `streak-label`, `.dot[data-block]`, `.block` sections `block-accounting`/`block-french`/`block-english`/`block-done`, and the field ids listed inline below.

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "name": "Daily Training",
  "short_name": "Training",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "icons": []
}
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Daily Training</title>
<link rel="manifest" href="manifest.json" />
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<header class="app-header">
  <h1>Daily Training</h1>
  <p id="streak-label">Racha: 0 días</p>
  <div class="progress-dots">
    <span class="dot" data-block="0">1</span>
    <span class="dot" data-block="1">2</span>
    <span class="dot" data-block="2">3</span>
  </div>
</header>

<main id="app-main">
  <section id="block-accounting" class="block" hidden>
    <h2>Bloque 1 — Contabilidad y auditoría</h2>
    <p class="topic-label" id="accounting-topic"></p>
    <p class="prompt" id="accounting-prompt"></p>
    <div class="options" id="accounting-options"></div>
    <div class="feedback" id="accounting-feedback" hidden>
      <p class="explanation" id="accounting-explanation"></p>
      <p class="source" id="accounting-source"></p>
      <button class="next-btn" id="accounting-next">Siguiente</button>
    </div>
  </section>

  <section id="block-french" class="block" hidden>
    <h2>Bloque 2 — Francés</h2>
    <p class="topic-label" id="french-block-name"></p>
    <p class="prompt" id="french-prompt"></p>
    <div class="options" id="french-options"></div>
    <input type="text" id="french-text-input" placeholder="Escribe tu respuesta..." hidden />
    <button id="french-submit" hidden>Comprobar</button>
    <div class="feedback" id="french-feedback" hidden>
      <p class="explanation" id="french-explanation"></p>
      <div id="french-self-grade" hidden>
        <p>¿Lo hiciste bien?</p>
        <button data-correct="true">Sí, bien</button>
        <button data-correct="false">Me costó</button>
      </div>
      <button class="next-btn" id="french-next" hidden>Siguiente</button>
    </div>
  </section>

  <section id="block-english" class="block" hidden>
    <h2>Bloque 3 — Inglés</h2>
    <p class="topic-label" id="english-focus"></p>
    <p class="prompt" id="english-prompt"></p>
    <div class="options" id="english-options"></div>
    <div class="feedback" id="english-feedback" hidden>
      <p class="explanation" id="english-explanation"></p>
      <p class="model-answer" id="english-model-answer"></p>
      <button class="next-btn" id="english-next">Terminar</button>
    </div>
  </section>

  <section id="block-done" class="block" hidden>
    <h2>¡Hecho por hoy!</h2>
    <p id="done-summary"></p>
    <div class="backup-actions">
      <button id="export-btn">Exportar progreso</button>
      <label for="import-input" class="import-label">Importar progreso</label>
      <input type="file" id="import-input" accept="application/json" hidden />
    </div>
  </section>
</main>

<script type="module" src="script.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `styles.css`**

```css
:root {
  color-scheme: dark;
  --bg: #0f172a;
  --card-bg: #1e293b;
  --text: #f1f5f9;
  --accent: #38bdf8;
  --correct: #4ade80;
  --incorrect: #f87171;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 16px;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 480px;
  margin-inline: auto;
}

.app-header { text-align: center; margin-bottom: 24px; }
.app-header h1 { font-size: 1.4rem; margin: 0 0 4px; }
#streak-label { color: var(--accent); margin: 0 0 12px; }

.progress-dots { display: flex; justify-content: center; gap: 8px; }
.dot {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--card-bg); font-size: 0.85rem;
}
.dot.active { background: var(--accent); color: #0f172a; font-weight: bold; }
.dot.done { background: var(--correct); color: #0f172a; }

.block {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 20px;
}

.topic-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
.prompt { font-size: 1.1rem; line-height: 1.5; margin: 12px 0 20px; }

.options { display: flex; flex-direction: column; gap: 10px; }
.option-btn {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #334155;
  background: #0f172a;
  color: var(--text);
  font-size: 1rem;
  text-align: left;
}
.option-btn.correct { border-color: var(--correct); background: #14532d; }
.option-btn.incorrect { border-color: var(--incorrect); background: #7f1d1d; }

#french-text-input {
  width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #334155;
  background: #0f172a; color: var(--text); font-size: 1rem; margin-bottom: 12px;
}

button {
  padding: 12px 18px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: #0f172a;
  font-weight: 600;
  font-size: 1rem;
}

.feedback { margin-top: 16px; }
.explanation { line-height: 1.5; }
.source { font-size: 0.85rem; opacity: 0.75; font-style: italic; }
.next-btn { margin-top: 12px; }

.backup-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
.import-label {
  display: inline-block; text-align: center; padding: 12px 18px;
  border-radius: 12px; background: #334155; color: var(--text); font-weight: 600;
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css manifest.json
git commit -m "feat: add static page shell (mobile-first, 3-block layout)"
```

---

## Task 9: Wiring script (`script.js`)

**Files:**
- Create: `script.js`

**Interfaces:**
- Consumes: every function from `logic.js` (Tasks 1-4); the DOM ids from `index.html` (Task 8); `data/*.json` (Tasks 5-7) via `fetch`.
- Produces: the running app — no further tasks depend on this one.

- [ ] **Step 1: Create `script.js`**

```js
import {
  todayISO,
  defaultProgressState,
  serializeProgress,
  deserializeProgress,
  pushRecent,
  accountingModeForDate,
  pickAccountingQuestion,
  getBlockById,
  pickFrenchExercise,
  advanceFrenchState,
  nextEnglishFocus,
  pickEnglishExercise,
} from "./logic.js";

const STORAGE_KEY = "daily-training-progress";

function loadProgress() {
  try {
    return deserializeProgress(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultProgressState();
  }
}

function saveProgress(state) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProgress(state));
  } catch {
    // localStorage unavailable (private mode, storage full, etc.) - progress just won't persist
  }
}

async function loadBanks() {
  const [accounting, french, english] = await Promise.all([
    fetch("data/accounting-bank.json").then((r) => r.json()),
    fetch("data/french-ladder.json").then((r) => r.json()),
    fetch("data/english-bank.json").then((r) => r.json()),
  ]);
  return { accounting, french, english };
}

function setDotState(index, className) {
  document.querySelectorAll(".dot").forEach((dot) => {
    const dotIndex = Number(dot.dataset.block);
    dot.classList.remove("active", "done");
    if (dotIndex < index) dot.classList.add("done");
    if (dotIndex === index) dot.classList.add(className);
  });
}

function showBlock(id) {
  document.querySelectorAll(".block").forEach((el) => (el.hidden = el.id !== id));
}

function renderOptions(container, options, onPick) {
  container.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = typeof opt === "string" ? opt : opt.label;
    btn.addEventListener("click", () => onPick(opt, btn), { once: true });
    container.appendChild(btn);
  });
}

async function main() {
  const banks = await loadBanks();
  let progress = loadProgress();
  const today = todayISO();

  function updateStreakLabel() {
    document.getElementById("streak-label").textContent = `Racha: ${progress.streakDays} días`;
  }

  function runAccounting() {
    showBlock("block-accounting");
    setDotState(0, "active");
    const mode = accountingModeForDate(today);
    const question = pickAccountingQuestion(banks.accounting, mode, progress.accounting.recentIds);

    document.getElementById("accounting-topic").textContent = `${question.topic} (${mode})`;
    document.getElementById("accounting-prompt").textContent = question.prompt;
    document.getElementById("accounting-feedback").hidden = true;

    renderOptions(document.getElementById("accounting-options"), question.options, (opt, btn) => {
      document.querySelectorAll("#accounting-options .option-btn").forEach((b) => (b.disabled = true));
      btn.classList.add(opt.correct ? "correct" : "incorrect");

      document.getElementById("accounting-explanation").textContent = question.explanation;
      document.getElementById("accounting-source").textContent = `Fuente: ${question.source}`;
      document.getElementById("accounting-feedback").hidden = false;

      progress.accounting.recentIds = pushRecent(progress.accounting.recentIds, question.id);
      saveProgress(progress);
    });

    document.getElementById("accounting-next").onclick = () => {
      setDotState(0, "done");
      runFrench();
    };
  }

  function runFrench() {
    showBlock("block-french");
    setDotState(1, "active");
    const block = getBlockById(banks.french, progress.french.currentBlockId);
    const exercise = pickFrenchExercise(block, progress.french.recentExerciseIds);

    document.getElementById("french-block-name").textContent = block.name;
    document.getElementById("french-prompt").textContent = exercise.prompt;
    document.getElementById("french-feedback").hidden = true;
    document.getElementById("french-self-grade").hidden = true;
    document.getElementById("french-next").hidden = true;

    const optionsEl = document.getElementById("french-options");
    const inputEl = document.getElementById("french-text-input");
    const submitBtn = document.getElementById("french-submit");
    optionsEl.innerHTML = "";
    inputEl.hidden = true;
    submitBtn.hidden = true;

    function finishFrench(wasCorrect) {
      progress.french.recentExerciseIds = pushRecent(progress.french.recentExerciseIds, exercise.id, 10);
      progress.french = advanceFrenchState(banks.french, progress.french, wasCorrect);
      saveProgress(progress);

      document.getElementById("french-feedback").hidden = false;
      document.getElementById("french-next").hidden = false;
    }

    if (exercise.type === "mcq") {
      renderOptions(optionsEl, exercise.options, (opt, btn) => {
        optionsEl.querySelectorAll(".option-btn").forEach((b) => (b.disabled = true));
        const wasCorrect = opt === exercise.correctAnswer;
        btn.classList.add(wasCorrect ? "correct" : "incorrect");
        document.getElementById("french-explanation").textContent = exercise.explanation;
        finishFrench(wasCorrect);
      });
    } else if (exercise.type === "fill-blank") {
      inputEl.hidden = false;
      submitBtn.hidden = false;
      inputEl.value = "";
      submitBtn.onclick = () => {
        const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
        const wasCorrect = normalize(inputEl.value) === normalize(exercise.correctAnswer);
        document.getElementById("french-explanation").textContent =
          `${exercise.explanation} (Respuesta correcta: ${exercise.correctAnswer})`;
        finishFrench(wasCorrect);
      };
    } else {
      document.getElementById("french-self-grade").hidden = false;
      document.getElementById("french-explanation").textContent =
        `Respuesta modelo: ${exercise.correctAnswer} — ${exercise.explanation}`;
      document.getElementById("french-feedback").hidden = false;
      document.querySelectorAll("#french-self-grade button").forEach((b) => {
        b.onclick = () => finishFrench(b.dataset.correct === "true");
      });
    }

    document.getElementById("french-next").onclick = () => {
      setDotState(1, "done");
      runEnglish();
    };
  }

  function runEnglish() {
    showBlock("block-english");
    setDotState(2, "active");
    const focus = nextEnglishFocus(progress.english.lastFocus);
    const exercise = pickEnglishExercise(banks.english, focus, progress.english.recentIds);

    document.getElementById("english-focus").textContent = focus;
    document.getElementById("english-prompt").textContent = exercise.prompt;
    document.getElementById("english-feedback").hidden = true;
    document.getElementById("english-model-answer").textContent = "";

    const optionsEl = document.getElementById("english-options");
    optionsEl.innerHTML = "";

    function finishEnglish() {
      progress.english.recentIds = pushRecent(progress.english.recentIds, exercise.id);
      progress.english.lastFocus = focus;
      saveProgress(progress);
      document.getElementById("english-explanation").textContent = exercise.explanation;
      document.getElementById("english-feedback").hidden = false;
    }

    if (exercise.type === "mcq") {
      renderOptions(optionsEl, exercise.options, (opt, btn) => {
        optionsEl.querySelectorAll(".option-btn").forEach((b) => (b.disabled = true));
        btn.classList.add(opt.correct ? "correct" : "incorrect");
        finishEnglish();
      });
    } else {
      document.getElementById("english-model-answer").textContent = `Modelo: ${exercise.modelAnswer}`;
      finishEnglish();
    }

    document.getElementById("english-next").onclick = () => {
      setDotState(2, "done");
      finishSession();
    };
  }

  function finishSession() {
    showBlock("block-done");
    if (progress.lastCompletedDate !== today) {
      const yesterdayISO = todayISO(new Date(Date.now() - 86400000));
      progress.streakDays = progress.lastCompletedDate === yesterdayISO ? progress.streakDays + 1 : 1;
      progress.lastCompletedDate = today;
      saveProgress(progress);
    }
    updateStreakLabel();
    document.getElementById("done-summary").textContent = `Sesión del ${today} completada.`;
  }

  updateStreakLabel();

  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([serializeProgress(progress)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-training-progress-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    progress = deserializeProgress(await file.text());
    saveProgress(progress);
    updateStreakLabel();
    runAccounting();
  });

  runAccounting();
}

main();
```

- [ ] **Step 2: Manual verification (no DOM test framework in this project — verify by hand)**

Run: `python3 -m http.server 8000` from the project root, then open `http://localhost:8000` in a browser.

Check, in order:
1. Block 1 (Contabilidad) renders a question with options; clicking an option highlights correct/incorrect, shows explanation + source, and "Siguiente" appears.
2. Clicking "Siguiente" advances to Block 2 (Francés) — dot 1 turns green, dot 2 becomes active.
3. Test each French exercise type at least once by reloading until you see it: mcq (buttons), fill-blank (text input + "Comprobar"), error-spot/production (self-grade buttons).
4. Block 3 (Inglés) renders after Francés; mcq and rewrite types both work.
5. After Block 3, the "¡Hecho por hoy!" screen appears and the streak label updates.
6. Reload the page (F5): the app restarts at Block 1 (a normal new session), and the streak/recent-ids from before are still respected (open DevTools → Application → Local Storage → confirm `daily-training-progress` key holds the updated JSON).
7. Click "Exportar progreso": a JSON file downloads. Click "Importar progreso" and re-select that file: no errors in the console.
8. Resize the browser to ~390px wide (or open DevTools device toolbar, iPhone SE): confirm no horizontal scrolling and all buttons are comfortably tappable.

Expected: all 8 checks pass. If any fails, fix `script.js`/`styles.css` before proceeding — do not commit broken wiring.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: wire up the 3-block daily session flow"
```

---

## Task 10: Deploy to Cloudflare Pages

**Files:**
- None (deployment only)

- [ ] **Step 1: Install/confirm `wrangler` is available**

Run: `npx wrangler --version`
Expected: prints a version number (npx downloads it on first use if not already installed globally — no project dependency is added since it's invoked via `npx`, not saved to `package.json`).

- [ ] **Step 2: Authenticate (only if not already logged in)**

Run: `npx wrangler whoami`
If it reports "You are not authenticated": run `npx wrangler login` and complete the browser login with your own personal Cloudflare account (not the Unobis business account) — this opens a browser window; approve access there.

- [ ] **Step 3: Deploy**

Run: `npx wrangler pages deploy . --project-name=daily-training`
Expected: output ends with a line like `✨ Deployment complete! Take a look at https://daily-training-<hash>.pages.dev` — note this URL (and, after Cloudflare assigns the stable project alias, `https://daily-training.pages.dev`).

- [ ] **Step 4: Verify from the phone**

Open the deployed URL on the phone's browser. Confirm the same 8 checks from Task 9 Step 2 pass on the real deployment, then use the browser's "Add to Home Screen" so it opens like an app each morning.

- [ ] **Step 5: Record the URL**

Append the deployed URL as a one-line note at the end of `docs/superpowers/specs/2026-09-17-daily-training-design.md` (e.g. `**URL desplegada:** https://daily-training.pages.dev`) and commit:

```bash
git add docs/superpowers/specs/2026-09-17-daily-training-design.md
git commit -m "docs: record the deployed Cloudflare Pages URL"
```

---

## Notes on scope (read before executing)

- The design spec's aspirational "~50-60 accounting questions / ~10 exercises × 5 French blocks / ~30-40 English exercises" has been deliberately right-sized for this v1 to what could be fully researched and written with real, verifiable citations right now: **24 accounting/audit questions, 24 French exercises across 3 grammar blocks (passé composé, imparfait, futur simple), 18 English exercises.** This is enough content that repeats won't show up for 2-4 weeks of daily use per topic (`recentIds` avoids immediate repeats). Expanding the banks (more accounting topics, plus-que-parfait/subjonctif French blocks, more English exercises) is explicitly future work — ask Claude Code in a later session to research and append more entries following the same schema and validation tests.
- Weekday accounting rotation (case: Sun/Mon/Wed/Fri, quiz: Tue/Thu/Sat) is a concrete default chosen during planning to fill a gap in the original spec (which only specified weekdays); adjust `accountingModeForDate` in Task 2 if a different split is preferred later.
