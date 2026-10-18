import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ALLERGEN_CODES, findAllergenConflicts, type AllergenConflict, type Candy } from "./allergens";

/**
 * Gemma helpers. Every function has a deterministic fallback so the app works
 * without an API key (GEMMA_PROVIDER=none, or the call fails / returns junk).
 */

type Provider = "google" | "ollama" | "none";

function provider(): Provider {
  const p = (process.env.GEMMA_PROVIDER ?? "google").toLowerCase();
  if (p === "ollama") return "ollama";
  if (p === "google" && process.env.GEMINI_API_KEY) return "google";
  return "none";
}

let googleClient: GoogleGenAI | null = null;

/** Someone is waiting on the result (e.g. saving a house). */
export const INTERACTIVE_TIMEOUT_MS = Number(process.env.GEMMA_TIMEOUT_MS ?? 15000);
/** Runs after the response was sent; hosted Gemma can take ~1 min under load. */
export const BACKGROUND_TIMEOUT_MS = 90000;

/** Model calls must never hang forever: give up after timeoutMs and let the caller fall back. */
type ImageInput = { mimeType: string; base64: string };

async function generate(prompt: string, timeoutMs = INTERACTIVE_TIMEOUT_MS, image?: ImageInput): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Gemma timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    return await Promise.race([callModel(prompt, timeoutMs, image), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function callModel(prompt: string, timeoutMs: number, image?: ImageInput): Promise<string> {
  const p = provider();
  if (p === "google") {
    googleClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const res = await googleClient.models.generateContent({
      model: process.env.GEMMA_MODEL ?? "gemma-4-31b-it",
      contents: image
        ? [{ role: "user", parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: prompt }] }]
        : prompt,
      config: { temperature: 0.2 },
    });
    return res.text ?? "";
  }
  if (p === "ollama") {
    const res = await fetch(`${process.env.OLLAMA_URL ?? "http://localhost:11434"}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? "gemma3", prompt, stream: false, options: { temperature: 0.2 },
        ...(image ? { images: [image.base64] } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    return ((await res.json()) as { response: string }).response;
  }
  throw new Error("Gemma not configured");
}

/** Pull the first {...} block out of a model reply (Gemma sometimes wraps JSON in ```json fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

/** Ask for JSON; retry once only if the model answered but the JSON was malformed. */
async function generateJson<T>(prompt: string, schema: z.ZodType<T>, timeoutMs?: number, image?: ImageInput): Promise<T> {
  const first = await generate(prompt, timeoutMs, image);
  try {
    return schema.parse(extractJson(first));
  } catch {
    return schema.parse(extractJson(await generate(prompt, timeoutMs, image)));
  }
}

function logFallback(what: string, err: unknown) {
  if (provider() !== "none") console.warn(`[gemma] ${what} fell back: ${(err as Error).message?.slice(0, 200)}`);
}

// ---------------------------------------------------------------- report triage

export const REPORT_CATEGORIES = [
  "tampered_wrapper", "foreign_object", "drugs_or_edibles", "allergen_mislabel", "homemade_unlabeled",
  "expired_or_spoiled", "traffic", "assault_or_threat", "suspicious_person", "vandalism", "injury", "other",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  tampered_wrapper: "Tampered wrapper",
  foreign_object: "Foreign object (pin, needle, glass…)",
  drugs_or_edibles: "Drugs / cannabis edibles",
  allergen_mislabel: "Allergen not as described",
  homemade_unlabeled: "Unlabeled homemade treat",
  expired_or_spoiled: "Expired / spoiled",
  traffic: "Traffic danger",
  assault_or_threat: "Assault or threat",
  suspicious_person: "Suspicious person",
  vandalism: "Vandalism",
  injury: "Injury hazard",
  other: "Other",
};

const Triage = z.object({
  category: z.enum(REPORT_CATEGORIES),
  severity: z.coerce.number().int().min(1).max(5),
  summary: z.string().min(1).max(300),
  isSpam: z.boolean(),
});
export type TriageResult = z.infer<typeof Triage>;

export type ReportInput = {
  type: "CANDY" | "INCIDENT";
  title: string;
  description: string;
  placeName: string;
  candyDescription?: string | null;
};

/** Gemma's read of a report, or null if Gemma is off / failed. Slow: call it in the background. */
export async function gemmaTriage(r: ReportInput): Promise<z.infer<typeof Triage> | null> {
  if (provider() === "none") return null;
  const prompt = `You are the safety triage assistant for a Halloween community safety app.
Classify this user report. Reply with ONLY a JSON object, no other text:
{"category": one of ${JSON.stringify(REPORT_CATEGORIES)},
 "severity": integer 1-5 (1 = minor nuisance, 3 = real risk to kids, 5 = immediate danger e.g. needles, drugs, assault),
 "summary": one calm, factual sentence (max 25 words) for parents, no speculation or names,
 "isSpam": true if this is a joke, advertising, gibberish, or clearly not a real safety report}

Report type: ${r.type === "CANDY" ? "unsafe candy" : "incident"}
Location: ${r.placeName}
Title: ${r.title}
Description: ${r.description}
${r.candyDescription ? `Candy: ${r.candyDescription}` : ""}`;
  try {
    return await generateJson(prompt, Triage, BACKGROUND_TIMEOUT_MS);
  } catch (err) {
    logFallback("triage", err);
    return null;
  }
}

export function fallbackTriage(r: ReportInput): z.infer<typeof Triage> {
  const text = `${r.title} ${r.description} ${r.candyDescription ?? ""}`.toLowerCase();
  const rules: [RegExp, (typeof REPORT_CATEGORIES)[number], number][] = [
    [/needle|pin\b|razor|blade|glass|metal|sharp/, "foreign_object", 5],
    [/thc|cannabis|weed|marijuana|edible|drug|pill|fentanyl|high/, "drugs_or_edibles", 5],
    [/assault|attack|weapon|gun|knife|threat|fight/, "assault_or_threat", 5],
    [/tamper|opened|unwrapped|resealed|torn|hole|pierced|puncture/, "tampered_wrapper", 4],
    [/allerg|peanut|nut-free|contains nuts|gluten|reaction|epipen/, "allergen_mislabel", 4],
    [/car|traffic|speed|driver|crosswalk/, "traffic", 4],
    [/suspicious|stranger|follow|lurking|creep/, "suspicious_person", 3],
    [/homemade|unlabeled|baked/, "homemade_unlabeled", 3],
    [/expired|mold|stale|spoiled|smell/, "expired_or_spoiled", 2],
    [/injur|trip|fell|broken step|dark|no light|dog/, "injury", 3],
    [/egg|vandal|smash|graffiti/, "vandalism", 2],
  ];
  const hit = rules.find(([re]) => re.test(text));
  const category = hit?.[1] ?? "other";
  const severity = hit?.[2] ?? (r.type === "CANDY" ? 3 : 2);
  const isSpam = text.replace(/[^a-z]/g, "").length < 8 || /(buy now|http|www\.|promo code|lol+\b)/.test(text);
  const summary = `${r.type === "CANDY" ? "Unsafe candy" : CATEGORY_LABELS[category]} reported at ${r.placeName}: ${r.title}`.slice(0, 300);
  return { category, severity, summary, isSpam };
}

// ---------------------------------------------------------------- allergen cross-check

const AllergenCheck = z.object({
  conflicts: z.array(z.object({ candy: z.string(), allergen: z.enum(ALLERGEN_CODES as [string, ...string[]]) })),
});

/** Candies that probably contain an allergen the house claims to avoid. Gemma + keyword table merged. */
export async function checkAllergenClaims(candies: Candy[], allergenFree: string[]): Promise<AllergenConflict[]> {
  const local = findAllergenConflicts(candies, allergenFree);
  if (candies.length === 0 || allergenFree.length === 0) return local;
  const prompt = `A homeowner says every treat they hand out is free of: ${allergenFree.join(", ")}.
Their treats are: ${candies.map((c) => `${c.name}${c.homemade ? " (homemade)" : ""}`).join("; ")}.
Using typical Canadian recipes, list each treat that likely CONTAINS one of those allergens (including "may contain" warnings).
Allergen codes: ${ALLERGEN_CODES.join(", ")}.
Reply with ONLY JSON: {"conflicts": [{"candy": "<treat name as given>", "allergen": "<code>"}]}. Use an empty list if none.`;
  try {
    const { conflicts } = await generateJson(prompt, AllergenCheck);
    const merged = [...local];
    for (const c of conflicts) {
      if (!allergenFree.includes(c.allergen)) continue;
      if (!merged.some((m) => m.candy.toLowerCase() === c.candy.toLowerCase() && m.allergen === c.allergen)) {
        merged.push(c as AllergenConflict);
      }
    }
    return merged;
  } catch (err) {
    logFallback("allergen check", err);
    return local;
  }
}

// ---------------------------------------------------------------- ID document reading

const IdReadSchema = z.object({
  readable: z.boolean(),
  isGovernmentPhotoId: z.boolean(),
  isSampleOrSpecimen: z.boolean(),
  documentType: z.string().max(80).nullable().default(null),
  issuer: z.string().max(80).nullable().default(null),
  givenNames: z.string().max(120).nullable().default(null),
  surname: z.string().max(120).nullable().default(null),
  expiryDate: z.string().max(20).nullable().default(null),
  addressLine: z.string().max(160).nullable().default(null),
  city: z.string().max(80).nullable().default(null),
  concerns: z.array(z.string().max(160)).max(8).default([]),
});

/**
 * Read a photo of an ID card with Gemma (vision). Returns null when Gemma is off, times out or fails,
 * so the caller can say "ID check unavailable" instead of guessing. The image is never stored or logged.
 */
export async function readIdDocument(image: ImageInput): Promise<z.infer<typeof IdReadSchema> | null> {
  if (provider() === "none") return null;
  const prompt = `You are checking a photo that a homeowner uploaded to prove their name for a neighbourhood safety app.
Read the card and reply with ONLY a JSON object:
{"readable": true if the text on the card is legible,
 "isGovernmentPhotoId": true only for a government-issued photo ID (driver's licence, provincial/state photo card, passport, national ID card),
 "isSampleOrSpecimen": true if the card says SAMPLE, SPECIMEN, VOID, NOT VALID, TEST, or is clearly a mock-up,
 "documentType": short name e.g. "Ontario driver's licence", or null,
 "issuer": issuing province/state/country, or null,
 "givenNames": given name(s) exactly as printed, or null,
 "surname": family name exactly as printed, or null,
 "expiryDate": "YYYY-MM-DD" or null,
 "addressLine": street address line as printed, or null,
 "city": city as printed, or null,
 "concerns": short notes about anything that looks edited, cropped, a photo of a screen, or inconsistent (empty list if none)}
Do NOT include the ID number, date of birth, height, sex or any other field. Use null rather than guessing.`;
  try {
    return await generateJson(prompt, IdReadSchema, 60000, image);
  } catch (err) {
    logFallback("ID read", err);
    return null;
  }
}

// ---------------------------------------------------------------- local news

const NewsVerdicts = z.object({
  results: z.array(z.object({
    i: z.coerce.number().int(),
    relevant: z.boolean(),
    category: z.string().max(40).default("other"),
    severity: z.coerce.number().int().min(1).max(5).default(2),
    street: z.string().max(80).nullable().default(null),
    summary: z.string().max(240).default(""),
  })),
});
export type NewsVerdict = z.infer<typeof NewsVerdicts>["results"][number];

/**
 * Which news items describe a real, recent safety risk for kids walking these streets.
 * One batched call; null if Gemma is off or fails (caller falls back to keyword matches).
 */
export async function classifyNews(
  items: { title: string; text: string; outlet: string; publishedAt: string; street: string | null }[],
  streets: string[],
  city: string,
): Promise<NewsVerdict[] | null> {
  if (provider() === "none" || !items.length) return null;
  const list = items.map((a, i) => `[${i}] ${a.publishedAt.slice(0, 10)} · ${a.outlet} · ${a.title} — ${a.text.slice(0, 220)}`).join("\n");
  const prompt = `Parents in ${city} are planning a trick-or-treat walk along: ${streets.join(", ")}.
For each news item below, decide if it reports a real, recent safety risk ON or right next to one of those streets
(crime, violence, traffic crash, dangerous driving, fire, police activity, unsafe candy, dangerous animal).
Not relevant: obituaries, events, real estate, politics, sports, items about a different place with a similar street name.
Reply with ONLY JSON: {"results": [{"i": <index>, "relevant": true|false, "category": "<short label>", "severity": 1-5,
"street": "<which route street, or null>", "summary": "<one calm factual sentence for parents, max 25 words>"}]}

${list}`;
  try {
    return (await generateJson(prompt, NewsVerdicts, 25000)).results;
  } catch (err) {
    logFallback("news check", err);
    return null;
  }
}

// ---------------------------------------------------------------- alert messages

export type AlertContext = {
  tripName: string;
  placeName: string;
  passedAt: Date;
  distanceM: number;
  reportTitle: string;
  reportSummary: string;
  candyDescription?: string | null;
  category: string;
  severity: number;
};

const timeFmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Gemma-written alert text; falls back to the template. Slow: call it in the background. */
export async function writeAlert(a: AlertContext): Promise<string> {
  const prompt = `Write a short alert (2-3 sentences, under 60 words) for a parent whose child went trick-or-treating.
Be calm and practical, not alarming. Tell them what to look for in the candy bag and what to do (set it aside, call the Ontario Poison Centre 1-800-268-9017 or 911 if a child ate it and feels unwell).
Facts: On their trip "${a.tripName}" they passed ${a.placeName} at about ${timeFmt(a.passedAt)} (within ${Math.round(a.distanceM)} m).
Someone has since reported: ${a.reportTitle}. ${a.reportSummary}
${a.candyDescription ? `Candy described as: ${a.candyDescription}.` : ""}
Category: ${CATEGORY_LABELS[a.category] ?? a.category}. Severity ${a.severity}/5.
Reply with only the alert text.`;
  try {
    const text = (await generate(prompt, BACKGROUND_TIMEOUT_MS)).trim().replace(/^["']|["']$/g, "");
    if (text.length > 20) return text.slice(0, 600);
  } catch (err) {
    logFallback("alert text", err);
  }
  return fallbackAlert(a);
}

export function fallbackAlert(a: AlertContext): string {
  const candy = a.candyDescription ? ` Look for: ${a.candyDescription}.` : "";
  return `Your trip "${a.tripName}" passed ${a.placeName} at about ${timeFmt(a.passedAt)}, where someone has reported: ${a.reportTitle}.${candy} Please check your kids' candy and set aside anything matching. If a child ate it and feels unwell, call the Ontario Poison Centre (1-800-268-9017) or 911.`;
}

export function gemmaStatus() {
  return { provider: provider(), model: provider() === "ollama" ? process.env.OLLAMA_MODEL ?? "gemma3" : process.env.GEMMA_MODEL ?? "gemma-4-31b-it" };
}

