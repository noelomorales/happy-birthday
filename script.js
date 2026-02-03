const STORAGE_KEY = "commute-tracker-history";
const ACTIVE_TRIP_KEY = "commute-tracker-active";
const MODE_KEY = "commute-tracker-mode";
const MODES = Object.freeze({
  live: "live",
  test: "test",
});

const ROUTES = [
  {
    code: "VM0730",
    label: "VM 07:30",
    badge: { text: "MA", color: "#1d4ed8" },
    expectedPickup: "07:59",
    expectedArrival: "09:02",
  },
  {
    code: "VM0745",
    label: "VM 07:45",
    badge: { text: "WF", color: "#111827" },
    expectedPickup: "08:18",
    expectedArrival: "09:20",
  },
  {
    code: "VM0828",
    label: "VM 08:28",
    badge: { text: "AP", color: "#16a34a" },
    expectedPickup: "09:00",
    expectedArrival: "10:02",
  },
  {
    code: "ME0915",
    label: "ME 09:15",
    badge: { text: "MA", color: "#0f766e" },
    expectedPickup: "09:28",
    expectedArrival: "10:25",
  },
  {
    code: "DC0735",
    label: "DC 07:35",
    badge: { text: "SU", color: "#b91c1c" },
    expectedPickup: "07:56",
    expectedArrival: "09:20",
  },
];

const SCHEDULES = {
  Tuesday: [
    {
      stop: "Lombard at Scott AM",
      time: "05:42",
      route: "VM0542",
      badge: { text: "MA", color: "#1d4ed8" },
    },
    {
      stop: "Gough at Geary",
      time: "05:49",
      route: "VM0542",
      badge: { text: "MA", color: "#1d4ed8" },
    },
    {
      stop: "S Van Ness at Mission",
      time: "05:55",
      route: "VM0542",
      badge: { text: "MA", color: "#1d4ed8" },
    },
    {
      stop: "Valencia at 25th",
      time: "06:06",
      route: "VM0542",
      badge: { text: "MA", color: "#1d4ed8" },
    },
    {
      stop: "San Jose at Valley",
      time: "06:08",
      route: "VM0542",
      badge: { text: "MA", color: "#1d4ed8" },
    },
    {
      stop: "Mariani Transit Center",
      time: "06:57",
      route: "VM0542",
      badge: { text: "MA", color: "#1d4ed8" },
    },
    {
      stop: "Apple Park Bay 6",
      time: "07:07",
      route: "VM0542",
      badge: { text: "MA", color: "#1d4ed8" },
    },
  ],
  Wednesday: [
    {
      stop: "Lombard at Scott AM",
      time: "07:38",
      route: "VE0738",
      badge: { text: "CU", color: "#7c3aed" },
    },
    {
      stop: "Lombard at Franklin",
      time: "07:43",
      route: "VE0738",
      badge: { text: "CU", color: "#7c3aed" },
    },
    {
      stop: "Gough at Geary",
      time: "07:50",
      route: "VE0738",
      badge: { text: "CU", color: "#7c3aed" },
    },
    {
      stop: "S Van Ness at Mission",
      time: "08:00",
      route: "VE0738",
      badge: { text: "CU", color: "#7c3aed" },
    },
    {
      stop: "Valencia at 25th",
      time: "08:18",
      route: "VE0738",
      badge: { text: "CU", color: "#7c3aed" },
    },
    {
      stop: "San Jose at Valley",
      time: "08:21",
      route: "VE0738",
      badge: { text: "CU", color: "#7c3aed" },
    },
    {
      stop: "Apple Park Bay 6",
      time: "09:15",
      route: "VE0738",
      badge: { text: "CU", color: "#7c3aed" },
    },
  ],
  Thursday: [
    {
      stop: "Lombard at Scott AM",
      time: "07:55",
      route: "ME0755",
      badge: { text: "SU", color: "#b45309" },
    },
    {
      stop: "Lombard at Franklin",
      time: "08:02",
      route: "ME0755",
      badge: { text: "SU", color: "#b45309" },
    },
    {
      stop: "Gough at Geary",
      time: "08:12",
      route: "ME0755",
      badge: { text: "SU", color: "#b45309" },
    },
    {
      stop: "S Van Ness at Mission",
      time: "08:22",
      route: "ME0755",
      badge: { text: "SU", color: "#b45309" },
    },
    {
      stop: "Valencia at 25th",
      time: "08:37",
      route: "ME0755",
      badge: { text: "SU", color: "#b45309" },
    },
    {
      stop: "Mariani Transit Center",
      time: "09:27",
      route: "ME0755",
      badge: { text: "SU", color: "#b45309" },
    },
    {
      stop: "Apple Park Bay 6",
      time: "09:37",
      route: "ME0755",
      badge: { text: "SU", color: "#b45309" },
    },
  ],
};

const scheduleContent = document.getElementById("schedule-content");
const scheduleTemplate = document.getElementById("schedule-template");
const routeSelect = document.getElementById("route-select");
const expectedPickupEl = document.getElementById("expected-pickup");
const expectedArrivalEl = document.getElementById("expected-arrival");
const pickupNowBtn = document.getElementById("pickup-now");
const arrivalNowBtn = document.getElementById("arrival-now");
const arrivalReminder = document.getElementById("arrival-reminder");
const arrivalCapture = document.getElementById("arrival-capture");
const arrivalYesBtn = document.getElementById("arrival-yes");
const arrivalNoBtn = document.getElementById("arrival-no");
const arrivalCaptureBtn = document.getElementById("arrival-capture-now");
const pickupDeltaEl = document.getElementById("pickup-delta");
const arrivalDeltaEl = document.getElementById("arrival-delta");
const pickupTimeEl = document.getElementById("pickup-time");
const arrivalTimeEl = document.getElementById("arrival-time");
const reminderStatus = document.getElementById("reminder-status");
const modeToggle = document.getElementById("mode-toggle");
const modeLabel = document.getElementById("mode-label");
const modeBanner = document.getElementById("mode-banner");
const historyBody = document.getElementById("history-body");
const summaryStats = document.getElementById("summary-stats");
const tripDate = document.getElementById("trip-date");
const tripDay = document.getElementById("trip-day");
const tripNotes = document.getElementById("trip-notes");
const exportButton = document.getElementById("export-data");
const clearButton = document.getElementById("clear-data");

let arrivalTimeout = null;
let currentMode = normalizeMode(
  typeof localStorage !== "undefined" ? localStorage.getItem(MODE_KEY) : null
);
let activeTrip = null;

function normalizeMode(value) {
  if (value === MODES.test) {
    return MODES.test;
  }
  return MODES.live;
}

function getStorageKey(baseKey, mode = currentMode) {
  if (mode === MODES.test) {
    return `${baseKey}-test`;
  }
  return baseKey;
}

function setFormDisabled(disabled) {
  [tripDate, tripDay, routeSelect, tripNotes].forEach((field) => {
    if (field) {
      field.disabled = disabled;
    }
  });
}

function setReminderStatus(message) {
  if (!reminderStatus) return;
  reminderStatus.textContent = message;
}

function setModeUI(mode) {
  if (modeToggle) {
    modeToggle.checked = mode === MODES.test;
  }
  if (modeLabel) {
    modeLabel.textContent =
      mode === MODES.test ? "Test data only" : "Live data";
  }
  if (modeBanner) {
    if (mode === MODES.test) {
      modeBanner.textContent =
        "Test mode is ON. Entries are saved to a separate test log.";
      modeBanner.classList.add("active");
    } else {
      modeBanner.textContent = "";
      modeBanner.classList.remove("active");
    }
  }
}

function setTodayDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const local = new Date(today.getTime() - offset * 60000);
  tripDate.value = local.toISOString().slice(0, 10);
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortTime(value) {
  if (!value) return "—";
  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes || 0), 0, 0);
  return formatTime(date);
}

function parseTimeToDate(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes || 0), 0, 0);
  return date;
}

function formatDelta(expected, actual) {
  if (!expected || !actual) return "—";
  const diffMs = actual.getTime() - expected.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes === 0) return "On time";
  const sign = minutes > 0 ? "+" : "";
  return `${sign}${minutes}m`;
}

function formatDuration(start, end) {
  if (!start || !end) return "—";
  const diffMs = end.getTime() - start.getTime();
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.abs(totalMinutes % 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function loadHistory() {
  const raw = localStorage.getItem(getStorageKey(STORAGE_KEY));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(
    getStorageKey(STORAGE_KEY),
    JSON.stringify(entries)
  );
}

function loadActiveTrip() {
  const raw = localStorage.getItem(getStorageKey(ACTIVE_TRIP_KEY));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function saveActiveTrip(data) {
  if (!data) {
    localStorage.removeItem(getStorageKey(ACTIVE_TRIP_KEY));
    activeTrip = null;
    return;
  }
  activeTrip = data;
  localStorage.setItem(
    getStorageKey(ACTIVE_TRIP_KEY),
    JSON.stringify(data)
  );
}

activeTrip = loadActiveTrip();

function populateRoutes() {
  routeSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a route";
  placeholder.disabled = true;
  placeholder.selected = true;
  routeSelect.appendChild(placeholder);

  ROUTES.forEach((route) => {
    const option = document.createElement("option");
    option.value = route.code;
    option.textContent = `${route.code} • ${route.label}`;
    routeSelect.appendChild(option);
  });
}

function updateExpectedTimes() {
  const selected = ROUTES.find((route) => route.code === routeSelect.value);
  if (!selected) {
    expectedPickupEl.textContent = "—";
    expectedArrivalEl.textContent = "—";
    setReminderStatus("Select a route to schedule your arrival reminder.");
    return;
  }
  expectedPickupEl.textContent = formatShortTime(selected.expectedPickup);
  expectedArrivalEl.textContent = formatShortTime(selected.expectedArrival);
  setReminderStatus(
    `Arrival reminder set for ${formatShortTime(selected.expectedArrival)}.`
  );
}

function renderSchedule(day) {
  if (!scheduleTemplate || !scheduleContent) return;
  scheduleContent.innerHTML = "";
  const clone = scheduleTemplate.content.cloneNode(true);
  const badgeContainer = clone.querySelector(".route-badges");
  const tbody = clone.querySelector("tbody");

  const entries = SCHEDULES[day] || [];
  entries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.stop}</td>
      <td>${formatShortTime(entry.time)}</td>
      <td>${entry.route}</td>
      <td>
        <span class="badge" style="--badge-color:${entry.badge.color}">
          ${entry.badge.text}
        </span>
      </td>
    `;
    tbody.appendChild(row);
  });

  const badges = new Map();
  entries.forEach((entry) => {
    if (!badges.has(entry.route)) {
      badges.set(entry.route, entry.badge);
    }
  });

  badges.forEach((badge, route) => {
    const chip = document.createElement("span");
    chip.className = "route-chip";
    chip.innerHTML = `
      <span class="badge" style="--badge-color:${badge.color}">
        ${badge.text}
      </span>
      <span>${route}</span>
    `;
    badgeContainer.appendChild(chip);
  });

  scheduleContent.appendChild(clone);
}

function updateTabs(activeDay) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const isActive = tab.dataset.day === activeDay;
    tab.classList.toggle("active", isActive);
  });
}

function resetCheckinUI() {
  pickupDeltaEl.textContent = "—";
  arrivalDeltaEl.textContent = "—";
  pickupTimeEl.textContent = "Awaiting check-in";
  arrivalTimeEl.textContent = "Awaiting check-in";
  arrivalReminder.classList.remove("visible");
  arrivalCapture.classList.remove("visible");
  if (arrivalTimeout) {
    clearTimeout(arrivalTimeout);
  }
}

function scheduleArrivalReminder(expectedArrival) {
  if (arrivalTimeout) {
    clearTimeout(arrivalTimeout);
  }
  if (!expectedArrival) return;

  const now = new Date();
  const delay = expectedArrival.getTime() - now.getTime();
  if (delay <= 0) {
    arrivalReminder.classList.add("visible");
    return;
  }
  setReminderStatus(
    `We’ll remind you around ${formatTime(expectedArrival)} to confirm arrival.`
  );
  arrivalTimeout = setTimeout(() => {
    arrivalReminder.classList.add("visible");
  }, delay);
}

function buildTripBase() {
  const route = ROUTES.find((item) => item.code === routeSelect.value);
  if (!route) return null;
  const expectedPickup = parseTimeToDate(route.expectedPickup);
  const expectedArrival = parseTimeToDate(route.expectedArrival);
  return {
    date: tripDate.value,
    day: tripDay.value,
    route: route.code,
    expectedPickup: expectedPickup?.toISOString() || null,
    expectedArrival: expectedArrival?.toISOString() || null,
    pickupActual: null,
    arrivalActual: null,
    notes: tripNotes.value.trim(),
  };
}

function updateDeltas() {
  if (!activeTrip) {
    resetCheckinUI();
    return;
  }

  const expectedPickup = activeTrip.expectedPickup
    ? new Date(activeTrip.expectedPickup)
    : null;
  const expectedArrival = activeTrip.expectedArrival
    ? new Date(activeTrip.expectedArrival)
    : null;
  const pickupActual = activeTrip.pickupActual
    ? new Date(activeTrip.pickupActual)
    : null;
  const arrivalActual = activeTrip.arrivalActual
    ? new Date(activeTrip.arrivalActual)
    : null;

  pickupDeltaEl.textContent = formatDelta(expectedPickup, pickupActual);
  arrivalDeltaEl.textContent = formatDelta(expectedArrival, arrivalActual);
  pickupTimeEl.textContent = pickupActual
    ? `Picked up at ${formatTime(pickupActual)}`
    : "Awaiting check-in";
  arrivalTimeEl.textContent = arrivalActual
    ? `Arrived at ${formatTime(arrivalActual)}`
    : "Awaiting check-in";
}

function saveTripToHistory() {
  if (!activeTrip) return;
  const history = loadHistory();
  history.unshift(activeTrip);
  saveHistory(history.slice(0, 50));
  saveActiveTrip(null);
  renderHistory();
  resetCheckinUI();
  setFormDisabled(false);
  setReminderStatus("Select a route to schedule your arrival reminder.");
}

function renderHistory() {
  const history = loadHistory();
  historyBody.innerHTML = "";

  history.forEach((entry) => {
    const expectedPickup = entry.expectedPickup
      ? new Date(entry.expectedPickup)
      : null;
    const expectedArrival = entry.expectedArrival
      ? new Date(entry.expectedArrival)
      : null;
    const pickupActual = entry.pickupActual
      ? new Date(entry.pickupActual)
      : null;
    const arrivalActual = entry.arrivalActual
      ? new Date(entry.arrivalActual)
      : null;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.date || "—"}</td>
      <td>${entry.route || "—"}</td>
      <td>${formatShortTime(entry.expectedPickup?.slice(11, 16))}</td>
      <td>${pickupActual ? formatTime(pickupActual) : "—"}</td>
      <td>${formatDelta(expectedPickup, pickupActual)}</td>
      <td>${formatShortTime(entry.expectedArrival?.slice(11, 16))}</td>
      <td>${arrivalActual ? formatTime(arrivalActual) : "—"}</td>
      <td>${formatDelta(expectedArrival, arrivalActual)}</td>
      <td>${formatDuration(pickupActual, arrivalActual)}</td>
      <td>${entry.notes || "—"}</td>
    `;
    historyBody.appendChild(row);
  });

  renderStats(history);
}

function renderStats(history) {
  if (!summaryStats) return;
  if (!history.length) {
    summaryStats.innerHTML = "";
    return;
  }

  const pickupDeltas = history
    .map((entry) => {
      const expected = entry.expectedPickup
        ? new Date(entry.expectedPickup)
        : null;
      const actual = entry.pickupActual ? new Date(entry.pickupActual) : null;
      return expected && actual
        ? Math.round((actual.getTime() - expected.getTime()) / 60000)
        : null;
    })
    .filter((value) => value !== null);

  const arrivalDeltas = history
    .map((entry) => {
      const expected = entry.expectedArrival
        ? new Date(entry.expectedArrival)
        : null;
      const actual = entry.arrivalActual ? new Date(entry.arrivalActual) : null;
      return expected && actual
        ? Math.round((actual.getTime() - expected.getTime()) / 60000)
        : null;
    })
    .filter((value) => value !== null);

  const avg = (values) => {
    if (!values.length) return "—";
    const total = values.reduce((sum, value) => sum + value, 0);
    return `${Math.round(total / values.length)}m`;
  };

  summaryStats.innerHTML = `
    <div>
      <span>Avg pickup delta</span>
      <strong>${avg(pickupDeltas)}</strong>
    </div>
    <div>
      <span>Avg arrival delta</span>
      <strong>${avg(arrivalDeltas)}</strong>
    </div>
  `;
}

function handlePickupNow() {
  const baseTrip = activeTrip || buildTripBase();
  if (!baseTrip) {
    setReminderStatus("Pick a route before checking in.");
    return;
  }

  const now = new Date();
  const updated = {
    ...baseTrip,
    pickupActual: now.toISOString(),
  };

  saveActiveTrip(updated);
  updateDeltas();
  setFormDisabled(true);
  const expectedArrival = updated.expectedArrival
    ? new Date(updated.expectedArrival)
    : null;
  scheduleArrivalReminder(expectedArrival);
}

function handleArrivalNow() {
  const baseTrip = activeTrip || buildTripBase();
  if (!baseTrip) {
    setReminderStatus("Pick a route before recording arrival.");
    return;
  }
  const now = new Date();
  const updated = {
    ...baseTrip,
    pickupActual: baseTrip.pickupActual || now.toISOString(),
    arrivalActual: now.toISOString(),
  };
  saveActiveTrip(updated);
  updateDeltas();
  arrivalReminder.classList.remove("visible");
  arrivalCapture.classList.remove("visible");
  saveTripToHistory();
}

function handleArrivalYes() {
  handleArrivalNow();
}

function handleArrivalNo() {
  arrivalReminder.classList.remove("visible");
  arrivalCapture.classList.add("visible");
}

function exportHistory() {
  const history = loadHistory();
  if (!history.length) return;
  const headers = [
    "Date",
    "Day",
    "Route",
    "Expected Pickup",
    "Actual Pickup",
    "Pickup Delta (min)",
    "Expected Arrival",
    "Actual Arrival",
    "Arrival Delta (min)",
    "Notes",
  ];

  const rows = history.map((entry) => {
    const expectedPickup = entry.expectedPickup
      ? new Date(entry.expectedPickup)
      : null;
    const expectedArrival = entry.expectedArrival
      ? new Date(entry.expectedArrival)
      : null;
    const pickupActual = entry.pickupActual
      ? new Date(entry.pickupActual)
      : null;
    const arrivalActual = entry.arrivalActual
      ? new Date(entry.arrivalActual)
      : null;

    const delta = (expected, actual) => {
      if (!expected || !actual) return "";
      return Math.round((actual - expected) / 60000);
    };

    return [
      entry.date,
      entry.day,
      entry.route,
      expectedPickup ? formatTime(expectedPickup) : "",
      pickupActual ? formatTime(pickupActual) : "",
      delta(expectedPickup, pickupActual),
      expectedArrival ? formatTime(expectedArrival) : "",
      arrivalActual ? formatTime(arrivalActual) : "",
      delta(expectedArrival, arrivalActual),
      entry.notes || "",
    ];
  });

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) =>
          `"${String(cell).replace(/"/g, '""')}"`
        )
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const prefix = currentMode === MODES.test ? "commute-history-test" : "commute-history";
  link.download = `${prefix}-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearHistory() {
  localStorage.removeItem(getStorageKey(STORAGE_KEY));
  renderHistory();
}

function applyMode(mode) {
  currentMode = normalizeMode(mode);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(MODE_KEY, currentMode);
  }
  setModeUI(currentMode);
  resetCheckinUI();
  activeTrip = loadActiveTrip();
  renderHistory();

  if (activeTrip) {
    if (activeTrip.date) {
      tripDate.value = activeTrip.date;
    }
    if (activeTrip.day) {
      tripDay.value = activeTrip.day;
    }
    if (activeTrip.route) {
      routeSelect.value = activeTrip.route;
    }
    tripNotes.value = activeTrip.notes || "";
    updateExpectedTimes();
    updateDeltas();
    setFormDisabled(true);
    const expectedArrival = activeTrip.expectedArrival
      ? new Date(activeTrip.expectedArrival)
      : null;
    scheduleArrivalReminder(expectedArrival);
  } else {
    setFormDisabled(false);
    tripNotes.value = "";
    setTodayDate();
    routeSelect.value = "";
    updateExpectedTimes();
  }
}

function initialize() {
  setTodayDate();
  populateRoutes();
  updateExpectedTimes();
  renderHistory();
  renderSchedule("Tuesday");
  setModeUI(currentMode);

  if (activeTrip) {
    if (activeTrip.date) {
      tripDate.value = activeTrip.date;
    }
    if (activeTrip.day) {
      tripDay.value = activeTrip.day;
    }
    if (activeTrip.route) {
      routeSelect.value = activeTrip.route;
    }
    if (activeTrip.notes) {
      tripNotes.value = activeTrip.notes;
    }
    updateExpectedTimes();
    updateDeltas();
    setFormDisabled(true);
    const expectedArrival = activeTrip.expectedArrival
      ? new Date(activeTrip.expectedArrival)
      : null;
    scheduleArrivalReminder(expectedArrival);
  }

  routeSelect.addEventListener("change", () => {
    updateExpectedTimes();
    resetCheckinUI();
    saveActiveTrip(null);
    setFormDisabled(false);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const day = tab.dataset.day;
      updateTabs(day);
      renderSchedule(day);
    });
  });

  pickupNowBtn.addEventListener("click", handlePickupNow);
  arrivalNowBtn.addEventListener("click", handleArrivalNow);
  arrivalYesBtn.addEventListener("click", handleArrivalYes);
  arrivalNoBtn.addEventListener("click", handleArrivalNo);
  arrivalCaptureBtn.addEventListener("click", handleArrivalNow);
  exportButton.addEventListener("click", exportHistory);
  clearButton.addEventListener("click", clearHistory);
  if (modeToggle) {
    modeToggle.addEventListener("change", (event) => {
      const nextMode = event.target.checked ? MODES.test : MODES.live;
      applyMode(nextMode);
    });
  }
}

if (typeof document !== "undefined" && routeSelect) {
  initialize();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatDelta,
    formatDuration,
    normalizeMode,
    getStorageKey,
  };
}
