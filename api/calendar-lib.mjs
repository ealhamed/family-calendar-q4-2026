import { scryptSync, timingSafeEqual } from "node:crypto";

const CATEGORIES = new Set(["dad", "mom", "school", "helper"]);
const TRAVEL_STATES = new Set(["depart", "arrive"]);

export function createPinHash(pin, salt) {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN must be exactly six digits");
  }
  if (!/^[a-f0-9]{32}$/i.test(salt)) {
    throw new Error("Salt must be a 16-byte hexadecimal value");
  }

  return `scrypt:${salt.toLowerCase()}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function verifyPin(pin, storedHash) {
  if (typeof pin !== "string" || typeof storedHash !== "string") return false;

  const [algorithm, salt, expectedHex] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !/^[a-f0-9]{64}$/i.test(expectedHex || "")) {
    return false;
  }

  const actual = scryptSync(pin, salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validateCalendar(calendar) {
  if (!calendar || typeof calendar !== "object" || Array.isArray(calendar)) {
    throw new Error("Calendar must be an object");
  }
  if (calendar.version !== 1 || !Array.isArray(calendar.months)) {
    throw new Error("Unsupported calendar format");
  }
  if (calendar.months.length < 1 || calendar.months.length > 12) {
    throw new Error("Calendar must contain between one and twelve months");
  }

  const ids = new Set();
  for (const month of calendar.months) {
    validateMonth(month, ids);
  }

  return calendar;
}

function validateMonth(month, ids) {
  if (!month || typeof month !== "object" || Array.isArray(month)) {
    throw new Error("Invalid month");
  }
  if (typeof month.name !== "string" || month.name.length < 3 || month.name.length > 12) {
    throw new Error("Invalid month name");
  }
  if (!Number.isInteger(month.year) || month.year < 2020 || month.year > 2100) {
    throw new Error("Invalid year");
  }
  if (!Number.isInteger(month.month) || month.month < 0 || month.month > 11) {
    throw new Error("Invalid month index");
  }
  if (!Array.isArray(month.events) || month.events.length > 500) {
    throw new Error("Invalid events list");
  }

  const totalDays = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate();
  for (const event of month.events) {
    validateEvent(event, totalDays, ids);
  }

  if (!month.travel || typeof month.travel !== "object" || Array.isArray(month.travel)) {
    throw new Error("Invalid travel map");
  }
  for (const [day, state] of Object.entries(month.travel)) {
    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > totalDays) {
      throw new Error("Invalid travel day");
    }
    if (!TRAVEL_STATES.has(state)) {
      throw new Error("Invalid travel state");
    }
  }

  if (month.due !== undefined && (
    !Number.isInteger(month.due) || month.due < 1 || month.due > totalDays
  )) {
    throw new Error("Invalid due day");
  }
}

function validateEvent(event, totalDays, ids) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("Invalid event");
  }
  if (typeof event.id !== "string" || !/^[a-z0-9][a-z0-9-]{5,79}$/.test(event.id)) {
    throw new Error("Invalid event id");
  }
  if (ids.has(event.id)) {
    throw new Error(`Duplicate event id: ${event.id}`);
  }
  ids.add(event.id);

  const startDay = event.day ?? event.startDay;
  const endDay = event.day ?? event.endDay;
  if (
    !Number.isInteger(startDay) ||
    !Number.isInteger(endDay) ||
    startDay < 1 ||
    endDay > totalDays ||
    startDay > endDay
  ) {
    throw new Error("Invalid event day");
  }
  if (!CATEGORIES.has(event.category)) {
    throw new Error(`Unknown category: ${event.category}`);
  }
  if (typeof event.label !== "string" || event.label.trim().length < 1 || event.label.length > 120) {
    throw new Error("Invalid event label");
  }
}
