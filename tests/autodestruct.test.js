const renderDom = () => {
  document.body.innerHTML = `
    <div id="intro" class="active">
      <div class="intro-text"></div>
      <div class="intro-status"></div>
      <div class="intro-subtext"></div>
    </div>
    <div id="self-destruct">
      <div class="self-destruct-panel">
        <span class="self-destruct-countdown">45</span>
      </div>
    </div>
    <main id="dossier"></main>
    <div id="fuse">
      <div class="fuse-track">
        <div class="fuse-progress"></div>
        <div class="spark"></div>
      </div>
    </div>
    <div class="control-hud">
      <button id="pause-toggle" type="button" class="hud-button">
        Pause Autodestruct
      </button>
    </div>
  `;
};

describe("Autodestruct timeline", () => {
  let Autodestruct;
  let controller;
  let constants;
  let performanceStub;

  const advance = (ms) => {
    jest.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
    jest.resetModules();
    renderDom();
    performanceStub = { now: () => Date.now() };
    Autodestruct = require("../script.js");
    constants = Autodestruct.constants;
    controller = Autodestruct.createController({
      document,
      performance: performanceStub,
      timers: {
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
      },
    });
    controller.start();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
    document.documentElement.style.cssText = "";
  });

  test("sets the fuse duration CSS variable", () => {
    const fuseVar = document.documentElement.style.getPropertyValue(
      "--fuse-duration"
    );
    expect(fuseVar.trim()).toBe(`${constants.FUSE_DURATION}ms`);
  });

  test("unlocks dossier view after intro completes", () => {
    const pauseButton = document.getElementById("pause-toggle");
    expect(pauseButton.disabled).toBe(true);

    advance(constants.INTRO_COMPLETE_TIME);

    expect(document.body.classList.contains("show-dossier")).toBe(true);
    expect(pauseButton.disabled).toBe(false);
    expect(pauseButton.classList.contains("active")).toBe(true);
  });

  test("runs countdown and explosion on schedule", () => {
    const overlay = document.getElementById("self-destruct");
    const countdown = overlay.querySelector(".self-destruct-countdown");
    const pauseButton = document.getElementById("pause-toggle");

    advance(constants.INTRO_COMPLETE_TIME + constants.FUSE_DURATION);

    expect(overlay.classList.contains("visible")).toBe(true);
    expect(countdown.textContent).toBe("45");

    advance(constants.SELF_DESTRUCT_WARNING);

    expect(document.body.classList.contains("explode")).toBe(true);
    expect(pauseButton.disabled).toBe(true);
    expect(pauseButton.textContent).toBe("Autodestruct Complete");
  });

  test("pause and resume hold the autodestruct timeline", () => {
    const overlay = document.getElementById("self-destruct");
    const pauseButton = document.getElementById("pause-toggle");

    advance(constants.INTRO_COMPLETE_TIME + 1000);
    controller.pauseTimeline();

    expect(controller.state.paused).toBe(true);
    expect(document.body.classList.contains("paused")).toBe(true);
    expect(pauseButton.textContent).toBe("Resume Autodestruct");
    expect(overlay.classList.contains("visible")).toBe(false);

    advance(constants.FUSE_DURATION + constants.SELF_DESTRUCT_WARNING);

    expect(overlay.classList.contains("visible")).toBe(false);
    expect(document.body.classList.contains("explode")).toBe(false);

    controller.resumeTimeline();

    advance(constants.FUSE_DURATION);
    expect(overlay.classList.contains("visible")).toBe(true);

    advance(constants.SELF_DESTRUCT_WARNING);
    expect(document.body.classList.contains("explode")).toBe(true);
  });
});
