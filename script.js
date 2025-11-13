const IMAGE_MANIFEST_URL =
  (typeof window !== "undefined" && window.IMAGE_MANIFEST_URL) ||
  "assets/images/manifest.json";
const IMAGE_QUEUE_STORAGE_KEY =
  (typeof window !== "undefined" && window.IMAGE_QUEUE_STORAGE_KEY) ||
  "hb-dossier-image-queue";

const TERMINAL_BOOT_LINES = [
  ">> SECURE INTERFACE ONLINE",
  ">> NETWORK LINK: STABLE",
  ">> ENCRYPTION KEYS VERIFIED",
  ">> BIOMETRIC SENSOR ARRAY ACTIVE",
  ">> ALIGN DEVICE FOR VERTICAL SCAN",
];

const TERMINAL_CHAR_DELAY = 18;
const TERMINAL_LINE_DELAY = 140;
const SCAN_PREP_DELAY = 260;
const SCAN_DURATION = 2600;
const POST_CONFIRM_DELAY = 1600;

const INTRO_CONFIRM_TIME = Math.round(
  calculateTerminalBootDuration(
    TERMINAL_BOOT_LINES,
    TERMINAL_CHAR_DELAY,
    TERMINAL_LINE_DELAY
  ) +
    SCAN_PREP_DELAY +
    SCAN_DURATION
);
const INTRO_COMPLETE_TIME = INTRO_CONFIRM_TIME + POST_CONFIRM_DELAY;
const FUSE_DURATION = 45000;
const SELF_DESTRUCT_WARNING = 5000;
const POST_EXPLOSION_TRANSMISSION_DELAY = 3200;
const DEFAULT_TYPE_SPEED = 20;
const DEFAULT_FOCUS_HOLD = 900;

document.documentElement.style.setProperty(
  "--fuse-duration",
  `${FUSE_DURATION}ms`
);
document.documentElement.style.setProperty(
  "--scan-duration",
  `${SCAN_DURATION}ms`
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

    const focusHost = document.querySelector("[data-focus-image]");
    const focusImage = selections[0] || manifest.images[0];
    if (focusHost && typeof focusImage === "string" && focusImage.length > 0) {
      focusHost.dataset.focusImage = focusImage;
    }
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

function calculateTerminalBootDuration(lines, charDelay, lineDelay) {
  const safeCharDelay = Math.max(1, Number(charDelay) || 0);
  const safeLineDelay = Math.max(0, Number(lineDelay) || 0);

  return lines.reduce((total, line, index) => {
    const length = typeof line === "string" ? line.length : 0;
    const charTime = length * safeCharDelay;
    const pause = index < lines.length - 1 ? safeLineDelay : 0;
    return total + charTime + pause;
  }, 0);
}

async function playTerminalBootSequence(target, lines, options = {}) {
  if (!target || !lines || !lines.length) {
    return;
  }

  const charDelay = Math.max(6, Number(options.charDelay) || TERMINAL_CHAR_DELAY);
  const lineDelay = Math.max(40, Number(options.lineDelay) || TERMINAL_LINE_DELAY);

  target.textContent = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    await typeTerminalLine(target, line, charDelay);
    if (index < lines.length - 1) {
      await controlledDelay(lineDelay);
    }
  }
}

async function typeTerminalLine(target, line, charDelay) {
  const content = typeof line === "string" ? line : "";
  const step = Math.max(6, Math.floor(charDelay));

  for (const char of content) {
    await waitIfPaused();
    target.textContent += char;
    target.scrollTop = target.scrollHeight;
    await controlledDelay(step);
  }

  await waitIfPaused();
  target.textContent += "\n";
  target.scrollTop = target.scrollHeight;
}

function beginBiometricScan(introElement) {
  if (!introElement) {
    return;
  }

  introElement.classList.add("scanning");
}

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const intro = document.getElementById("intro");
  const introText = intro ? intro.querySelector(".intro-text") : null;
  const introSubtext = intro ? intro.querySelector(".intro-subtext") : null;
  const terminalLog = intro ? intro.querySelector(".terminal-log") : null;
  const selfDestructOverlay = document.getElementById("self-destruct");
  const countdownEl = selfDestructOverlay.querySelector(
    ".self-destruct-countdown"
  );
  const pauseButton = document.getElementById("debug-pause");
  const liveMessage = document.getElementById("live-message");
  const liveMessageBody = liveMessage.querySelector(".message-body");
  const focusStage = document.getElementById("focus-stage");
  const focusContent = focusStage.querySelector(".focus-content");
  const fuse = document.getElementById("fuse");
  const resetButton = document.getElementById("reset-timeline");
  const decryptionOverlay = document.getElementById("decryption-overlay");
  const decryptionStatus = document.getElementById("decryption-status");
  const decryptionLog = document.getElementById("decryption-log");
  const decryptionMessage = document.getElementById("decryption-message");
  const hasDecryptionSequence =
    typeof startDecryptionSequence === "function";

  assignRandomDossierImages();

  countdownState.display = countdownEl;

  if (introText) {
    introText.textContent = "Stabilizing subspace handshake...";
  }

  if (introSubtext) {
    introSubtext.textContent = "Routing through secure relays";
  }

  if (terminalLog) {
    playTerminalBootSequence(terminalLog, TERMINAL_BOOT_LINES, {
      charDelay: TERMINAL_CHAR_DELAY,
      lineDelay: TERMINAL_LINE_DELAY,
    })
      .then(async () => {
        if (introText) {
          introText.textContent = "Biometric scan engaged...";
        }
        if (introSubtext) {
          introSubtext.textContent = "Initiating redline sweep";
        }
        await controlledDelay(SCAN_PREP_DELAY);
        beginBiometricScan(intro);
        await controlledDelay(SCAN_DURATION);
        if (introSubtext) {
          introSubtext.textContent = "Awaiting confirmation signature";
        }
      })
      .catch(console.error);
  }

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

  scheduler.schedule(
    "introConfirm",
    () => {
      if (intro) {
        intro.classList.add("confirmed");
        intro.classList.remove("scanning");
      }
      if (introText) {
        introText.textContent = "Identity Confirmed";
      }
      if (introSubtext) {
        introSubtext.textContent = "Clearance matrix synchronized";
      }
    },
    INTRO_CONFIRM_TIME
  );

  let transmissionReady = false;
  let transmissionRequested = false;
  let transmissionDisplayed = false;

  const displayTransmission = () => {
    if (transmissionDisplayed || !liveMessage || !liveMessageBody) {
      return;
    }

    transmissionDisplayed = true;
    showTransmission(liveMessage, liveMessageBody).catch(console.error);
  };

  const requestTransmissionDisplay = () => {
    transmissionRequested = true;
    if (!transmissionReady) {
      return;
    }

    displayTransmission();
  };

  const markTransmissionReady = () => {
    transmissionReady = true;
    if (transmissionRequested && !transmissionDisplayed) {
      displayTransmission();
    }
  };

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
        focusContent,
        {
          onComplete: markTransmissionReady,
        }
      ).catch(console.error);
    },
    INTRO_COMPLETE_TIME
  );

  scheduler.schedule(
    "countdown",
    () => {
      startCountdown(selfDestructOverlay, countdownState, fuse);
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

  scheduler.schedule(
    "transmissionReveal",
    () => {
      requestTransmissionDisplay();
    },
    FUSE_DURATION + SELF_DESTRUCT_WARNING + POST_EXPLOSION_TRANSMISSION_DELAY
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
    item.classList.remove("active", "typing", "pinned");
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
  focusContent,
  options = {}
) {
  const { onComplete } = options;

  if (!items.length) {
    if (typeof onComplete === "function") {
      onComplete();
    }
    return;
  }

  const [primary, ...rest] = items;
  await waitIfPaused();

  const type = primary.dataset.streamType || "text";
  const focusMode = primary.dataset.focusMode || "";
  const focusLabel = resolveFocusLabel(primary);
  const focusHold = Number(primary.dataset.focusHold || 0);

  let cascadePromise = Promise.resolve();

  if (type === "text") {
    const baseSpeed = Number(primary.dataset.streamSpeed) || DEFAULT_TYPE_SPEED;
    const textContent = primary.dataset.streamText || "";
    const focusSpeed = Number(primary.dataset.focusSpeed || 0);

    if (focusMode) {
      await engageFocus(primary, focusStage, focusContent, {
        type,
        mode: focusMode,
        label: focusLabel,
        speed: focusSpeed || accelerateSpeed(baseSpeed, 0.72),
        text: textContent,
        hold: focusHold || DEFAULT_FOCUS_HOLD,
        image: primary.dataset.focusImage,
      });
    }

    const typingPromise = typeText(
      primary,
      textContent,
      accelerateSpeed(baseSpeed, 0.78)
    );
    primary.classList.add("pinned");

    if (rest.length) {
      cascadePromise = startCascade(rest, focusStage, focusContent, {
        initialDelay: 850,
      });
    }

    await Promise.all([typingPromise, cascadePromise]);
    await controlledDelay(160);
  } else if (type === "media") {
    if (focusMode) {
      await engageFocus(primary, focusStage, focusContent, {
        type,
        mode: focusMode,
        label: focusLabel,
        hold: focusHold || 800,
      });
    }

    primary.classList.add("active");

    if (rest.length) {
      cascadePromise = startCascade(rest, focusStage, focusContent, {
        initialDelay: 420,
      });
      await cascadePromise;
    }
  } else {
    await engageFocus(primary, focusStage, focusContent, {
      type: "module",
      mode: focusMode || "module",
      label: focusLabel,
      hold: focusHold || 900,
    });

    primary.classList.add("active");

    if (rest.length) {
      cascadePromise = startCascade(rest, focusStage, focusContent, {
        initialDelay: 520,
      });
      await cascadePromise;
    }
  }

  await controlledDelay(260);

  if (typeof onComplete === "function") {
    onComplete();
  }
}

async function showTransmission(container, messageBody) {
  container.classList.add("visible");
  await controlledDelay(220);
  await typeText(messageBody, messageBody.dataset.streamText || "", 20);
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

function accelerateSpeed(base, factor = 0.65) {
  const source = Number(base) || DEFAULT_TYPE_SPEED;
  const value = Math.floor(source * factor);
  return Math.max(8, value);
}

async function startCascade(
  items,
  focusStage,
  focusContent,
  options = {}
) {
  if (!items.length) {
    return;
  }

  const initialDelay = options.initialDelay ?? 600;
  const betweenDelay = options.betweenDelay ?? 620;
  const speedFactor = options.speedFactor ?? 0.68;

  await controlledDelay(initialDelay);

  for (const item of items) {
    await waitIfPaused();
    const type = item.dataset.streamType || "text";
    const focusMode = item.dataset.focusMode || "";
    const focusLabel = resolveFocusLabel(item);
    const focusHold = Number(item.dataset.focusHold || 0);

    if (type === "text") {
      const baseSpeed = Number(item.dataset.streamSpeed) || DEFAULT_TYPE_SPEED;
      const textContent = item.dataset.streamText || "";
      const focusSpeed = Number(item.dataset.focusSpeed || 0);

      if (focusMode) {
        await engageFocus(item, focusStage, focusContent, {
          type,
          mode: focusMode,
          label: focusLabel,
          speed: focusSpeed || accelerateSpeed(baseSpeed, speedFactor * 0.92),
          text: textContent,
          hold: focusHold || DEFAULT_FOCUS_HOLD,
          image: item.dataset.focusImage,
        });
      }

      await typeText(item, textContent, accelerateSpeed(baseSpeed, speedFactor));
      item.classList.add("pinned");
      await controlledDelay(180);
      await controlledDelay(betweenDelay);
      continue;
    }

    if (type === "media") {
      if (focusMode) {
        await engageFocus(item, focusStage, focusContent, {
          type,
          mode: focusMode,
          label: focusLabel,
          hold: focusHold || 680,
        });
      }

      item.classList.add("active");
      await controlledDelay(200);
      await controlledDelay(betweenDelay);
      continue;
    }

    await engageFocus(item, focusStage, focusContent, {
      type: "module",
      mode: focusMode || "module",
      label: focusLabel,
      hold: focusHold || 820,
    });

    item.classList.add("active");
    await controlledDelay(260);
    await controlledDelay(betweenDelay);
  }
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
    image: config.image,
  });
  const holdDuration = config.hold || DEFAULT_FOCUS_HOLD;
  const typeSpeed = config.speed || DEFAULT_TYPE_SPEED;

  stage.classList.remove("retreating", "engaged");
  stage.dataset.mode = mode;
  stage.setAttribute("aria-hidden", "false");
  stage.classList.add("visible");

  content.innerHTML = "";
  content.appendChild(container);

  await controlledDelay(45);
  stage.classList.add("engaged");

  if (config.type === "text") {
    await typeText(target, config.text || "", typeSpeed);
    await controlledDelay(170);
  } else {
    await controlledDelay(holdDuration);
  }

  stage.classList.add("retreating");
  await controlledDelay(240);

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
  if (config.type) {
    wrapper.classList.add(`focus-${config.type}`);
  }
  labelEl.classList.add("focus-label");
  labelEl.textContent = config.label;
  body.classList.add("focus-body");

  wrapper.appendChild(labelEl);
  wrapper.appendChild(body);

  if (config.type === "text") {
    if (config.image) {
      wrapper.classList.add("has-image");
      const figure = document.createElement("figure");
      figure.classList.add("focus-photo");
      const image = document.createElement("img");
      image.src = config.image;
      image.alt = `${config.label} visual reference`;
      image.loading = "lazy";
      figure.appendChild(image);

      const textual = document.createElement("div");
      textual.classList.add("focus-textual");

      body.appendChild(figure);
      body.appendChild(textual);
      return { container: wrapper, target: textual };
    }

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
  const step = Math.max(6, Number(speed) || DEFAULT_TYPE_SPEED);
  const newlineDelay = Math.max(8, Math.floor(step * 1.12));

  for (const char of text) {
    await waitIfPaused();

    if (char === "\n") {
      currentNode = document.createTextNode("");
      element.appendChild(document.createElement("br"));
      element.appendChild(currentNode);
      await controlledDelay(newlineDelay);
      continue;
    }

    currentNode.data += char;
    await controlledDelay(step);
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

function startCountdown(overlay, state = countdownState, fuseEl) {
  if (fuseEl) {
    fuseEl.classList.add("ignited");
  }

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
  const introSubtext = intro ? intro.querySelector(".intro-subtext") : null;
  const terminalLog = intro ? intro.querySelector(".terminal-log") : null;
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
    doc.documentElement.style.setProperty("--scan-duration", `${SCAN_DURATION}ms`);
  };

  const confirmIntro = () => {
    if (intro) {
      intro.classList.add("confirmed");
      intro.classList.remove("scanning");
    }
    if (introText) {
      introText.textContent = "Identity Confirmed";
    }
    if (introSubtext) {
      introSubtext.textContent = "Clearance matrix synchronized";
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
      intro.classList.remove("intro-complete", "confirmed", "scanning");
    }
    if (doc.body) {
      doc.body.classList.remove("show-dossier", "explode", "paused");
    }
    if (fuse) {
      fuse.classList.remove("ignited");
    }
    if (introText) {
      introText.textContent = "Stabilizing subspace handshake...";
    }
    if (introSubtext) {
      introSubtext.textContent = "Routing through secure relays";
    }
    if (terminalLog) {
      terminalLog.textContent = "";
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
  POST_EXPLOSION_TRANSMISSION_DELAY,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createController,
    createScheduler,
    constants: exportedConstants,
  };
}
