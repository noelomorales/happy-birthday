const INTRO_CONFIRM = 4000;
const INTRO_COMPLETE = 6500;
const FUSE_DURATION = 25000;
const WARNING_DURATION = 5000;

document.documentElement.style.setProperty(
  "--fuse-duration",
  `${FUSE_DURATION}ms`
);

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const boot = document.getElementById("boot-sequence");
  const initText = boot.querySelector('[data-state="init"]');
  const confirmText = boot.querySelector('[data-state="confirm"]');
  const fuseProgress = document.querySelector(".fuse__progress");
  const fuseSpark = document.querySelector(".fuse__spark");
  const fuseTime = document.querySelector("[data-time]");
  const warning = document.getElementById("warning");
  const warningCount = warning.querySelector("[data-count]");
  const detonation = document.getElementById("detonation");

  let fuseStartTimestamp = null;

  initText.classList.add("active");

  setTimeout(() => {
    initText.classList.remove("active");
    confirmText.classList.add("active");
  }, INTRO_CONFIRM);

  setTimeout(() => {
    boot.classList.add("inactive");
    body.classList.add("ready");
    startFuseCountdown();
  }, INTRO_COMPLETE);

  function animateFuse(timestamp) {
    if (!fuseStartTimestamp) fuseStartTimestamp = timestamp;
    const elapsed = Math.min(timestamp - fuseStartTimestamp, FUSE_DURATION);
    const ratio = Math.max(1 - elapsed / FUSE_DURATION, 0);

    fuseProgress.style.transform = `scaleX(${ratio})`;
    fuseSpark.style.left = `${ratio * 100}%`;

    const secondsRemaining = Math.ceil((FUSE_DURATION - elapsed) / 1000);
    fuseTime.textContent = Math.max(secondsRemaining, 0);

    if (elapsed < FUSE_DURATION) {
      requestAnimationFrame(animateFuse);
    } else {
      fuseSpark.style.left = "0%";
      fuseTime.textContent = "0";
    }
  }

  function startFuseCountdown() {
    fuseStartTimestamp = null;
    requestAnimationFrame(animateFuse);
    setTimeout(triggerWarning, FUSE_DURATION);
    setTimeout(triggerExplosion, FUSE_DURATION + WARNING_DURATION);
  }

  function triggerWarning() {
    warning.classList.add("active");
    let remaining = WARNING_DURATION / 1000;
    warningCount.textContent = remaining;

    const countdownTimer = setInterval(() => {
      remaining -= 1;
      warningCount.textContent = Math.max(remaining, 0);
      if (remaining <= 0) {
        clearInterval(countdownTimer);
      }
    }, 1000);
  }

  function triggerExplosion() {
    body.classList.add("engulfed");
    detonation.classList.add("active");
    setTimeout(() => {
      warning.classList.remove("active");
    }, 300);
  }
});
