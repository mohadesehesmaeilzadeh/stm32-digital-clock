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
const digitNodes = Array.from(document.querySelectorAll(".digit"));
const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
const panels = Array.from(document.querySelectorAll("[data-panel]"));

const state = {
  minute: 0,
  second: 0,
  msCounter: 0,
  activeDigit: 0,
  irqCount: 0,
  running: true,
  speed: 1,
  mode: "lab",
  score: 0,
  targetSecond: 10,
  targetMinute: 0,
  timeline: [],
};

let accumulatedMs = 0;
let lastFrame = performance.now();

const $ = (id) => document.getElementById(id);

function displayDigits() {
  return [
    Math.floor(state.minute / 10),
    state.minute % 10,
    Math.floor(state.second / 10),
    state.second % 10,
  ];
}

function refreshOneDigit() {
  const digits = displayDigits();
  const digit = digits[state.activeDigit];
  const pattern = SEG_CODES[digit] | (state.activeDigit === 1 ? 0x80 : 0);
  const gpioB = 0x0f & ~(1 << state.activeDigit);

  state.timeline.push({ digit: state.activeDigit, height: 24 + state.activeDigit * 16 });
  state.timeline = state.timeline.slice(-16);

  renderDisplay(digits);
  renderRegisters(pattern, gpioB);
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
      state.minute += 1;
      if (state.minute >= 60) {
        state.minute = 0;
      }
    }
  }
}

function renderDisplay(digits) {
  digitNodes.forEach((node, index) => {
    const active = index === state.activeDigit;
    node.classList.toggle("active", active);
    node.classList.toggle("persist", $("showPersistence").checked);

    const lit = new Set(SEGMENTS[digits[index]]);
    node.querySelectorAll(".seg").forEach((segment) => {
      const key = Array.from(segment.classList).find((name) => name.length === 1);
      segment.classList.toggle("on", lit.has(key) && (active || $("showPersistence").checked));
    });

    const dot = node.querySelector(".dot");
    dot.classList.toggle("on", index === 1 && (active || $("showPersistence").checked));
  });

  $("timeLabel").textContent = `${String(state.minute).padStart(2, "0")}.${String(state.second).padStart(2, "0")}`;
  $("refreshLabel").textContent = `Digit ${state.activeDigit + 1} active`;
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
    const isOn = Boolean(value & (1 << bitIndex));
    const bit = document.createElement("span");
    bit.className = "bit";
    bit.classList.toggle("on", activeLowDigits && bitIndex < 4 ? !isOn : isOn);
    bit.textContent = label;
    container.appendChild(bit);
  });
}

function renderState() {
  $("minuteValue").textContent = state.minute;
  $("secondValue").textContent = state.second;
  $("msValue").textContent = state.msCounter;
  $("activeValue").textContent = state.activeDigit;
  $("irqValue").textContent = state.irqCount.toLocaleString();
  $("hzValue").textContent = Math.round(250 * state.speed);
  $("runStatus").textContent = state.running ? "RUNNING" : "PAUSED";
  $("runStatus").classList.toggle("muted", !state.running);
  $("speedStatus").textContent = `${state.speed.toFixed(2)}x`;
}

function renderTimeline() {
  const timeline = $("timeline");
  timeline.innerHTML = "";
  const items = state.timeline.length ? state.timeline : Array.from({ length: 16 }, (_, i) => ({ digit: i % 4, height: 20 }));
  items.forEach((item) => {
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.title = `Digit ${item.digit + 1}`;
    const bar = document.createElement("span");
    bar.style.minHeight = `${item.height}%`;
    tick.appendChild(bar);
    timeline.appendChild(tick);
  });
}

function setMode(mode) {
  state.mode = mode;
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== mode && panel.dataset.panel !== "lab";
    if (mode !== "lab" && panel.dataset.panel === "lab") {
      panel.hidden = true;
    }
  });
  document.querySelector(".timeline-panel").hidden = false;
}

function resetClock() {
  Object.assign(state, {
    minute: 0,
    second: 0,
    msCounter: 0,
    activeDigit: 0,
    irqCount: 0,
    timeline: [],
  });
  renderAll();
}

function totalSeconds(minute, second) {
  return minute * 60 + second;
}

function newTarget() {
  state.targetMinute = Math.floor(Math.random() * 3);
  state.targetSecond = Math.floor(5 + Math.random() * 55);
  $("targetTime").textContent = `${String(state.targetMinute).padStart(2, "0")}.${String(state.targetSecond).padStart(2, "0")}`;
  $("challengeFeedback").textContent = "Pause the clock on the target, then check.";
}

function checkTarget() {
  const now = totalSeconds(state.minute, state.second);
  const target = totalSeconds(state.targetMinute, state.targetSecond);
  const diff = Math.abs(now - target);

  if (diff <= 2) {
    const earned = Math.max(10, Math.round(60 * state.speed - diff * 8));
    state.score += earned;
    $("challengeFeedback").textContent = `Hit. Difference ${diff}s, +${earned} points.`;
    newTarget();
  } else {
    state.score = Math.max(0, state.score - 8);
    $("challengeFeedback").textContent = `Missed by ${diff}s. Slow the simulation or step manually.`;
  }

  $("scoreChip").textContent = `Score ${state.score}`;
}

function renderAll() {
  renderDisplay(displayDigits());
  renderRegisters(SEG_CODES[displayDigits()[state.activeDigit]] || 0, 0x0f & ~(1 << state.activeDigit));
  renderTimeline();
  renderState();
}

function applyInitialOptions() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const speed = Number(params.get("speed"));
  const paused = params.get("paused") === "1";

  if (["lab", "challenge", "wiring"].includes(mode)) {
    setMode(mode);
  }

  if (Number.isFinite(speed) && speed >= 0.25 && speed <= 16) {
    state.speed = speed;
    $("speedRange").value = String(speed);
  }

  if (paused) {
    state.running = false;
    $("toggleRun").textContent = "Run";
  }
}

function frame(now) {
  const elapsed = now - lastFrame;
  lastFrame = now;

  if (state.running) {
    accumulatedMs += elapsed * state.speed;
    const steps = Math.min(80, Math.floor(accumulatedMs));
    accumulatedMs -= steps;
    for (let i = 0; i < steps; i += 1) {
      timerInterrupt();
    }
  }

  renderState();
  requestAnimationFrame(frame);
}

$("toggleRun").addEventListener("click", () => {
  state.running = !state.running;
  $("toggleRun").textContent = state.running ? "Pause" : "Run";
  renderState();
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

$("showPersistence").addEventListener("change", () => renderDisplay(displayDigits()));
$("soundTick").addEventListener("change", (event) => {
  event.target.closest(".check-option").querySelector("span").textContent = event.target.checked
    ? "Tick marker armed"
    : "Silent tick marker";
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

$("newTarget").addEventListener("click", newTarget);
$("checkTarget").addEventListener("click", checkTarget);

newTarget();
applyInitialOptions();
renderAll();
requestAnimationFrame(frame);
