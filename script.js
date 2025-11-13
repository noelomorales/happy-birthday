const INTRO_CONFIRM_TIME = 4000;
const INTRO_COMPLETE_TIME = 6200;
const FUSE_DURATION = 25000;
const SELF_DESTRUCT_WARNING = 5000;
const DEFAULT_TYPE_SPEED = 32;
const DEFAULT_FOCUS_HOLD = 1200;
const IMAGE_MANIFEST_URL = "assets/images/manifest.json";
const IMAGE_QUEUE_STORAGE_KEY = "hb:image-rotation";

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

async function assignRandomDossierImages() {
  if (typeof window === "undefined") {
    return;
  }

  const imageTargets = Array.from(
    document.querySelectorAll(".photo-card img[data-random-image]")
  );

  if (!imageTargets.length) {
    return;
  }

  try {
    const manifest = await loadImageManifest();
    if (!manifest.images.length) {
      return;
    }

    const selections = selectImagesFromManifest(manifest, imageTargets.length);
    selections.forEach((src, index) => {
      const target = imageTargets[index];
      if (target && typeof src === "string" && src.length > 0) {
        updateImageSource(target, src);
      }
    });
  } catch (error) {
    console.error("Unable to randomize dossier imagery", error);
  }
}

async function loadImageManifest() {
  const response = await fetch(IMAGE_MANIFEST_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load image manifest: ${response.status}`);
  }

  const payload = await response.json();
  const fileList = Array.isArray(payload?.images)
    ? payload.images
    : Array.isArray(payload)
      ? payload
      : [];

  const cleaned = sanitizeManifestList(fileList);
  const version = String(
    (typeof payload?.version === "string" && payload.version) ||
      payload?.generatedAt ||
      payload?.updatedAt ||
      cleaned.join("|") ||
      "0"
  );

  return {
    images: cleaned,
    version,
  };
}

function sanitizeManifestList(fileList) {
  const seen = new Set();

  return fileList
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .map((entry) =>
      entry.startsWith("assets/") ? entry : `assets/images/${entry}`
    )
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}

function selectImagesFromManifest(manifest, count) {
  if (!manifest.images.length || count <= 0) {
    return [];
  }

  const storage = getLocalStorage();
  const storedQueue = readStoredQueue(storage, manifest.version, manifest.images);
  const workingQueue = storedQueue.length
    ? [...storedQueue]
    : shuffleArray(manifest.images.slice());
  const selections = [];

  while (selections.length < count && manifest.images.length) {
    if (!workingQueue.length) {
      workingQueue.push(...shuffleArray(manifest.images.slice()));
    }

    const next = workingQueue.shift();
    if (typeof next === "string" && next.length > 0) {
      selections.push(next);
    }
  }

  persistQueue(storage, workingQueue, manifest.version);

  return selections;
}

function getLocalStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { localStorage } = window;
    const testKey = "__hb-storage-test__";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return localStorage;
  } catch (error) {
    return null;
  }
}

function readStoredQueue(storage, version, allowedImages) {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(IMAGE_QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (parsed?.version !== version || !Array.isArray(parsed?.queue)) {
      return [];
    }

    const allowed = new Set(allowedImages);
    return parsed.queue.filter(
      (entry) => typeof entry === "string" && allowed.has(entry)
    );
  } catch (error) {
    return [];
  }
}

function persistQueue(storage, queue, version) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      IMAGE_QUEUE_STORAGE_KEY,
      JSON.stringify({ version, queue })
    );
  } catch (error) {
    // Fail silently; rotation will reset on next load if persistence is unavailable.
  }
}

function shuffleArray(values) {
  const array = values.slice();

  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function updateImageSource(img, src) {
  const currentSrc = img.getAttribute("src");
  if (currentSrc === src) {
    return;
  }

  img.setAttribute("src", src);
  img.dataset.randomizedSrc = src;
}

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
  const focusStage = document.getElementById("focus-stage");
  const focusContent = focusStage.querySelector(".focus-content");
  const resetButton = document.getElementById("reset-timeline");
  const decryptionOverlay = document.getElementById("decryption-overlay");
  const decryptionStatus = document.getElementById("decryption-status");
  const decryptionLog = document.getElementById("decryption-log");
  const decryptionMessage = document.getElementById("decryption-message");
  const hasDecryptionSequence =
    typeof startDecryptionSequence === "function";

  assignRandomDossierImages();

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
      runStreamSequence(
        orderedStreamItems,
        liveMessage,
        liveMessageBody,
        focusStage,
        focusContent
      ).catch(console.error);
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
    decryptionMessage &&
    hasDecryptionSequence
  ) {
    const decryptDelay =
      typeof EXPLOSION_TO_DECRYPT_DELAY === "number"
        ? EXPLOSION_TO_DECRYPT_DELAY
        : 1800;
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
      FUSE_DURATION + SELF_DESTRUCT_WARNING + decryptDelay
    );
  }

  pauseButton.addEventListener("click", () => {
    togglePause(pauseButton, body);
  });
});

function createScheduler(options = {}) {
  const setTimer =
    options.setTimeout || (typeof window !== "undefined" && window.setTimeout)
      ? options.setTimeout || window.setTimeout.bind(window)
      : setTimeout;
  const clearTimer =
    options.clearTimeout ||
    (typeof window !== "undefined" && window.clearTimeout)
      ? options.clearTimeout || window.clearTimeout.bind(window)
      : clearTimeout;
  const nowFn =
    typeof options.now === "function"
      ? options.now
      : () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const timers = new Map();

  const schedule = (name, callback, delay) => {
    const timer = {
      name,
      callback,
      remaining: delay,
      start: nowFn(),
      id: null,
    };

    timer.id = setTimer(() => {
      timers.delete(name);
      callback();
    }, delay);

    timers.set(name, timer);
    return timer;
  };

  const pauseAll = () => {
    timers.forEach((timer) => {
      clearTimer(timer.id);
      const elapsed = nowFn() - timer.start;
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

      timer.start = nowFn();
      timer.id = setTimer(() => {
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
    item.classList.remove("module-online");

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

async function runStreamSequence(
  items,
  liveMessage,
  messageBody,
  focusStage,
  focusContent
) {
  for (const item of items) {
    await waitIfPaused();
    const type = item.dataset.streamType || "text";
    const focusMode = item.dataset.focusMode || "";
    const focusLabel = resolveFocusLabel(item);
    const focusHold = Number(item.dataset.focusHold || 0);

    if (type === "text") {
      const speed = Number(item.dataset.streamSpeed) || DEFAULT_TYPE_SPEED;
      const textContent = item.dataset.streamText || "";

      if (focusMode) {
        await engageFocus(item, focusStage, focusContent, {
          type,
          mode: focusMode,
          label: focusLabel,
          speed: Number(item.dataset.focusSpeed) || speed,
          text: textContent,
          hold: focusHold || DEFAULT_FOCUS_HOLD,
        });
      }

      await typeText(item, textContent, speed);
      await controlledDelay(160);
      continue;
    }

    if (type === "media") {
      if (focusMode) {
        await engageFocus(item, focusStage, focusContent, {
          type,
          mode: focusMode,
          label: focusLabel,
          hold: focusHold || 1100,
        });
      }

      item.classList.add("active");
      await controlledDelay(320);
      continue;
    }

    await engageFocus(item, focusStage, focusContent, {
      type: "module",
      mode: focusMode || "module",
      label: focusLabel,
      hold: focusHold || 1500,
    });

    item.classList.add("active");
    await controlledDelay(520);
  }

  await controlledDelay(420);
  await showTransmission(liveMessage, messageBody);
}

async function showTransmission(container, messageBody) {
  container.classList.add("visible");
  await controlledDelay(220);
  await typeText(messageBody, messageBody.dataset.streamText || "", 28);
}

function resolveFocusLabel(item) {
  if (item.dataset.focusTitle) {
    return item.dataset.focusTitle;
  }

  const heading = item.querySelector("h2, h3, h4, h5");
  if (heading && heading.textContent) {
    return heading.textContent.trim();
  }

  const aria = item.getAttribute("aria-label");
  if (aria) {
    return aria;
  }

  return "Incoming Feed";
}

async function engageFocus(item, stage, content, config) {
  if (!stage || !content) {
    return;
  }

  await waitIfPaused();

  const mode = config.mode || item.dataset.focusMode || "module";
  const label = config.label || resolveFocusLabel(item);
  const { container, target } = createFocusClone(item, {
    mode,
    label,
    type: config.type,
  });
  const holdDuration = config.hold || DEFAULT_FOCUS_HOLD;
  const typeSpeed = config.speed || DEFAULT_TYPE_SPEED;

  stage.classList.remove("retreating", "engaged");
  stage.dataset.mode = mode;
  stage.setAttribute("aria-hidden", "false");
  stage.classList.add("visible");

  content.innerHTML = "";
  content.appendChild(container);

  await controlledDelay(60);
  stage.classList.add("engaged");

  if (config.type === "text") {
    await typeText(target, config.text || "", typeSpeed);
    await controlledDelay(240);
  } else {
    await controlledDelay(holdDuration);
  }

  stage.classList.add("retreating");
  await controlledDelay(360);

  stage.classList.remove("visible", "engaged", "retreating");
  stage.removeAttribute("data-mode");
  stage.setAttribute("aria-hidden", "true");
  content.innerHTML = "";
}

function createFocusClone(item, config) {
  const wrapper = document.createElement("div");
  const labelEl = document.createElement("div");
  const body = document.createElement("div");

  wrapper.classList.add("focus-item", `focus-${config.mode}`);
  labelEl.classList.add("focus-label");
  labelEl.textContent = config.label;
  body.classList.add("focus-body");

  wrapper.appendChild(labelEl);
  wrapper.appendChild(body);

  if (config.type === "text") {
    return { container: wrapper, target: body };
  }

  const clone = item.cloneNode(true);
  clone.classList.remove("stream-item", "active", "typing", "module-online");
  clone.removeAttribute("data-stream-order");

  body.appendChild(clone);
  return { container: wrapper, target: clone };
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

function togglePause(
  button,
  body,
  schedulerInstance = scheduler,
  countdown = countdownState
) {
  isPaused = !isPaused;
  button.setAttribute("aria-pressed", String(isPaused));
  button.textContent = isPaused ? "Resume Timeline" : "Pause Timeline";
  body.classList.toggle("paused", isPaused);

  if (isPaused) {
    schedulerInstance.pauseAll();
    countdown.paused = true;
  } else {
    schedulerInstance.resumeAll();
    countdown.paused = false;
    if (countdown.active && countdown.rafId === null) {
      countdown.rafId = requestAnimationFrame((timestamp) =>
        updateCountdown(timestamp, countdown)
      );
    }
  }
}

function startCountdown(overlay, state = countdownState) {
  overlay.classList.add("visible");
  state.active = true;
  state.remainingMs = SELF_DESTRUCT_WARNING;
  state.lastTimestamp = null;
  state.paused = isPaused;
  state.display.textContent = Math.ceil(state.remainingMs / 1000);

  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
  }

  state.rafId = requestAnimationFrame((timestamp) =>
    updateCountdown(timestamp, state)
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

function createCountdownStateSnapshot(display) {
  return {
    active: false,
    remainingMs: SELF_DESTRUCT_WARNING,
    rafId: null,
    paused: false,
    lastTimestamp: null,
    display,
  };
}

function createController(env = {}) {
  const doc = env.document || document;
  const perf = env.performance || performance;
  const timers = env.timers || {};

  const schedulerInstance = createScheduler({
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    now: typeof perf.now === "function" ? () => perf.now() : undefined,
  });

  const intro = doc.getElementById("intro");
  const introText = intro ? intro.querySelector(".intro-text") : null;
  const selfDestructOverlay = doc.getElementById("self-destruct");
  const countdownDisplay = selfDestructOverlay
    ? selfDestructOverlay.querySelector(".self-destruct-countdown")
    : null;
  const dossier = doc.getElementById("dossier");
  const fuse = doc.getElementById("fuse");
  const pauseButton =
    doc.getElementById("pause-toggle") || doc.getElementById("debug-pause");

  const localCountdownState = createCountdownStateSnapshot(countdownDisplay);

  const state = {
    paused: false,
    started: false,
    completed: false,
  };

  const setFuseVariable = () => {
    doc.documentElement.style.setProperty(
      "--fuse-duration",
      `${FUSE_DURATION}ms`
    );
  };

  const confirmIntro = () => {
    if (intro) {
      intro.classList.add("confirmed");
    }
    if (introText) {
      introText.textContent = "Identity Confirmed";
    }
  };

  const unlockDossier = () => {
    if (intro) {
      intro.classList.add("intro-complete");
    }
    if (doc.body) {
      doc.body.classList.add("show-dossier");
    }
    if (dossier) {
      dossier.setAttribute("aria-hidden", "false");
    }
    if (pauseButton) {
      pauseButton.disabled = false;
      pauseButton.classList.add("active");
      pauseButton.classList.remove("paused");
      pauseButton.textContent = "Pause Autodestruct";
    }
    state.started = true;
  };

  const beginCountdown = () => {
    if (fuse) {
      fuse.classList.add("ignited");
    }
    if (selfDestructOverlay) {
      selfDestructOverlay.classList.add("visible");
    }
    if (countdownDisplay) {
      countdownDisplay.textContent = `${Math.ceil(
        SELF_DESTRUCT_WARNING / 1000
      )}`;
    }
    localCountdownState.active = false;
    localCountdownState.paused = isPaused;
  };

  const triggerExplosion = () => {
    if (doc.body) {
      doc.body.classList.add("explode");
      doc.body.classList.remove("paused");
    }
    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.classList.remove("active");
      pauseButton.textContent = "Autodestruct Complete";
    }
    state.completed = true;
  };

  const scheduleTimeline = () => {
    schedulerInstance.schedule("introConfirm", confirmIntro, INTRO_CONFIRM_TIME);
    schedulerInstance.schedule(
      "introComplete",
      unlockDossier,
      INTRO_COMPLETE_TIME
    );
    schedulerInstance.schedule("countdown", beginCountdown, FUSE_DURATION);
    schedulerInstance.schedule(
      "explode",
      triggerExplosion,
      FUSE_DURATION + SELF_DESTRUCT_WARNING
    );
  };

  const resetView = () => {
    isPaused = false;
    if (intro) {
      intro.classList.remove("intro-complete", "confirmed");
    }
    if (doc.body) {
      doc.body.classList.remove("show-dossier", "explode", "paused");
    }
    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.classList.remove("active", "paused");
      pauseButton.textContent = "Pause Autodestruct";
      pauseButton.setAttribute("aria-pressed", "false");
    }
    if (selfDestructOverlay) {
      selfDestructOverlay.classList.remove("visible");
    }
    localCountdownState.active = false;
    localCountdownState.remainingMs = SELF_DESTRUCT_WARNING;
    localCountdownState.paused = false;
    localCountdownState.rafId = null;
    localCountdownState.lastTimestamp = null;
    if (countdownDisplay) {
      countdownDisplay.textContent = `${Math.ceil(
        SELF_DESTRUCT_WARNING / 1000
      )}`;
    }
  };

  return {
    state,
    start() {
      resetView();
      setFuseVariable();
      scheduleTimeline();
    },
    pauseTimeline() {
      if (state.paused || state.completed) {
        return;
      }
      state.paused = true;
      if (pauseButton) {
        pauseButton.classList.add("paused");
      }
      togglePause(
        pauseButton || doc.createElement("button"),
        doc.body,
        schedulerInstance,
        localCountdownState
      );
      if (pauseButton) {
        pauseButton.textContent = "Resume Autodestruct";
      }
    },
    resumeTimeline() {
      if (!state.paused || state.completed) {
        return;
      }
      state.paused = false;
      if (pauseButton) {
        pauseButton.classList.remove("paused");
      }
      togglePause(
        pauseButton || doc.createElement("button"),
        doc.body,
        schedulerInstance,
        localCountdownState
      );
      if (pauseButton) {
        pauseButton.textContent = "Pause Autodestruct";
      }
    },
  };
}

const exportedConstants = {
  INTRO_CONFIRM_TIME,
  INTRO_COMPLETE_TIME,
  FUSE_DURATION,
  SELF_DESTRUCT_WARNING,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createController,
    createScheduler,
    constants: exportedConstants,
  };
}
