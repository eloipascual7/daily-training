import {
  todayISO,
  defaultProgressState,
  serializeProgress,
  deserializeProgress,
  pushRecent,
  pickAccountingTopic,
  pickAccountingSession,
  pickReviewQuestion,
  getBlockById,
  pickFrenchExercise,
  advanceFrenchState,
  nextEnglishFocus,
  pickEnglishExercise,
} from "./logic.js";

const STORAGE_KEY = "daily-training-progress";
const SESSION_SIZE = 5;
const ACCOUNTING_TOPIC_QUESTIONS = 4; // + 1 general-review question = SESSION_SIZE
const ACCOUNTING_RECENT_IDS = 40;

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
  const [accounting, accountingReview, accountingLessons, french, english] = await Promise.all([
    fetch("data/accounting-bank.json").then((r) => r.json()),
    fetch("data/accounting-review.json").then((r) => r.json()),
    fetch("data/accounting-lessons.json").then((r) => r.json()),
    fetch("data/french-ladder.json").then((r) => r.json()),
    fetch("data/english-bank.json").then((r) => r.json()),
  ]);
  return { accounting, accountingReview, accountingLessons, french, english };
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

function shuffleForDisplay(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// isCorrect(opt) marks the right answer after any pick, so a wrong pick always shows what was correct.
function renderOptions(container, options, isCorrect, onPick) {
  container.innerHTML = "";
  const shuffled = shuffleForDisplay(options);
  const buttons = shuffled.map((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = typeof opt === "string" ? opt : opt.label;
    btn.addEventListener(
      "click",
      () => {
        const right = isCorrect(opt);
        buttons.forEach((b, i) => {
          b.disabled = true;
          if (isCorrect(shuffled[i])) b.classList.add("correct");
        });
        if (!right) btn.classList.add("incorrect");
        onPick(opt, right);
      },
      { once: true }
    );
    container.appendChild(btn);
    return btn;
  });
}

async function main() {
  const banks = await loadBanks();
  let progress = loadProgress();
  const today = todayISO();

  function updateStreakLabel() {
    document.getElementById("streak-label").textContent = `Racha: ${progress.streakDays} días`;
  }

  // ---- Block 1: Accounting (lesson, then a session of questions) ----
  function runAccounting() {
    showBlock("block-accounting");
    setDotState(0, "active");

    const topic = pickAccountingTopic(banks.accounting, progress.accounting.recentTopics);
    const lesson = banks.accountingLessons.find((l) => l.topic === topic);
    const session = [
      ...pickAccountingSession(banks.accounting, topic, progress.accounting.recentIds, ACCOUNTING_TOPIC_QUESTIONS),
      pickReviewQuestion(banks.accountingReview, progress.accounting.recentIds),
    ];

    progress.accounting.recentTopics = pushRecent(progress.accounting.recentTopics, topic, 5);
    saveProgress(progress);

    document.getElementById("accounting-lesson").hidden = false;
    document.getElementById("accounting-quiz").hidden = true;
    document.getElementById("accounting-lesson-title").textContent = lesson ? lesson.title : topic;
    document.getElementById("accounting-lesson-text").textContent = lesson ? lesson.lesson : "";
    document.getElementById("accounting-lesson-source").textContent = lesson ? `Fuente: ${lesson.source}` : "";

    document.getElementById("accounting-lesson-start").onclick = () => {
      document.getElementById("accounting-lesson").hidden = true;
      document.getElementById("accounting-quiz").hidden = false;
      runAccountingQuestion(session, 0);
    };
  }

  function runAccountingQuestion(session, index) {
    const question = session[index];
    document.getElementById("accounting-progress-label").textContent =
      `Pregunta ${index + 1} de ${session.length}`;
    document.getElementById("accounting-topic").textContent =
      question.type === "review" ? "Repaso general" : `${question.topic} (${question.type})`;
    document.getElementById("accounting-prompt").textContent = question.prompt;
    document.getElementById("accounting-feedback").hidden = true;

    renderOptions(document.getElementById("accounting-options"), question.options, (opt) => opt.correct, () => {
      document.getElementById("accounting-explanation").textContent = question.explanation;
      document.getElementById("accounting-source").textContent = `Fuente: ${question.source}`;
      document.getElementById("accounting-feedback").hidden = false;

      progress.accounting.recentIds = pushRecent(progress.accounting.recentIds, question.id, ACCOUNTING_RECENT_IDS);
      saveProgress(progress);
    });

    const nextBtn = document.getElementById("accounting-next");
    const isLast = index === session.length - 1;
    nextBtn.textContent = isLast ? "Siguiente bloque" : "Siguiente";
    nextBtn.onclick = () => {
      if (isLast) {
        setDotState(0, "done");
        runFrench();
      } else {
        runAccountingQuestion(session, index + 1);
      }
    };
  }

  // ---- Block 2: French (a session of exercises from the current ladder block) ----
  function runFrench() {
    showBlock("block-french");
    setDotState(1, "active");
    runFrenchExercise(0);
  }

  function runFrenchExercise(index) {
    const block = getBlockById(banks.french, progress.french.currentBlockId);
    const exercise = pickFrenchExercise(block, progress.french.recentExerciseIds);

    document.getElementById("french-progress-label").textContent = `Ejercicio ${index + 1} de ${SESSION_SIZE}`;
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

    const isLast = index === SESSION_SIZE - 1;

    // Grammar mistakes get an explanation (including why the chosen option is wrong);
    // vocabulary mistakes only show the right answer - there is nothing to reason about, just to learn.
    function showFrenchFeedback(wasCorrect, given) {
      const isGrammar = exercise.kind !== "vocab";
      const verdict = document.getElementById("french-verdict");
      verdict.className = `verdict ${wasCorrect ? "ok" : "ko"}`;
      verdict.textContent = wasCorrect ? "Correcto" : `Incorrecto. Respuesta correcta: ${exercise.correctAnswer}`;

      const parts = [];
      if (!wasCorrect && given) parts.push(`Tu respuesta: ${given}`);
      if (!wasCorrect && isGrammar && exercise.whyWrong?.[given]) parts.push(`Por qué no: ${exercise.whyWrong[given]}`);
      if (isGrammar) parts.push(exercise.explanation);
      document.getElementById("french-explanation").textContent = parts.join("\n\n");
    }

    function finishFrench(wasCorrect) {
      progress.french.recentExerciseIds = pushRecent(progress.french.recentExerciseIds, exercise.id, 10);
      progress.french = advanceFrenchState(banks.french, progress.french, wasCorrect);
      saveProgress(progress);

      document.getElementById("french-self-grade").hidden = true;
      document.getElementById("french-feedback").hidden = false;
      const nextBtn = document.getElementById("french-next");
      nextBtn.hidden = false;
      nextBtn.textContent = isLast ? "Siguiente bloque" : "Siguiente";
      nextBtn.onclick = () => {
        if (isLast) {
          setDotState(1, "done");
          runEnglish();
        } else {
          runFrenchExercise(index + 1);
        }
      };
    }

    if (exercise.type === "mcq") {
      renderOptions(optionsEl, exercise.options, (opt) => opt === exercise.correctAnswer, (opt, wasCorrect) => {
        showFrenchFeedback(wasCorrect, opt);
        finishFrench(wasCorrect);
      });
    } else if (exercise.type === "fill-blank") {
      inputEl.hidden = false;
      submitBtn.hidden = false;
      inputEl.value = "";
      submitBtn.onclick = () => {
        // iPhone keyboards type curly apostrophes; treat them like straight ones.
        const normalize = (s) => s.replace(/[\u2019\u2018]/g, "'").trim().toLowerCase().replace(/\s+/g, " ");
        const wasCorrect = normalize(inputEl.value) === normalize(exercise.correctAnswer);
        submitBtn.hidden = true;
        showFrenchFeedback(wasCorrect, inputEl.value.trim());
        finishFrench(wasCorrect);
      };
    } else {
      // error-spot / production: show the model answer, then the user self-grades
      const verdict = document.getElementById("french-verdict");
      verdict.className = "verdict";
      verdict.textContent = `Respuesta modelo: ${exercise.correctAnswer}`;
      document.getElementById("french-explanation").textContent = exercise.kind === "vocab" ? "" : exercise.explanation;
      document.getElementById("french-self-grade").hidden = false;
      document.getElementById("french-feedback").hidden = false;
      document.querySelectorAll("#french-self-grade button").forEach((b) => {
        b.onclick = () => finishFrench(b.dataset.correct === "true");
      });
    }
  }

  // ---- Block 3: English (a session of exercises cycling through the 3 focuses) ----
  function runEnglish() {
    showBlock("block-english");
    setDotState(2, "active");
    runEnglishExercise(0);
  }

  function runEnglishExercise(index) {
    const focus = nextEnglishFocus(progress.english.lastFocus);
    const exercise = pickEnglishExercise(banks.english, focus, progress.english.recentIds);

    document.getElementById("english-progress-label").textContent = `Ejercicio ${index + 1} de ${SESSION_SIZE}`;
    document.getElementById("english-focus").textContent = focus;
    document.getElementById("english-prompt").textContent = exercise.prompt;
    document.getElementById("english-feedback").hidden = true;
    document.getElementById("english-model-answer").textContent = "";

    const optionsEl = document.getElementById("english-options");
    optionsEl.innerHTML = "";

    const isLast = index === SESSION_SIZE - 1;

    function finishEnglish() {
      progress.english.recentIds = pushRecent(progress.english.recentIds, exercise.id);
      progress.english.lastFocus = focus;
      saveProgress(progress);
      document.getElementById("english-explanation").textContent = exercise.explanation;
      document.getElementById("english-feedback").hidden = false;

      const nextBtn = document.getElementById("english-next");
      nextBtn.textContent = isLast ? "Terminar" : "Siguiente";
      nextBtn.onclick = () => {
        if (isLast) {
          setDotState(2, "done");
          finishSession();
        } else {
          runEnglishExercise(index + 1);
        }
      };
    }

    if (exercise.type === "mcq") {
      renderOptions(optionsEl, exercise.options, (opt) => opt.correct, () => finishEnglish());
    } else {
      document.getElementById("english-model-answer").textContent = `Modelo: ${exercise.modelAnswer}`;
      finishEnglish();
    }
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
