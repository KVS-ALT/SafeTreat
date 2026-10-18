/**
 * Demo warm-up: loads every page and API once, plans a route (warms routing + news caches),
 * and times one tiny Gemma call so you know before the demo whether Gemma is responsive.
 *
 *   npm run warmup                 # against http://localhost:3000
 *   npm run warmup -- http://host:port
 */
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const PASSWORD = process.env.DEMO_PASSWORD || "trickortreat";
const rows = [];
let cookie = "";

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    rows.push({ step: name, ok: "✓", ms: Date.now() - t0, detail: detail ?? "" });
  } catch (err) {
    rows.push({ step: name, ok: "✗", ms: Date.now() - t0, detail: String(err.message ?? err).slice(0, 90) });
  }
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res;
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${data.error ?? ""}`);
  return { res, data };
}

for (const p of ["/", "/report", "/plan", "/trips", "/alerts", "/designs", "/login", "/homeowner", "/homeowner/verify"]) {
  await step(`page ${p}`, () => get(p).then(() => undefined));
}
for (const p of ["/api/status", "/api/reports", "/api/zones", "/api/houses"]) {
  await step(`api ${p}`, async () => {
    const r = await get(p);
    const j = await r.json();
    if (p === "/api/reports") return `${j.reports.length} reports`;
    if (p === "/api/houses") return `${j.houses.length} houses`;
    if (p === "/api/status") return `gemma=${j.gemma.provider}/${j.gemma.model}, routing=${j.routing}`;
  });
}

let route;
await step("log in as demo", async () => {
  const { res } = await post("/api/auth/login", { username: "demo", password: PASSWORD });
  cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie) throw new Error("no session cookie");
});
await step("plan a route", async () => {
  const { data } = await post("/api/route-plan", {
    home: { lat: 43.6835, lng: -79.7615, label: "Home" }, loop: true,
    suggest: { childAllergens: ["PEANUT"], radiusM: 800, maxStops: 8, verifiedOnly: false, atTime: "18:00" },
  });
  route = data.route;
  return `${route.engine}, ${(route.distanceM / 1000).toFixed(1)} km, ${route.zonesCrossed.length} zones crossed`;
});
await step("news near route", async () => {
  if (!route) throw new Error("no route");
  const { data } = await post("/api/route-news", { streets: route.streets, labels: route.usedWaypoints.map((w) => w.label) });
  if (data.unavailable) throw new Error("news search unavailable");
  return `${data.articles.length} articles (${data.source}), ${data.checked.streets.length} streets checked`;
});

await step("Gemma round trip", async () => {
  const provider = (process.env.GEMMA_PROVIDER ?? "google").toLowerCase();
  if (provider === "ollama") {
    const r = await fetch(`${process.env.OLLAMA_URL ?? "http://localhost:11434"}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OLLAMA_MODEL ?? "gemma3", prompt: "Say OK.", stream: false }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`ollama ${r.status}`);
    return "ollama responded";
  }
  if (!process.env.GEMINI_API_KEY) throw new Error("no GEMINI_API_KEY (app will use fallbacks; ID check unavailable)");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await Promise.race([
    ai.models.generateContent({ model: process.env.GEMMA_MODEL || "gemma-4-31b-it", contents: "Say OK." }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("no reply in 60 s: Gemma is overloaded, expect fallbacks")), 60000)),
  ]);
  return `replied "${(res.text ?? "").trim().slice(0, 20)}"`;
});

console.table(rows);
const gemma = rows.find((r) => r.step === "Gemma round trip");
if (gemma?.ok === "✓") {
  console.log(gemma.ms > 20000
    ? "Gemma works but is slow right now: the ID check and news may take up to a minute."
    : "Gemma is responsive. You're good to go.");
} else {
  console.log("Gemma isn't answering: reports, news and alerts will use fallbacks, and the ID check will say it's unavailable.");
}
process.exit(rows.some((r) => r.ok === "✗" && !r.step.startsWith("Gemma")) ? 1 : 0);
