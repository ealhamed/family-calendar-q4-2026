import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import handler from "../api/calendar.mjs";
import { createPinHash } from "../api/calendar-lib.mjs";

const calendar = {
  version: 1,
  months: [
    {
      name: "October",
      year: 2026,
      month: 9,
      events: [
        { id: "dad-dubai-2026-10-01", day: 1, category: "dad", label: "Dubai" },
      ],
      travel: {},
    },
  ],
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.FAMILY_CALENDAR_PIN_HASH = createPinHash(
    "482915",
    "00112233445566778899aabbccddeeff",
  );
  process.env.GITHUB_CALENDAR_TOKEN = "test-token";
  process.env.GITHUB_CALENDAR_REPOSITORY = "ealhamed/family-calendar-q4-2026";
  process.env.FAMILY_CALENDAR_ALLOWED_ORIGINS = "https://family-calendar-q4-2026.vercel.app";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("API rejects an incorrect editor PIN before contacting GitHub", async () => {
  let contactedGitHub = false;
  globalThis.fetch = async () => {
    contactedGitHub = true;
    throw new Error("unexpected fetch");
  };
  const res = responseRecorder();

  await handler(request("GET", "000000"), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Incorrect PIN" });
  assert.equal(contactedGitHub, false);
});

test("GET returns the current GitHub-backed calendar and revision", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    sha: "abc123",
    content: Buffer.from(`${JSON.stringify(calendar)}\n`).toString("base64"),
  }), { status: 200 });
  const res = responseRecorder();

  await handler(request("GET", "482915"), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sha, "abc123");
  assert.deepEqual(res.body.calendar, calendar);
});

test("API accepts the browser origin when Vercel adds a different forwarded host", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    sha: "abc123",
    content: Buffer.from(`${JSON.stringify(calendar)}\n`).toString("base64"),
  }), { status: 200 });
  const req = request("GET", "482915");
  req.headers["x-forwarded-host"] = "internal-deployment.vercel.app";
  const res = responseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
});

test("API accepts the configured canonical origin behind Vercel routing", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    sha: "abc123",
    content: Buffer.from(`${JSON.stringify(calendar)}\n`).toString("base64"),
  }), { status: 200 });
  const req = request("GET", "482915");
  req.headers.host = "internal-host.vercel.app";
  req.headers["x-forwarded-host"] = "internal-forwarded.vercel.app";
  const res = responseRecorder();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
});

test("POST commits a validated calendar against the editor revision", async () => {
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response(JSON.stringify({
      content: { sha: "def456" },
      commit: { sha: "commit789", html_url: "https://github.test/commit/commit789" },
    }), { status: 200 });
  };
  const res = responseRecorder();

  await handler(request("POST", "482915", { calendar, expectedSha: "abc123" }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sha, "def456");
  assert.equal(requestOptions.method, "PUT");
  const submitted = JSON.parse(requestOptions.body);
  assert.equal(submitted.sha, "abc123");
  assert.deepEqual(JSON.parse(Buffer.from(submitted.content, "base64").toString()), calendar);
});

function request(method, pin, body) {
  return {
    method,
    headers: {
      host: "family-calendar-q4-2026.vercel.app",
      origin: "https://family-calendar-q4-2026.vercel.app",
      "x-family-pin": pin,
    },
    body,
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader() {},
    end() {},
  };
}
