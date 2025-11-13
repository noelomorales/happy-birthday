const INTRO_CONFIRM_TIME = 4000;
const INTRO_COMPLETE_TIME = 6200;
const FUSE_DURATION = 25000;
const SELF_DESTRUCT_WARNING = 5000;
const DEFAULT_TYPE_SPEED = 32;
const SELF_DESTRUCT_GRACE_PERIOD = 4000;
const TRANSMISSION_TYPE_SPEED = 28;

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

  countdownState.display = countdownEl;

  const streamItems = Array.from(document.querySelectorAll(".stream-item"));
  const orderedStreamItems = streamItems.sort((a, b) =>
    parseFloat(a.dataset.streamOrder || "0") -
    parseFloat(b.dataset.streamOrder || "0")
  );

  prepareStreamItems(orderedStreamItems, liveMessageBody, liveMessage);

  const estimatedStreamDuration = estimateStreamDuration(
    orderedStreamItems,
    liveMessageBody
  );
  const fuseDuration = Math.max(
    Math.round(estimatedStreamDuration + SELF_DESTRUCT_GRACE_PERIOD),
    FUSE_DURATION
  );

  document.documentElement.style.setProperty(
    "--fuse-duration",
    `${fuseDuration}ms`
  );

  let selfDestructScheduled = false;

  const scheduleSelfDestructSequence = () => {
    if (selfDestructScheduled) {
      return;
    }

    selfDestructScheduled = true;

    scheduler.schedule(
      "countdown",
      () => {
        startCountdown(selfDestructOverlay);
      },
      SELF_DESTRUCT_GRACE_PERIOD
    );

    scheduler.schedule(
      "explode",
      () => {
        body.classList.add("explode");
      },
      SELF_DESTRUCT_GRACE_PERIOD + SELF_DESTRUCT_WARNING
    );
  };

  scheduler.schedule("introConfirm", () => {
    intro.classList.add("confirmed");
    introText.textContent = "Identity Confirmed";
  }, INTRO_CONFIRM_TIME);

  scheduler.schedule(
    "introComplete",
    () => {
      intro.classList.add("intro-complete");
      body.classList.add("show-dossier");
      runStreamSequence(orderedStreamItems, liveMessage, liveMessageBody)
        .then(() => {
          scheduleSelfDestructSequence();
        })
        .catch(console.error);
    },
    INTRO_COMPLETE_TIME
  );

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
  await typeText(
    messageBody,
    messageBody.dataset.streamText || "",
    TRANSMISSION_TYPE_SPEED
  );
}

function estimateStreamDuration(items, messageBody) {
  let total = 0;

  items.forEach((item) => {
    const type = item.dataset.streamType || "text";

    if (type === "text") {
      const speed = Number(item.dataset.streamSpeed) || DEFAULT_TYPE_SPEED;
      total += estimateTypingDuration(item.dataset.streamText || "", speed);
      total += 140;
    } else {
      total += 260;
    }
  });

  total += 420;
  total += 220;
  total += estimateTypingDuration(
    messageBody.dataset.streamText || "",
    TRANSMISSION_TYPE_SPEED
  );

  return total;
}

function estimateTypingDuration(text, speed) {
  let duration = 0;

  for (const char of text) {
    if (char === "\n") {
      duration += speed * 1.5;
    } else {
      duration += speed;
    }
  }

  return duration;
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
