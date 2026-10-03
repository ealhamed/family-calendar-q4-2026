import { validateCalendar, verifyPin } from "./calendar-lib.mjs";

const DATA_PATH = "data/calendar.json";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!isSameOrigin(req)) {
    return res.status(403).json({ error: "Request origin not allowed" });
  }
  if (!verifyPin(req.headers["x-family-pin"], process.env.FAMILY_CALENDAR_PIN_HASH)) {
    return res.status(401).json({ error: "Incorrect PIN" });
  }

  const config = githubConfig();
  if (!config) {
    return res.status(503).json({ error: "Editor is not configured" });
  }

  try {
    if (req.method === "GET") {
      return await readCalendar(res, config);
    }
    if (req.method === "POST") {
      return await writeCalendar(req, res, config);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("calendar API error", error);
    return res.status(500).json({ error: "Calendar update failed" });
  }
}

async function readCalendar(res, config) {
  const response = await fetch(config.url, { headers: config.headers });
  if (!response.ok) return githubError(res, response);

  const file = await response.json();
  const calendar = JSON.parse(Buffer.from(file.content.replace(/\n/g, ""), "base64").toString());
  validateCalendar(calendar);

  return res.status(200).json({ calendar, sha: file.sha });
}

async function writeCalendar(req, res, config) {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Missing calendar update" });
  }
  if (typeof body.expectedSha !== "string" || !/^[a-f0-9]{6,64}$/i.test(body.expectedSha)) {
    return res.status(400).json({ error: "Missing calendar revision" });
  }
  if (JSON.stringify(body).length > 250_000) {
    return res.status(413).json({ error: "Calendar update is too large" });
  }

  validateCalendar(body.calendar);
  const content = Buffer.from(`${JSON.stringify(body.calendar, null, 2)}\n`).toString("base64");
  const response = await fetch(config.url, {
    method: "PUT",
    headers: config.headers,
    body: JSON.stringify({
      message: `Update family calendar ${new Date().toISOString().slice(0, 10)}`,
      content,
      sha: body.expectedSha,
      branch: "main",
    }),
  });
  if (!response.ok) return githubError(res, response);

  const result = await response.json();
  return res.status(200).json({
    ok: true,
    sha: result.content.sha,
    commit: result.commit.sha,
    commitUrl: result.commit.html_url,
  });
}

function githubConfig() {
  const token = process.env.GITHUB_CALENDAR_TOKEN;
  const repository = process.env.GITHUB_CALENDAR_REPOSITORY;
  if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "")) return null;

  return {
    url: `https://api.github.com/repos/${repository}/contents/${DATA_PATH}`,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "family-calendar-editor",
    },
  };
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  const hosts = new Set([
    req.headers.host,
    req.headers["x-forwarded-host"],
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ].filter(Boolean));
  const configuredOrigins = new Set(
    (process.env.FAMILY_CALENDAR_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
  if (!origin) return req.method === "GET";
  if (hosts.size === 0 && configuredOrigins.size === 0) return false;

  try {
    const parsedOrigin = new URL(origin);
    return hosts.has(parsedOrigin.host) || configuredOrigins.has(parsedOrigin.origin);
  } catch {
    return false;
  }
}

async function githubError(res, response) {
  if (response.status === 409 || response.status === 422) {
    return res.status(409).json({
      error: "The calendar changed on another device. Reload before saving.",
    });
  }
  if (response.status === 404) {
    return res.status(503).json({ error: "Calendar data is unavailable" });
  }
  return res.status(502).json({ error: "GitHub could not save the calendar" });
}
