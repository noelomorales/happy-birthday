const INTRO_CONFIRM_TIME = 4000;
const INTRO_COMPLETE_TIME = 6200;
const FUSE_DURATION = 25000;
const SELF_DESTRUCT_WARNING = 5000;
const DEFAULT_TYPE_SPEED = 32;
const EXPLOSION_TO_DECRYPT_DELAY = 4200;

document.documentElement.style.setProperty(
  "--fuse-duration",
  `${FUSE_DURATION}ms`
);

const scheduler = createScheduler();
let isPaused = false;

const countdownState = {
  active: false,
  remainingMs: SELF_DESTRUCT_WARNING,
  rafId: null,
  paused: false,
  lastTimestamp: null,
  display: null,
};

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const intro = document.getElementById("intro");
  const introText = intro.querySelector(".intro-text");
  const selfDestructOverlay = document.getElementById("self-destruct");
  const countdownEl = selfDestructOverlay.querySelector(
    ".self-destruct-countdown"
  );
  const pauseButton = document.getElementById("debug-pause");
  const liveMessage = document.getElementById("live-message");
  const liveMessageBody = liveMessage.querySelector(".message-body");
  const decryptionOverlay = document.getElementById("decryption");
  const decryptionStatus = decryptionOverlay
    ? decryptionOverlay.querySelector(".decryption-status")
    : null;
  const decryptionLog = decryptionOverlay
    ? decryptionOverlay.querySelector(".decryption-log")
    : null;
  const decryptionMessage = decryptionOverlay
    ? decryptionOverlay.querySelector(".decryption-message")
    : null;
  const resetButton = document.getElementById("reset-timeline");

  countdownState.display = countdownEl;

  const streamItems = Array.from(document.querySelectorAll(".stream-item"));
  const orderedStreamItems = streamItems.sort((a, b) =>
    parseFloat(a.dataset.streamOrder || "0") -
    parseFloat(b.dataset.streamOrder || "0")
  );

  prepareStreamItems(orderedStreamItems, liveMessageBody, liveMessage);

  if (decryptionMessage) {
    const fallbackText = extractText(decryptionMessage);
    const finalMessageText =
      liveMessageBody.dataset.streamText || fallbackText || "";
    decryptionMessage.dataset.streamText = finalMessageText;
    decryptionMessage.textContent = "";
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      window.location.reload();
    });
  }

  scheduler.schedule("introConfirm", () => {
    intro.classList.add("confirmed");
    introText.textContent = "Identity Confirmed";
  }, INTRO_CONFIRM_TIME);

  scheduler.schedule(
    "introComplete",
    () => {
      intro.classList.add("intro-complete");
      body.classList.add("show-dossier");
      runStreamSequence(orderedStreamItems, liveMessage, liveMessageBody).catch(
        console.error
      );
    },
    INTRO_COMPLETE_TIME
  );

  scheduler.schedule(
    "countdown",
    () => {
      startCountdown(selfDestructOverlay);
    },
    FUSE_DURATION
  );

  scheduler.schedule(
    "explode",
    () => {
      body.classList.add("explode");
    },
    FUSE_DURATION + SELF_DESTRUCT_WARNING
  );

  if (
    decryptionOverlay &&
    decryptionStatus &&
    decryptionLog &&
    decryptionMessage
  ) {
    scheduler.schedule(
      "decrypt",
      () => {
        startDecryptionSequence({
          overlay: decryptionOverlay,
          statusEl: decryptionStatus,
          logEl: decryptionLog,
          messageEl: decryptionMessage,
          body,
        });
      },
      FUSE_DURATION + SELF_DESTRUCT_WARNING + EXPLOSION_TO_DECRYPT_DELAY
    );
  }

  pauseButton.addEventListener("click", () => {
    togglePause(pauseButton, body);
  });
});

function createScheduler() {
  const timers = new Map();

  const schedule = (name, callback, delay) => {
    const timer = {
      name,
      callback,
      remaining: delay,
      start: performance.now(),
      id: null,
    };

    timer.id = window.setTimeout(() => {
      timers.delete(name);
      callback();
    }, delay);

    timers.set(name, timer);
    return timer;
  };

  const pauseAll = () => {
    timers.forEach((timer) => {
      clearTimeout(timer.id);
      const elapsed = performance.now() - timer.start;
      timer.remaining = Math.max(timer.remaining - elapsed, 0);
    });
  };

  const resumeAll = () => {
    timers.forEach((timer, name) => {
      if (timer.remaining <= 0) {
        timers.delete(name);
        timer.callback();
        return;
      }

      timer.start = performance.now();
      timer.id = window.setTimeout(() => {
        timers.delete(name);
        timer.callback();
      }, timer.remaining);
    });
  };

  return { schedule, pauseAll, resumeAll };
}

function prepareStreamItems(items, messageBody, messageContainer) {
  items.forEach((item) => {
    const type = item.dataset.streamType || "text";
    item.classList.remove("active", "typing");

    if (type === "text") {
      const content = extractText(item);
      item.dataset.streamText = content;
      item.textContent = "";
    }
  });

  const messageText = extractText(messageBody);
  messageBody.dataset.streamText = messageText;
  messageBody.textContent = "";
  messageContainer.classList.remove("visible");
}

async function runStreamSequence(items, liveMessage, messageBody) {
  for (const item of items) {
    await waitIfPaused();
    const type = item.dataset.streamType || "text";

    if (type === "text") {
      const speed = Number(item.dataset.streamSpeed) || DEFAULT_TYPE_SPEED;
      await typeText(item, item.dataset.streamText || "", speed);
      await controlledDelay(140);
    } else {
      item.classList.add("active");
      await controlledDelay(260);
    }
  }

  await controlledDelay(420);
  await showTransmission(liveMessage, messageBody);
}

async function showTransmission(container, messageBody) {
  container.classList.add("visible");
  await controlledDelay(220);
  await typeText(messageBody, messageBody.dataset.streamText || "", 28);
}

function extractText(element) {
  const lines = element.textContent.split("\n").map((line) => line.trim());
  const cleaned = [];
  let previousBlank = false;

  lines.forEach((line) => {
    if (line) {
      cleaned.push(line);
      previousBlank = false;
    } else if (!previousBlank) {
      cleaned.push("");
      previousBlank = true;
    }
  });

  while (cleaned.length && cleaned[0] === "") {
    cleaned.shift();
  }

  while (cleaned.length && cleaned[cleaned.length - 1] === "") {
    cleaned.pop();
  }

  return cleaned.join("\n");
}

async function typeText(element, text, speed) {
  element.classList.add("typing");
  if (element.classList.contains("stream-item")) {
    element.classList.add("active");
  }

  // Clear any existing nodes before typing
  element.innerHTML = "";

  let currentNode = document.createTextNode("");
  element.appendChild(currentNode);

  for (const char of text) {
    await waitIfPaused();

    if (char === "\n") {
      currentNode = document.createTextNode("");
      element.appendChild(document.createElement("br"));
      element.appendChild(currentNode);
      await controlledDelay(speed * 1.5);
      continue;
    }

    currentNode.data += char;
    await controlledDelay(speed);
  }

  element.classList.remove("typing");
}

function controlledDelay(duration) {
  if (duration <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let start = performance.now();
    let pauseStart = null;

    const step = (now) => {
      if (isPaused) {
        if (pauseStart === null) {
          pauseStart = now;
        }
        requestAnimationFrame(step);
        return;
      }

      if (pauseStart !== null) {
        const pausedFor = now - pauseStart;
        start += pausedFor;
        pauseStart = null;
      }

      if (now - start >= duration) {
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  });
}

function waitIfPaused() {
  if (!isPaused) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const check = () => {
      if (!isPaused) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };

    requestAnimationFrame(check);
  });
}

function togglePause(button, body) {
  isPaused = !isPaused;
  button.setAttribute("aria-pressed", String(isPaused));
  button.textContent = isPaused ? "Resume Timeline" : "Pause Timeline";
  body.classList.toggle("paused", isPaused);

  if (isPaused) {
    scheduler.pauseAll();
    countdownState.paused = true;
  } else {
    scheduler.resumeAll();
    countdownState.paused = false;
    if (countdownState.active && countdownState.rafId === null) {
      countdownState.rafId = requestAnimationFrame((timestamp) =>
        updateCountdown(timestamp, countdownState)
      );
    }
  }
}

function startDecryptionSequence({ overlay, statusEl, logEl, messageEl, body }) {
  if (!overlay || !statusEl || !logEl || !messageEl) {
    return;
  }

  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
  logEl.innerHTML = "";

  (async () => {
    await controlledDelay(600);
    statusEl.textContent = "Re-establishing secure channel...";
    await controlledDelay(900);
    statusEl.textContent = "Decrypting message...";
    overlay.classList.add("decrypting");

    const steps = [
      "Initializing fallback cipher suite...",
      "Routing through secure satellite uplink...",
      "Payload integrity confirmed."
    ];

    for (const line of steps) {
      await appendDecryptionLine(logEl, line, 26);
      await controlledDelay(260);
    }

    statusEl.textContent = "Decryption complete.";
    overlay.classList.add("message-ready");
    await controlledDelay(480);

    await typeText(messageEl, messageEl.dataset.streamText || "", 26);
    await controlledDelay(540);
    body.classList.add("highlight-map");
  })().catch(console.error);
}

async function appendDecryptionLine(container, text, speed = 24) {
  const line = document.createElement("p");
  line.className = "log-line";
  container.appendChild(line);
  await typeText(line, text, speed);
  line.classList.add("complete");
}

function createTimerController(perf, timersApi) {
  const scheduled = new Map();

  const schedule = (name, callback, delay) => {
    const timer = {
      name,
      callback,
      remaining: delay,
      start: perf.now(),
      id: null,
    };

    timer.id = timersApi.setTimeout(() => {
      scheduled.delete(name);
      callback();
    }, delay);

    scheduled.set(name, timer);
    return timer;
  };

  const pauseAll = () => {
    scheduled.forEach((timer) => {
      timersApi.clearTimeout(timer.id);
      const elapsed = Math.max(perf.now() - timer.start, 0);
      timer.remaining = Math.max(timer.remaining - elapsed, 0);
    });
  };

  const resumeAll = () => {
    scheduled.forEach((timer, name) => {
      if (timer.remaining <= 0) {
        scheduled.delete(name);
        timer.callback();
        return;
      }

      timer.start = perf.now();
      timer.id = timersApi.setTimeout(() => {
        scheduled.delete(name);
        timer.callback();
      }, timer.remaining);
    });
  };

  const clear = () => {
    scheduled.forEach((timer) => timersApi.clearTimeout(timer.id));
    scheduled.clear();
  };

  return { schedule, pauseAll, resumeAll, clear };
}

function createController({ document, performance: perf, timers }) {
  const state = { paused: false };
  const body = document.body;
  const html = document.documentElement;
  const intro = document.getElementById("intro");
  const introText = intro ? intro.querySelector(".intro-text") : null;
  const selfDestructOverlay = document.getElementById("self-destruct");
  const countdownEl = selfDestructOverlay
    ? selfDestructOverlay.querySelector(".self-destruct-countdown")
    : null;
  const pauseButton = document.getElementById("pause-toggle");

  const timerController = createTimerController(perf, timers);
  let introFinished = false;
  let exploded = false;

  const updateFuseVariable = () => {
    html.style.setProperty("--fuse-duration", `${FUSE_DURATION}ms`);
  };

  const runIntroComplete = () => {
    if (intro) {
      intro.classList.add("intro-complete");
    }
    body.classList.add("show-dossier");
    introFinished = true;
    if (pauseButton) {
      pauseButton.disabled = false;
      pauseButton.classList.add("active");
      pauseButton.textContent = "Pause Autodestruct";
    }
  };

  const runCountdown = () => {
    if (selfDestructOverlay) {
      selfDestructOverlay.classList.add("visible");
    }
    if (countdownEl) {
      countdownEl.textContent = String(
        Math.ceil(SELF_DESTRUCT_WARNING / 1000)
      );
    }
  };

  const runExplosion = () => {
    body.classList.add("explode");
    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.textContent = "Autodestruct Complete";
    }
    exploded = true;
  };

  const schedulePostIntro = () => {
    exploded = false;
    timerController.schedule("countdown", runCountdown, FUSE_DURATION);
    timerController.schedule(
      "explode",
      runExplosion,
      FUSE_DURATION + SELF_DESTRUCT_WARNING
    );
  };

  const start = () => {
    introFinished = false;
    exploded = false;
    updateFuseVariable();

    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.classList.add("active");
      pauseButton.textContent = "Pause Autodestruct";
    }

    if (introText) {
      introText.textContent = "Initializing...";
    }

    timerController.schedule("introComplete", () => {
      runIntroComplete();
      if (!state.paused) {
        schedulePostIntro();
      }
    }, INTRO_COMPLETE_TIME);
  };

  const pauseTimeline = () => {
    if (state.paused) {
      return;
    }
    state.paused = true;
    body.classList.add("paused");
    timerController.clear();
    if (!exploded && selfDestructOverlay) {
      selfDestructOverlay.classList.remove("visible");
    }
    if (!exploded) {
      body.classList.remove("explode");
    }
    if (pauseButton) {
      pauseButton.textContent = "Resume Autodestruct";
    }
  };

  const resumeTimeline = () => {
    if (!state.paused) {
      return;
    }
    state.paused = false;
    body.classList.remove("paused");
    if (pauseButton) {
      pauseButton.textContent = "Pause Autodestruct";
      pauseButton.disabled = false;
    }

    if (!introFinished) {
      timerController.schedule("introComplete", () => {
        runIntroComplete();
        if (!state.paused) {
          schedulePostIntro();
        }
      }, INTRO_COMPLETE_TIME);
      return;
    }

    if (!exploded) {
      schedulePostIntro();
    }
  };

  return {
    start,
    pauseTimeline,
    resumeTimeline,
    state,
  };
}

function startCountdown(overlay) {
  overlay.classList.add("visible");
  countdownState.active = true;
  countdownState.remainingMs = SELF_DESTRUCT_WARNING;
  countdownState.lastTimestamp = null;
  countdownState.paused = isPaused;
  countdownState.display.textContent = Math.ceil(
    countdownState.remainingMs / 1000
  );

  if (countdownState.rafId !== null) {
    cancelAnimationFrame(countdownState.rafId);
  }

  countdownState.rafId = requestAnimationFrame((timestamp) =>
    updateCountdown(timestamp, countdownState)
  );
}

function updateCountdown(timestamp, state) {
  if (!state.active) {
    state.rafId = null;
    return;
  }

  if (state.paused) {
    state.lastTimestamp = timestamp;
    state.rafId = requestAnimationFrame((next) => updateCountdown(next, state));
    return;
  }

  if (state.lastTimestamp === null) {
    state.lastTimestamp = timestamp;
  }

  const delta = timestamp - state.lastTimestamp;
  state.lastTimestamp = timestamp;
  state.remainingMs = Math.max(state.remainingMs - delta, 0);
  state.display.textContent = Math.ceil(state.remainingMs / 1000);

  if (state.remainingMs <= 0) {
    state.display.textContent = "0";
    state.active = false;
    state.rafId = null;
    return;
  }

  state.rafId = requestAnimationFrame((next) => updateCountdown(next, state));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createController,
    constants: {
      INTRO_CONFIRM_TIME,
      INTRO_COMPLETE_TIME,
      FUSE_DURATION,
      SELF_DESTRUCT_WARNING,
      EXPLOSION_TO_DECRYPT_DELAY,
    },
  };
}
