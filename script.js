const INTRO_STATUS_UPDATE = 1800;
const INTRO_CONFIRM_TIME = 4000;
const INTRO_COMPLETE_TIME = 6200;
const FUSE_DURATION = 25000;
const SELF_DESTRUCT_WARNING = 5000;

const state = {
  warningTimeRemaining: FUSE_DURATION,
  explosionTimeRemaining: FUSE_DURATION + SELF_DESTRUCT_WARNING,
  countdownSecondsRemaining: SELF_DESTRUCT_WARNING / 1000,
  countdownActive: false,
  paused: false,
  warningTimeoutId: null,
  explosionTimeoutId: null,
  countdownIntervalId: null,
  warningTargetTime: null,
  explosionTargetTime: null,
};

document.documentElement.style.setProperty(
  "--fuse-duration",
  `${FUSE_DURATION}ms`
);

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const intro = document.getElementById("intro");
  const introText = intro.querySelector(".intro-text");
  const introStatus = intro.querySelector(".intro-status");
  const introSubtext = intro.querySelector(".intro-subtext");
  const selfDestructOverlay = document.getElementById("self-destruct");
  const countdownEl = selfDestructOverlay.querySelector(
    ".self-destruct-countdown"
  );
  const pauseButton = document.getElementById("pause-toggle");

  const setAnimationPaused = (isPaused) => {
    body.classList.toggle("paused", isPaused);
  };

  const clearTimers = () => {
    if (state.warningTimeoutId) {
      clearTimeout(state.warningTimeoutId);
      state.warningTimeoutId = null;
    }
    if (state.explosionTimeoutId) {
      clearTimeout(state.explosionTimeoutId);
      state.explosionTimeoutId = null;
    }
    if (state.countdownIntervalId) {
      clearInterval(state.countdownIntervalId);
      state.countdownIntervalId = null;
    }
  };

  const updateCountdownDisplay = () => {
    if (!state.countdownActive) return;
    const now = performance.now();
    const remainingMs = Math.max(
      (state.explosionTargetTime ?? now) - now,
      0
    );
    state.countdownSecondsRemaining = Math.max(
      Math.ceil(remainingMs / 1000),
      0
    );
    countdownEl.textContent = state.countdownSecondsRemaining;
  };

  const startCountdownTicker = () => {
    clearInterval(state.countdownIntervalId);
    updateCountdownDisplay();
    state.countdownIntervalId = setInterval(() => {
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
        state.explosionTargetTime - performance.now(),
        0
      );
    } else {
      state.explosionTimeRemaining = SELF_DESTRUCT_WARNING;
    }
    selfDestructOverlay.classList.add("visible");
    updateCountdownDisplay();
    startCountdownTicker();
  };

  const scheduleTimeline = () => {
    const now = performance.now();
    if (!state.countdownActive && state.warningTimeRemaining > 0) {
      state.warningTargetTime = now + state.warningTimeRemaining;
      state.warningTimeoutId = setTimeout(
        triggerCountdown,
        state.warningTimeRemaining
      );
    }
    if (state.explosionTimeRemaining > 0) {
      state.explosionTargetTime = now + state.explosionTimeRemaining;
      state.explosionTimeoutId = setTimeout(
        triggerExplosion,
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
    const now = performance.now();
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

  if (pauseButton) {
    pauseButton.disabled = true;
    pauseButton.addEventListener("click", toggleTimeline);
  }

  setTimeout(() => {
    intro.classList.add("scanning");
    if (introStatus) {
      introStatus.textContent = "Optic scan sweeping";
    }
    if (introSubtext) {
      introSubtext.textContent = "Calibrating biometric lattice";
    }
  }, INTRO_STATUS_UPDATE);

  setTimeout(() => {
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
  }, INTRO_CONFIRM_TIME);

  setTimeout(() => {
    intro.classList.add("intro-complete");
    body.classList.add("show-dossier");
    if (pauseButton) {
      pauseButton.disabled = false;
      pauseButton.classList.add("active");
    }
    scheduleTimeline();
  }, INTRO_COMPLETE_TIME);
});
