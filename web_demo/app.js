const SEGMENTS = {
  0: ["a", "b", "c", "d", "e", "f"],
  1: ["b", "c"],
  2: ["a", "b", "d", "e", "g"],
  3: ["a", "b", "c", "d", "g"],
  4: ["b", "c", "f", "g"],
  5: ["a", "c", "d", "f", "g"],
  6: ["a", "c", "d", "e", "f", "g"],
  7: ["a", "b", "c"],
  8: ["a", "b", "c", "d", "e", "f", "g"],
  9: ["a", "b", "c", "d", "f", "g"],
};

const SEG_CODES = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
const $ = (id) => document.getElementById(id);

const state = {
  minute: 0,
  second: 0,
  msCounter: 0,
  activeDigit: 0,
  irqCount: 0,
  running: true,
  speed: 1,
  mode: "lab",
  targetMinute: 0,
  targetSecond: 10,
  score: 0,
  timeline: [],
};

let lastFrame = performance.now();
let accumulatedMs = 0;

function createDisplay(container) {
  container.innerHTML = "";
  for (let index = 0; index < 4; index += 1) {
    const digit = document.createElement("div");
    digit.className = "digit";
    digit.dataset.index = String(index);
    ["a", "b", "c", "d", "e", "f", "g"].forEach((segment) => {
      const element = document.createElement("span");
      element.className = `seg ${segment}`;
      digit.appendChild(element);
    });
    const dot = document.createElement("span");
    dot.className = "dot";
    digit.appendChild(dot);
    container.appendChild(digit);
  }
}

createDisplay($("heroDisplay"));
createDisplay($("simDisplay"));

function digits() {
  return [
    Math.floor(state.minute / 10),
    state.minute % 10,
    Math.floor(state.second / 10),
    state.second % 10,
  ];
}

function refreshOneDigit() {
  const activePattern = SEG_CODES[digits()[state.activeDigit]] | (state.activeDigit === 1 ? 0x80 : 0);
  const gpioB = 0x0f & ~(1 << state.activeDigit);

  state.timeline.push({ digit: state.activeDigit, height: 24 + state.activeDigit * 16 });
  state.timeline = state.timeline.slice(-16);

  renderDisplays(activePattern, gpioB);
  renderRegisters(activePattern, gpioB);
  renderTimeline();

  state.activeDigit = (state.activeDigit + 1) % 4;
  state.irqCount += 1;
}

function timerInterrupt() {
  refreshOneDigit();
  state.msCounter += 1;
  if (state.msCounter >= 1000) {
    state.msCounter = 0;
    state.second += 1;
    if (state.second >= 60) {
      state.second = 0;
      state.minute = (state.minute + 1) % 60;
    }
  }
}

function renderDisplay(container, persistence) {
  const currentDigits = digits();
  Array.from(container.querySelectorAll(".digit")).forEach((digitNode, index) => {
    const active = index === state.activeDigit;
    const lit = new Set(SEGMENTS[currentDigits[index]]);
    digitNode.classList.toggle("active", active);
    digitNode.classList.toggle("persist", persistence);

    digitNode.querySelectorAll(".seg").forEach((segment) => {
      const key = Array.from(segment.classList).find((name) => name.length === 1);
      segment.classList.toggle("on", lit.has(key) && (active || persistence));
    });

    digitNode.querySelector(".dot").classList.toggle("on", index === 1 && (active || persistence));
  });
}

function renderDisplays() {
  const persistence = $("persistenceToggle").checked;
  renderDisplay($("heroDisplay"), true);
  renderDisplay($("simDisplay"), persistence);
  const timeText = `${String(state.minute).padStart(2, "0")}.${String(state.second).padStart(2, "0")}`;
  $("heroTime").textContent = timeText;
  $("simTime").textContent = timeText;
  $("activeDigitText").textContent = `Digit ${state.activeDigit + 1} active`;
  $("scanPulse").style.setProperty("--scan-x", `${state.activeDigit * 100}%`);
}

function renderRegisters(gpioA, gpioB) {
  $("gpioAHex").textContent = `0x${gpioA.toString(16).toUpperCase().padStart(2, "0")}`;
  $("gpioBHex").textContent = `0x${gpioB.toString(16).toUpperCase().padStart(2, "0")}`;
  renderBits($("gpioABits"), gpioA, ["DP", "G", "F", "E", "D", "C", "B", "A"]);
  renderBits($("gpioBBits"), gpioB, ["PB7", "PB6", "PB5", "PB4", "D4", "D3", "D2", "D1"], true);
}

function renderBits(container, value, labels, activeLowDigits = false) {
  container.innerHTML = "";
  labels.forEach((label, reverseIndex) => {
    const bitIndex = 7 - reverseIndex;
    const high = Boolean(value & (1 << bitIndex));
    const bit = document.createElement("span");
    bit.className = "bit";
    bit.classList.toggle("on", activeLowDigits && bitIndex < 4 ? !high : high);
    bit.textContent = label;
    container.appendChild(bit);
  });
}

function renderState() {
  $("minuteValue").textContent = state.minute;
  $("secondValue").textContent = state.second;
  $("msValue").textContent = state.msCounter;
  $("activeValue").textContent = state.activeDigit;
  $("speedLabel").textContent = `${state.speed.toFixed(2)}x`;
  $("heroSpeed").textContent = `${state.speed.toFixed(2)}x`;
}

function renderTimeline() {
  const items = state.timeline.length ? state.timeline : Array.from({ length: 16 }, (_, index) => ({ digit: index % 4, height: 18 }));
  $("timeline").innerHTML = "";
  items.forEach((item) => {
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.setAttribute("aria-label", `Digit ${item.digit + 1}`);
    const bar = document.createElement("span");
    bar.style.minHeight = `${item.height}%`;
    tick.appendChild(bar);
    $("timeline").appendChild(tick);
  });
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== mode;
  });
}

function resetClock() {
  state.minute = 0;
  state.second = 0;
  state.msCounter = 0;
  state.activeDigit = 0;
  state.irqCount = 0;
  state.timeline = [];
  renderAll();
}

function newTarget() {
  state.targetMinute = Math.floor(Math.random() * 3);
  state.targetSecond = Math.floor(5 + Math.random() * 55);
  $("targetTime").textContent = `${String(state.targetMinute).padStart(2, "0")}.${String(state.targetSecond).padStart(2, "0")}`;
  $("challengeFeedback").textContent = "Pause the clock as close as possible to the target.";
}

function checkTarget() {
  const now = state.minute * 60 + state.second;
  const target = state.targetMinute * 60 + state.targetSecond;
  const difference = Math.abs(now - target);
  if (difference <= 2) {
    state.score += Math.max(10, Math.round(70 * state.speed - difference * 8));
    $("challengeFeedback").textContent = `Hit. Difference: ${difference}s. Score: ${state.score}.`;
    newTarget();
  } else {
    state.score = Math.max(0, state.score - 8);
    $("challengeFeedback").textContent = `Missed by ${difference}s. Score: ${state.score}.`;
  }
}

function applyInitialOptions() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const speed = Number(params.get("speed"));
  if (["lab", "challenge", "wiring"].includes(mode)) {
    setMode(mode);
  }
  if (Number.isFinite(speed) && speed >= 0.25 && speed <= 16) {
    state.speed = speed;
    $("speedRange").value = String(speed);
  }
  if (params.get("paused") === "1") {
    state.running = false;
    $("toggleRun").textContent = "Run";
  }
}

function renderAll() {
  renderDisplays();
  renderRegisters(SEG_CODES[digits()[state.activeDigit]], 0x0f & ~(1 << state.activeDigit));
  renderTimeline();
  renderState();
}

function frame(now) {
  const elapsed = now - lastFrame;
  lastFrame = now;
  if (state.running) {
    accumulatedMs += elapsed * state.speed;
    const steps = Math.min(90, Math.floor(accumulatedMs));
    accumulatedMs -= steps;
    for (let index = 0; index < steps; index += 1) {
      timerInterrupt();
    }
  }
  renderState();
  requestAnimationFrame(frame);
}

$("themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
});

$("toggleRun").addEventListener("click", () => {
  state.running = !state.running;
  $("toggleRun").textContent = state.running ? "Pause" : "Run";
});

$("resetClock").addEventListener("click", resetClock);
$("stepMs").addEventListener("click", () => {
  state.running = false;
  $("toggleRun").textContent = "Run";
  timerInterrupt();
  renderState();
});

$("speedRange").addEventListener("input", (event) => {
  state.speed = Number(event.target.value);
  renderState();
});

$("persistenceToggle").addEventListener("change", () => renderDisplays());

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

$("newTarget").addEventListener("click", newTarget);
$("checkTarget").addEventListener("click", checkTarget);

newTarget();
applyInitialOptions();
renderAll();
requestAnimationFrame(frame);
