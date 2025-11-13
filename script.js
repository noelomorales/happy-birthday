(function (globalScope) {
  const constants = {
    INTRO_STATUS_UPDATE: 1800,
    INTRO_CONFIRM_TIME: 4000,
    INTRO_COMPLETE_TIME: 6200,
    FUSE_DURATION: 25000,
    SELF_DESTRUCT_WARNING: 5000,
  };

  const getNow = (performanceLike) => {
    if (performanceLike && typeof performanceLike.now === "function") {
      return performanceLike.now();
    }
    return Date.now();
  };

  function createController({
    document: doc,
    performance: perf = globalScope.performance,
    timers = globalScope,
  } = {}) {
    if (!doc) {
      throw new Error("Autodestruct controller requires a document instance.");
    }

    const root = doc.documentElement;
    const body = doc.body;
    const intro = doc.getElementById("intro");
    const introText = intro?.querySelector(".intro-text");
    const introStatus = intro?.querySelector(".intro-status");
    const introSubtext = intro?.querySelector(".intro-subtext");
    const selfDestructOverlay = doc.getElementById("self-destruct");
    const countdownEl = selfDestructOverlay?.querySelector(
      ".self-destruct-countdown"
    );
    const pauseButton = doc.getElementById("pause-toggle");

    if (!body || !intro || !selfDestructOverlay || !countdownEl) {
      throw new Error("Autodestruct controller missing required DOM elements.");
    }

    if (root && root.style) {
      root.style.setProperty(
        "--fuse-duration",
        `${constants.FUSE_DURATION}ms`
      );
    }

    const setTimeoutFn =
      typeof timers.setTimeout === "function"
        ? timers.setTimeout.bind(timers)
        : globalScope.setTimeout.bind(globalScope);
    const clearTimeoutFn =
      typeof timers.clearTimeout === "function"
        ? timers.clearTimeout.bind(timers)
        : globalScope.clearTimeout.bind(globalScope);
    const setIntervalFn =
      typeof timers.setInterval === "function"
        ? timers.setInterval.bind(timers)
        : globalScope.setInterval.bind(globalScope);
    const clearIntervalFn =
      typeof timers.clearInterval === "function"
        ? timers.clearInterval.bind(timers)
        : globalScope.clearInterval.bind(globalScope);

    const state = {
      warningTimeRemaining: constants.FUSE_DURATION,
      explosionTimeRemaining:
        constants.FUSE_DURATION + constants.SELF_DESTRUCT_WARNING,
      countdownSecondsRemaining: constants.SELF_DESTRUCT_WARNING / 1000,
      countdownActive: false,
      paused: false,
      warningTimeoutId: null,
      explosionTimeoutId: null,
      countdownIntervalId: null,
      warningTargetTime: null,
      explosionTargetTime: null,
    };

    const nowProvider = () => getNow(perf);
    const introTimeouts = [];

    const setAnimationPaused = (isPaused) => {
      body.classList.toggle("paused", isPaused);
    };

    const clearIntroTimeouts = () => {
      while (introTimeouts.length) {
        const timeoutId = introTimeouts.pop();
        clearTimeoutFn(timeoutId);
      }
    };

    const clearTimers = () => {
      if (state.warningTimeoutId) {
        clearTimeoutFn(state.warningTimeoutId);
        state.warningTimeoutId = null;
      }
      if (state.explosionTimeoutId) {
        clearTimeoutFn(state.explosionTimeoutId);
        state.explosionTimeoutId = null;
      }
      if (state.countdownIntervalId) {
        clearIntervalFn(state.countdownIntervalId);
        state.countdownIntervalId = null;
      }
    };

    const resetState = () => {
      clearTimers();
      clearIntroTimeouts();
      state.warningTimeRemaining = constants.FUSE_DURATION;
      state.explosionTimeRemaining =
        constants.FUSE_DURATION + constants.SELF_DESTRUCT_WARNING;
      state.countdownSecondsRemaining =
        constants.SELF_DESTRUCT_WARNING / 1000;
      state.countdownActive = false;
      state.paused = false;
      state.warningTargetTime = null;
      state.explosionTargetTime = null;
      setAnimationPaused(false);
      body.classList.remove("show-dossier", "explode");
      if (pauseButton) {
        pauseButton.classList.remove("disabled", "active");
      }
      selfDestructOverlay.classList.remove("visible");
      countdownEl.textContent = `${state.countdownSecondsRemaining}`;
    };

    const updateCountdownDisplay = () => {
      if (!state.countdownActive) return;
      const now = nowProvider();
      const remainingMs = Math.max(
        (state.explosionTargetTime ?? now) - now,
        0
      );
      state.countdownSecondsRemaining = Math.max(
        Math.ceil(remainingMs / 1000),
        0
      );
      countdownEl.textContent = `${state.countdownSecondsRemaining}`;
    };

    const startCountdownTicker = () => {
      if (state.countdownIntervalId) {
        clearIntervalFn(state.countdownIntervalId);
      }
      updateCountdownDisplay();
      state.countdownIntervalId = setIntervalFn(() => {
        updateCountdownDisplay();
      }, 250);
    };

    const triggerExplosion = () => {
      clearTimers();
      state.explosionTimeRemaining = 0;
      state.explosionTargetTime = null;
      state.countdownActive = false;
      state.paused = false;
      body.classList.add("explode");
      setAnimationPaused(false);
      if (pauseButton) {
        pauseButton.disabled = true;
        pauseButton.classList.add("disabled");
        pauseButton.classList.remove("active");
        pauseButton.setAttribute("aria-pressed", "false");
        pauseButton.textContent = "Autodestruct Complete";
      }
    };

    const triggerCountdown = () => {
      state.countdownActive = true;
      state.warningTimeRemaining = 0;
      state.warningTargetTime = null;
      if (state.explosionTargetTime) {
        state.explosionTimeRemaining = Math.max(
          state.explosionTargetTime - nowProvider(),
          0
        );
      } else {
        state.explosionTimeRemaining = constants.SELF_DESTRUCT_WARNING;
      }
      selfDestructOverlay.classList.add("visible");
      updateCountdownDisplay();
      startCountdownTicker();
    };

    const scheduleTimeline = () => {
      const now = nowProvider();
      if (!state.countdownActive && state.warningTimeRemaining > 0) {
        state.warningTargetTime = now + state.warningTimeRemaining;
        state.warningTimeoutId = setTimeoutFn(
          () => {
            triggerCountdown();
          },
          state.warningTimeRemaining
        );
      }
      if (state.explosionTimeRemaining > 0) {
        state.explosionTargetTime = now + state.explosionTimeRemaining;
        state.explosionTimeoutId = setTimeoutFn(
          () => {
            triggerExplosion();
          },
          state.explosionTimeRemaining
        );
        if (state.countdownActive) {
          startCountdownTicker();
        }
      } else {
        triggerExplosion();
      }
    };

    const pauseTimeline = () => {
      if (state.paused) return;
      state.paused = true;
      setAnimationPaused(true);
      const now = nowProvider();
      if (state.warningTargetTime) {
        state.warningTimeRemaining = Math.max(
          state.warningTargetTime - now,
          0
        );
        state.warningTargetTime = null;
      }
      if (state.explosionTargetTime) {
        state.explosionTimeRemaining = Math.max(
          state.explosionTargetTime - now,
          0
        );
        state.explosionTargetTime = null;
      }
      clearTimers();
      updateCountdownDisplay();
      if (pauseButton) {
        pauseButton.setAttribute("aria-pressed", "true");
        pauseButton.textContent = "Resume Autodestruct";
        pauseButton.classList.remove("active");
      }
    };

    const resumeTimeline = () => {
      if (!state.paused) return;
      state.paused = false;
      setAnimationPaused(false);
      scheduleTimeline();
      if (pauseButton) {
        pauseButton.setAttribute("aria-pressed", "false");
        pauseButton.textContent = "Pause Autodestruct";
        pauseButton.classList.add("active");
      }
    };

    const toggleTimeline = () => {
      if (!pauseButton || pauseButton.disabled) return;
      if (state.paused) {
        resumeTimeline();
      } else {
        pauseTimeline();
      }
    };

    const startIntroSequence = () => {
      resetState();
      if (intro) {
        intro.classList.remove("scanning", "confirmed", "intro-complete");
        intro.classList.add("active");
      }
      if (introText) {
        introText.textContent = "Initializing systems...";
      }
      if (introStatus) {
        introStatus.textContent = "Optical handshake pending";
      }
      if (introSubtext) {
        introSubtext.textContent = "Stand by for biometric verification.";
      }
      if (pauseButton) {
        pauseButton.disabled = true;
        pauseButton.setAttribute("aria-pressed", "false");
        pauseButton.textContent = "Pause Autodestruct";
        pauseButton.classList.remove("active");
      }
      introTimeouts.push(
        setTimeoutFn(() => {
          intro.classList.add("scanning");
          if (introStatus) {
            introStatus.textContent = "Optic scan sweeping";
          }
          if (introSubtext) {
            introSubtext.textContent = "Calibrating biometric lattice";
          }
        }, constants.INTRO_STATUS_UPDATE)
      );
      introTimeouts.push(
        setTimeoutFn(() => {
          intro.classList.add("confirmed");
          if (introText) {
            introText.textContent = "Identity Confirmed";
          }
          if (introStatus) {
            introStatus.textContent = "Access Level: Omega Black";
          }
          if (introSubtext) {
            introSubtext.textContent = "Welcome back, Agent Benito.";
          }
        }, constants.INTRO_CONFIRM_TIME)
      );
      introTimeouts.push(
        setTimeoutFn(() => {
          intro.classList.add("intro-complete");
          body.classList.add("show-dossier");
          if (pauseButton) {
            pauseButton.disabled = false;
            pauseButton.classList.add("active");
          }
          scheduleTimeline();
        }, constants.INTRO_COMPLETE_TIME)
      );
    };

    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.setAttribute("aria-pressed", "false");
      pauseButton.classList.remove("active");
      pauseButton.addEventListener("click", () => {
        toggleTimeline();
      });
    }

    return {
      start: startIntroSequence,
      pauseTimeline,
      resumeTimeline,
      toggleTimeline,
      scheduleTimeline,
      updateCountdownDisplay,
      state,
      elements: {
        body,
        intro,
        selfDestructOverlay,
        countdownEl,
        pauseButton,
      },
    };
  }

  function init(options = {}) {
    const doc = options.document ?? globalScope.document;
    if (!doc) return null;
    const controller = createController({
      document: doc,
      performance: options.performance ?? globalScope.performance,
      timers: options.timers ?? globalScope,
    });
    controller.start();
    return controller;
  }

  const api = {
    constants,
    createController,
    init,
  };

  const isCommonJS = typeof module !== "undefined" && module.exports;

  if (isCommonJS) {
    module.exports = api;
  }

  if (globalScope && !globalScope.Autodestruct) {
    globalScope.Autodestruct = api;
  }

  if (!isCommonJS && globalScope.document) {
    const readyState = globalScope.document.readyState;
    if (readyState === "loading") {
      globalScope.document.addEventListener("DOMContentLoaded", () => {
        init();
      });
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
