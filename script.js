const IMAGE_MANIFEST_URL =
  (typeof window !== "undefined" && window.IMAGE_MANIFEST_URL) ||
  "assets/images/manifest.json";
const IMAGE_QUEUE_STORAGE_KEY =
  (typeof window !== "undefined" && window.IMAGE_QUEUE_STORAGE_KEY) ||
  "hb-dossier-image-queue";

const TERMINAL_BOOT_LINES = [
  ">> BLACKLETTER CONSOLE ENGAGED",
  ">> BACKCHANNEL CIRCUITS SEALED",
  ">> PHRASEBOOK AUTH CIPHERS VERIFIED",
  ">> BIOMETRIC VEINSCAN LOCK CONFIRMED",
  ">> HOLD STEADY FOR IDENTITY SWEEP",
];

const TERMINAL_CHAR_DELAY = 12;
const TERMINAL_LINE_DELAY = 90;
const SCAN_PREP_DELAY = 160;
const SCAN_DURATION = 1600;
const POST_CONFIRM_DELAY = 900;

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
const DEFAULT_TYPE_SPEED = 14;
const DEFAULT_FOCUS_HOLD = 650;
const ADDRESS_COPY_TEXT = "3141 Mission St.\nBox 113\nSan Francisco, CA 94110";
const MAP_LOCATION_URL =
  (typeof window !== "undefined" && window.MAP_LOCATION_URL) ||
  "https://maps.google.com/?q=3141+Mission+St,+San+Francisco,+CA+94110";

const LOCATION_STATE = Object.freeze({
  locating: "locating",
  denied: "denied",
  unavailable: "unavailable",
  resolved: "resolved",
  cancelled: "cancelled",
});

const DEFAULT_LOCATION_MESSAGES = Object.freeze({
  locating: "Triangulating coordinates…",
  denied: "Permission denied. Unable to confirm location.",
  unavailable: "Location unavailable. Awaiting manual input.",
});

const DEFAULT_POSITION_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 300000,
});

function formatCoordinate(value, positiveSuffix, negativeSuffix) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const suffix = numeric >= 0 ? positiveSuffix : negativeSuffix;
  const magnitude = Math.abs(numeric).toFixed(3);
  return `${magnitude}° ${suffix}`;
}

function formatCoordinates(latitude, longitude) {
  const latPart = formatCoordinate(latitude, "N", "S");
  const lonPart = formatCoordinate(longitude, "E", "W");

  if (!latPart || !lonPart) {
    return "";
  }

  return `${latPart}, ${lonPart}`;
}

function resolveDatasetMessage(element, key, fallback) {
  if (!element || !element.dataset) {
    return fallback;
  }

  const datasetKey = `${key}Text`;
  const value = element.dataset[datasetKey];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return fallback;
}

function shouldTreatAsDenied(error) {
  if (!error) {
    return false;
  }

  const code = error.code;
  const deniedCode =
    typeof error.PERMISSION_DENIED === "number"
      ? error.PERMISSION_DENIED
      : 1;

  if (code === deniedCode || code === String(deniedCode)) {
    return true;
  }

  if (typeof error.message === "string") {
    return /denied/i.test(error.message);
  }

  return false;
}

async function resolvePositionLabel(coords, reverseGeocode, fallbackMessage) {
  if (!coords) {
    return fallbackMessage;
  }

  const payload = {
    latitude: coords.latitude,
    longitude: coords.longitude,
  };

  if (typeof reverseGeocode === "function") {
    try {
      const label = await reverseGeocode(payload);
      if (typeof label === "string") {
        const trimmed = label.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    } catch (error) {
      console.warn("Reverse geocoding failed", error);
    }
  }

  const formatted = formatCoordinates(payload.latitude, payload.longitude);
  if (formatted && formatted.length > 0) {
    return formatted;
  }

  return fallbackMessage;
}

function initializeGeolocation(options = {}) {
  const doc =
    options.document || (typeof document !== "undefined" ? document : null);
  const element =
    options.element ||
    (doc && typeof doc.getElementById === "function"
      ? doc.getElementById("current-location")
      : null);

  const navigatorGeolocation =
    typeof navigator !== "undefined" ? navigator.geolocation : null;
  const geolocation =
    options.geolocation &&
    typeof options.geolocation.getCurrentPosition === "function"
      ? options.geolocation
      : navigatorGeolocation;

  let reverseGeocode =
    typeof options.reverseGeocode === "function"
      ? options.reverseGeocode
      : null;

  if (!reverseGeocode && typeof window !== "undefined") {
    const candidate = window.resolveAgentLocation;
    if (typeof candidate === "function") {
      reverseGeocode = candidate;
    }
  }

  if (!element) {
    return {
      ready: Promise.resolve({ state: LOCATION_STATE.unavailable, message: "" }),
      cancel() {},
    };
  }

  if (!element.hasAttribute("aria-live")) {
    element.setAttribute("aria-live", "polite");
  }

  const messages = {
    locating: resolveDatasetMessage(
      element,
      "locating",
      DEFAULT_LOCATION_MESSAGES.locating
    ),
    denied: resolveDatasetMessage(
      element,
      "denied",
      DEFAULT_LOCATION_MESSAGES.denied
    ),
    unavailable: resolveDatasetMessage(
      element,
      "unavailable",
      DEFAULT_LOCATION_MESSAGES.unavailable
    ),
  };

  const fallbackMessage = resolveDatasetMessage(
    element,
    "fallback",
    messages.unavailable
  );

  const ensureMessage = (state, message) => {
    if (typeof message === "string") {
      const trimmed = message.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    if (state === LOCATION_STATE.locating) {
      return messages.locating;
    }
    if (state === LOCATION_STATE.denied) {
      return messages.denied;
    }
    if (state === LOCATION_STATE.unavailable) {
      return messages.unavailable;
    }

    return fallbackMessage;
  };

  let readyResolver;
  let settled = false;
  let cancelled = false;

  const ready = new Promise((resolve) => {
    readyResolver = resolve;
  });

  const finalize = (payload) => {
    if (settled) {
      return;
    }
    settled = true;
    if (readyResolver) {
      readyResolver(payload);
    }
  };

  const applyState = (state, message) => {
    const finalMessage = ensureMessage(state, message);
    element.dataset.state = state;
    element.textContent = finalMessage;

    if (typeof options.onStateChange === "function") {
      options.onStateChange({ state, message: finalMessage });
    }

    return finalMessage;
  };

  applyState(LOCATION_STATE.locating, messages.locating);

  if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
    const message = applyState(LOCATION_STATE.unavailable, fallbackMessage);
    finalize({ state: LOCATION_STATE.unavailable, message });
    return {
      ready,
      cancel() {
        cancelled = true;
      },
    };
  }

  const handleSuccess = async (position) => {
    if (cancelled) {
      return;
    }

    const coords = position && position.coords ? position.coords : null;
    const label = await resolvePositionLabel(coords, reverseGeocode, fallbackMessage);
    const message = applyState(LOCATION_STATE.resolved, label);
    finalize({ state: LOCATION_STATE.resolved, message, coords });
  };

  const handleError = (error) => {
    if (cancelled) {
      return;
    }

    const denied = shouldTreatAsDenied(error);
    const state = denied ? LOCATION_STATE.denied : LOCATION_STATE.unavailable;
    const message = applyState(
      state,
      denied ? messages.denied : fallbackMessage
    );
    finalize({ state, message, error });
  };

  const positionOptions = {
    ...DEFAULT_POSITION_OPTIONS,
    ...(options.positionOptions || {}),
  };

  try {
    geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      positionOptions
    );
  } catch (error) {
    console.error("Geolocation request failed", error);
    handleError(error);
  }

  return {
    ready,
    cancel() {
      if (!cancelled) {
        cancelled = true;
        finalize({
          state: LOCATION_STATE.cancelled,
          message: element.textContent.trim(),
        });
      }
    },
  };
}

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

    const selections = await selectImagesFromManifest(
      manifest,
      imageTargets.length
    );
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

async function selectImagesFromManifest(manifest, count) {
  if (!manifest.images.length || count <= 0) {
    return [];
  }

  const storage = getLocalStorage();
  const orderedImages = await orderImagesByFreshness(manifest.images);
  const storedQueue = readStoredQueue(storage, manifest.version, orderedImages);
  const workingQueue = storedQueue.length
    ? [...storedQueue]
    : orderedImages.slice();
  const selections = [];

  while (selections.length < count && orderedImages.length) {
    if (!workingQueue.length) {
      workingQueue.push(...orderedImages);
    }

    const next = workingQueue.shift();
    if (typeof next === "string" && next.length > 0) {
      selections.push(next);
    }
  }

  persistQueue(storage, workingQueue, manifest.version);

  return selections;
}

async function orderImagesByFreshness(images) {
  const uniqueImages = Array.isArray(images) ? Array.from(new Set(images)) : [];
  if (!uniqueImages.length) {
    return [];
  }

  const freshnessData = await Promise.all(
    uniqueImages.map((src, index) => resolveImageFreshness(src, index))
  );

  freshnessData.sort((a, b) => {
    if (b.lastModified !== a.lastModified) {
      return b.lastModified - a.lastModified;
    }
    return b.index - a.index;
  });

  return freshnessData.map((entry) => entry.src);
}

async function resolveImageFreshness(src, index) {
  const baseTimestamp = Number.isFinite(index) ? index : 0;

  try {
    const response = await fetch(src, {
      method: "HEAD",
      cache: "no-store",
    });

    if (response.ok) {
      const header = response.headers.get("last-modified");
      const parsed = header ? Date.parse(header) : NaN;
      if (Number.isFinite(parsed)) {
        return { src, index, lastModified: parsed }; // prefer server timestamp
      }
    }
  } catch (error) {
    // Ignore network issues and fall back to manifest order heuristics.
  }

  // Fall back to treating later entries as fresher if timestamps are unavailable.
  return { src, index, lastModified: baseTimestamp };
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
  const currentLocationElement = document.getElementById("current-location");
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
  const copyAddressButton = document.getElementById("copy-address");
  const copyMapLinkButton = document.getElementById("copy-map-link");
  const previewOverlay = document.getElementById("image-preview");
  const previewFrame = previewOverlay
    ? previewOverlay.querySelector(".preview-frame")
    : null;
  const previewImage = previewOverlay ? previewOverlay.querySelector("img") : null;
  const previewCaption = previewOverlay
    ? previewOverlay.querySelector(".preview-caption")
    : null;

  if (previewFrame && !previewFrame.hasAttribute("tabindex")) {
    previewFrame.setAttribute("tabindex", "-1");
  }

  const previewManager = initializeImagePreview({
    overlay: previewOverlay,
    frame: previewFrame,
    image: previewImage,
    caption: previewCaption,
    body,
  });

  const previewTargets = Array.from(document.querySelectorAll("main img"));
  previewTargets.forEach((img) => {
    if (img.closest("#image-preview")) {
      return;
    }
    previewManager.register(img);
  });

  if (copyAddressButton) {
    copyAddressButton.dataset.defaultLabel = copyAddressButton.textContent
      .trim()
      .replace(/\s+/g, " ");
    copyAddressButton.addEventListener("click", () => {
      handleCopyAction(copyAddressButton, ADDRESS_COPY_TEXT);
    });
  }

  if (copyMapLinkButton) {
    const mapUrl =
      copyMapLinkButton.dataset.mapUrl?.trim() || MAP_LOCATION_URL || "";
    copyMapLinkButton.dataset.defaultLabel = copyMapLinkButton.textContent
      .trim()
      .replace(/\s+/g, " ");
    copyMapLinkButton.addEventListener("click", () => {
      handleCopyAction(copyMapLinkButton, mapUrl);
    });
  }

  assignRandomDossierImages();

  if (currentLocationElement) {
    initializeGeolocation({ element: currentLocationElement });
  }

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

  let transmissionDisplayed = false;

  const displayTransmission = () => {
    if (transmissionDisplayed || !liveMessage || !liveMessageBody) {
      return;
    }

    transmissionDisplayed = true;
    showTransmission(liveMessage, liveMessageBody).catch(console.error);
  };

  const markTransmissionReady = () => {
    if (!transmissionDisplayed) {
      displayTransmission();
    }
  };

  const recoverFromExplosion = () => {
    if (body) {
      body.classList.add("explosion-recovery");

      if (
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
      ) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            body.classList.remove("explode");
          });
        });
      } else {
        body.classList.remove("explode");
      }
    }

    if (selfDestructOverlay) {
      selfDestructOverlay.classList.remove("visible");
    }

    if (fuse) {
      fuse.classList.remove("ignited");
    }

    scheduler.schedule(
      "recoverCleanup",
      () => {
        if (body) {
          body.classList.remove("explosion-recovery");
        }
      },
      900
    );
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
    "recover",
    () => {
      recoverFromExplosion();
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

function initializeImagePreview(elements = {}) {
  const overlay = elements.overlay;
  const imageEl = elements.image;
  const captionEl = elements.caption;
  const frame = elements.frame || null;
  const body = elements.body || document.body;

  if (!overlay || !imageEl || !captionEl) {
    return {
      register(target) {
        if (target) {
          target.dataset.previewEnabled = "false";
        }
      },
    };
  }

  let active = false;
  let previousFocus = null;
  let keydownBound = false;

  const closePreview = () => {
    if (!active) {
      return;
    }

    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    imageEl.removeAttribute("src");
    imageEl.removeAttribute("alt");
    captionEl.textContent = "";
    captionEl.removeAttribute("hidden");
    body.classList.remove("preview-open");

    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }

    previousFocus = null;
    active = false;

    if (keydownBound) {
      document.removeEventListener("keydown", handleKeydown);
      keydownBound = false;
    }
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      closePreview();
    }
  };

  const openPreview = (target) => {
    if (!target) {
      return;
    }

    const source = target.currentSrc || target.src || target.dataset.src;
    if (!source) {
      return;
    }

    const label = resolveImagePreviewCaption(target);
    imageEl.src = source;
    const altText = target.getAttribute("alt") || label || "Image preview";
    imageEl.alt = altText;
    captionEl.textContent = label;
    if (label) {
      captionEl.removeAttribute("hidden");
    } else {
      captionEl.setAttribute("hidden", "true");
    }

    previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    body.classList.add("preview-open");

    if (frame && typeof frame.focus === "function") {
      frame.focus({ preventScroll: true });
    }

    if (!keydownBound) {
      document.addEventListener("keydown", handleKeydown);
      keydownBound = true;
    }

    active = true;
  };

  overlay.addEventListener("click", (event) => {
    if (
      event.target === overlay ||
      (event.target && event.target.hasAttribute("data-preview-close"))
    ) {
      closePreview();
    }
  });

  return {
    register(target) {
      if (!target || target.dataset.previewEnabled === "true") {
        return;
      }

      target.dataset.previewEnabled = "true";
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "0");
      }
      if (!target.hasAttribute("role")) {
        target.setAttribute("role", "button");
      }
      target.setAttribute("aria-haspopup", "dialog");

      target.addEventListener("click", (event) => {
        event.preventDefault();
        openPreview(target);
      });

      target.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPreview(target);
        }
      });
    },
    close: closePreview,
  };
}

async function handleCopyAction(button, text) {
  if (!button || !text) {
    return;
  }

  const defaultLabel = button.dataset.defaultLabel || button.textContent.trim();
  button.disabled = true;

  try {
    const success = await copyTextToClipboard(text);
    if (success) {
      button.classList.remove("copy-error");
      button.classList.add("copied");
      button.textContent = "Copied!";
    } else {
      button.classList.remove("copied");
      button.classList.add("copy-error");
      button.textContent = "Copy Unavailable";
    }
  } catch (error) {
    console.error("Unable to copy text", error);
    button.classList.remove("copied");
    button.classList.add("copy-error");
    button.textContent = "Copy Failed";
  }

  setTimeout(() => {
    button.classList.remove("copied", "copy-error");
    button.textContent = defaultLabel;
    button.disabled = false;
  }, 2200);
}

async function copyTextToClipboard(text) {
  if (!text) {
    return false;
  }

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn("Clipboard API unavailable", error);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (error) {
    console.error("Fallback clipboard copy failed", error);
    success = false;
  }

  document.body.removeChild(textarea);
  return success;
}

function resolveImagePreviewCaption(image) {
  if (!image) {
    return "";
  }

  const figure = image.closest("figure");
  if (figure) {
    const datasetLabel = figure.dataset.label;
    if (datasetLabel) {
      return datasetLabel;
    }

    const ariaLabel = figure.getAttribute("aria-label");
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    const figcaption = figure.querySelector("figcaption");
    if (figcaption && figcaption.textContent) {
      return figcaption.textContent.trim();
    }
  }

  const altText = image.getAttribute("alt");
  if (altText) {
    return altText.trim();
  }

  const ariaLabel = image.getAttribute("aria-label");
  if (ariaLabel) {
    return ariaLabel.trim();
  }

  return "Image Preview";
}

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

  if (typeof document !== "undefined" && document.body) {
    document.body.classList.remove("final-transmission");
  }
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
        speed: focusSpeed || accelerateSpeed(baseSpeed, 0.5),
        text: textContent,
        hold: focusHold || DEFAULT_FOCUS_HOLD,
        image: primary.dataset.focusImage,
      });
    }

    const typingPromise = typeText(
      primary,
      textContent,
      accelerateSpeed(baseSpeed, 0.58)
    );
    primary.classList.add("pinned");

    if (rest.length) {
      cascadePromise = startCascade(rest, focusStage, focusContent, {
        initialDelay: 420,
        betweenDelay: 320,
        speedFactor: 0.58,
      });
    }

    await Promise.all([typingPromise, cascadePromise]);
    await controlledDelay(90);
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
        initialDelay: 260,
        betweenDelay: 260,
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
        initialDelay: 320,
        betweenDelay: 300,
      });
      await cascadePromise;
    }
  }

  await controlledDelay(140);

  if (typeof onComplete === "function") {
    onComplete();
  }
}

async function showTransmission(container, messageBody) {
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.add("final-transmission");
  }

  container.classList.add("visible");
  await controlledDelay(220);
  await typeText(messageBody, messageBody.dataset.streamText || "", 12);
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

function accelerateSpeed(base, factor = 0.52) {
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

  const initialDelay = options.initialDelay ?? 420;
  const betweenDelay = options.betweenDelay ?? 320;
  const speedFactor = options.speedFactor ?? 0.58;

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
          speed: focusSpeed || accelerateSpeed(baseSpeed, speedFactor * 0.85),
          text: textContent,
          hold: focusHold || DEFAULT_FOCUS_HOLD,
          image: item.dataset.focusImage,
        });
      }

      await typeText(item, textContent, accelerateSpeed(baseSpeed, speedFactor));
      item.classList.add("pinned");
      await controlledDelay(100);
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
      await controlledDelay(120);
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
    await controlledDelay(140);
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

  await controlledDelay(30);
  stage.classList.add("engaged");

  if (config.type === "text") {
    await typeText(target, config.text || "", typeSpeed);
    await controlledDelay(90);
  } else {
    await controlledDelay(holdDuration);
  }

  stage.classList.add("retreating");
  await controlledDelay(140);

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

  const recoverAfterExplosion = () => {
    if (doc.body) {
      doc.body.classList.add("explosion-recovery");
      doc.body.classList.remove("explode");
    }

    if (selfDestructOverlay) {
      selfDestructOverlay.classList.remove("visible");
    }

    if (fuse) {
      fuse.classList.remove("ignited");
    }

    schedulerInstance.schedule(
      "recoverCleanup",
      () => {
        if (doc.body) {
          doc.body.classList.remove("explosion-recovery");
        }
      },
      900
    );
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
    schedulerInstance.schedule(
      "recover",
      recoverAfterExplosion,
      FUSE_DURATION +
        SELF_DESTRUCT_WARNING +
        POST_EXPLOSION_TRANSMISSION_DELAY
    );
  };

  const resetView = () => {
    isPaused = false;
    if (intro) {
      intro.classList.remove("intro-complete", "confirmed", "scanning");
    }
    if (doc.body) {
      doc.body.classList.remove(
        "show-dossier",
        "explode",
        "paused",
        "final-transmission",
        "explosion-recovery"
      );
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
    initializeGeolocation,
    formatCoordinates,
    locationMessages: DEFAULT_LOCATION_MESSAGES,
    locationState: LOCATION_STATE,
  };
}
