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
