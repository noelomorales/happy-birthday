const INTRO_STATUS_UPDATE = 1800;
const INTRO_CONFIRM_TIME = 4000;
const INTRO_COMPLETE_TIME = 6200;
const FUSE_DURATION = 25000;
const SELF_DESTRUCT_WARNING = 5000;

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
      introSubtext.textContent = "Welcome back, Agent Phoenix.";
    }
  }, INTRO_CONFIRM_TIME);

  setTimeout(() => {
    intro.classList.add("intro-complete");
    body.classList.add("show-dossier");
  }, INTRO_COMPLETE_TIME);

  const countdownStart = () => {
    selfDestructOverlay.classList.add("visible");
    let remaining = SELF_DESTRUCT_WARNING / 1000;
    countdownEl.textContent = remaining;

    const tick = setInterval(() => {
      remaining -= 1;
      countdownEl.textContent = Math.max(remaining, 0);
      if (remaining <= 0) {
        clearInterval(tick);
      }
    }, 1000);
  };

  setTimeout(countdownStart, FUSE_DURATION);

  setTimeout(() => {
    body.classList.add("explode");
  }, FUSE_DURATION + SELF_DESTRUCT_WARNING);
});
