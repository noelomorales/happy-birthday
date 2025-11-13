const buildLocationElement = () => {
  const element = document.createElement("span");
  element.id = "current-location";
  element.dataset.locatingText = "Triangulating coordinates…";
  element.dataset.deniedText = "Permission denied. Unable to confirm location.";
  element.dataset.unavailableText = "Location unavailable. Awaiting manual input.";
  element.textContent = element.dataset.locatingText;
  document.body.appendChild(element);
  return element;
};

describe("initializeGeolocation", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("handles unsupported geolocation", async () => {
    const {
      initializeGeolocation,
      locationMessages,
      locationState,
    } = require("../script.js");

    const element = buildLocationElement();

    const controller = initializeGeolocation({
      element,
      geolocation: null,
    });

    const result = await controller.ready;

    expect(result.state).toBe(locationState.unavailable);
    expect(element.dataset.state).toBe(locationState.unavailable);
    expect(element.textContent).toBe(locationMessages.unavailable);
  });

  test("sets denied state when permission is rejected", async () => {
    const {
      initializeGeolocation,
      locationMessages,
      locationState,
    } = require("../script.js");

    const element = buildLocationElement();

    const geolocation = {
      getCurrentPosition: (_success, error) => {
        error({ code: 1, message: "User denied Geolocation" });
      },
    };

    const controller = initializeGeolocation({ element, geolocation });
    const result = await controller.ready;

    expect(result.state).toBe(locationState.denied);
    expect(element.dataset.state).toBe(locationState.denied);
    expect(element.textContent).toBe(locationMessages.denied);
  });

  test("uses reverse geocode label when provided", async () => {
    const {
      initializeGeolocation,
      locationState,
    } = require("../script.js");

    const element = buildLocationElement();
    const reverseGeocode = jest
      .fn()
      .mockResolvedValue("San Francisco, CA, USA");

    const geolocation = {
      getCurrentPosition: (success) => {
        success({
          coords: { latitude: 37.7749, longitude: -122.4194 },
        });
      },
    };

    const controller = initializeGeolocation({
      element,
      geolocation,
      reverseGeocode,
    });

    const result = await controller.ready;

    expect(reverseGeocode).toHaveBeenCalledWith({
      latitude: 37.7749,
      longitude: -122.4194,
    });
    expect(result.state).toBe(locationState.resolved);
    expect(element.dataset.state).toBe(locationState.resolved);
    expect(element.textContent).toBe("San Francisco, CA, USA");
  });

  test("falls back to formatted coordinates on lookup failure", async () => {
    const {
      initializeGeolocation,
      formatCoordinates,
      locationState,
    } = require("../script.js");

    const element = buildLocationElement();
    const reverseGeocode = jest.fn().mockResolvedValue("");

    const geolocation = {
      getCurrentPosition: (success) => {
        success({
          coords: { latitude: 51.5007, longitude: -0.1246 },
        });
      },
    };

    const controller = initializeGeolocation({
      element,
      geolocation,
      reverseGeocode,
    });

    const result = await controller.ready;
    const expected = formatCoordinates(51.5007, -0.1246);

    expect(result.state).toBe(locationState.resolved);
    expect(element.dataset.state).toBe(locationState.resolved);
    expect(element.textContent).toBe(expected);
  });
});
