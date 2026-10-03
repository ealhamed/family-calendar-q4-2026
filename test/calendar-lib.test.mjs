import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createPinHash,
  validateCalendar,
  verifyPin,
} from "../api/calendar-lib.mjs";

const validCalendar = {
  version: 1,
  months: [
    {
      name: "October",
      year: 2026,
      month: 9,
      events: [
        { id: "dad-dubai-2026-10-01", day: 1, category: "dad", label: "Dubai" },
      ],
      travel: { "1": "depart" },
    },
  ],
};

test("validateCalendar accepts a valid calendar", () => {
  assert.deepEqual(validateCalendar(validCalendar), validCalendar);
});

test("validateCalendar rejects an unknown event category", () => {
  const calendar = structuredClone(validCalendar);
  calendar.months[0].events[0].category = "private";

  assert.throws(() => validateCalendar(calendar), /Unknown category/);
});

test("validateCalendar rejects duplicate event ids", () => {
  const calendar = structuredClone(validCalendar);
  calendar.months[0].events.push({ ...calendar.months[0].events[0], day: 2 });

  assert.throws(() => validateCalendar(calendar), /Duplicate event id/);
});

test("validateCalendar rejects a day outside the month", () => {
  const calendar = structuredClone(validCalendar);
  calendar.months[0].events[0].day = 32;

  assert.throws(() => validateCalendar(calendar), /Invalid event day/);
});

test("validateCalendar accepts a same-month event range", () => {
  const calendar = structuredClone(validCalendar);
  calendar.months[0].events[0] = {
    id: "dad-argentina-2026-10",
    startDay: 15,
    endDay: 31,
    category: "dad",
    label: "Argentina",
  };

  assert.deepEqual(validateCalendar(calendar), calendar);
});

test("PIN hashes verify without storing the PIN", () => {
  const hash = createPinHash("482915", "00112233445566778899aabbccddeeff");

  assert.equal(verifyPin("482915", hash), true);
  assert.equal(verifyPin("482916", hash), false);
  assert.equal(hash.includes("482915"), false);
});
