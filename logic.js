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
