import { classifyNews } from "./gemma";

/**
 * Local news near a route, from Google News RSS search (free, no key; unofficial and rate-limited,
 * so everything here is best-effort and cached). Articles are matched by street name, not location.
 */

export type NewsItem = { title: string; url: string; outlet: string; publishedAt: string; text: string };
export type RouteNewsArticle = NewsItem & {
  street: string | null;
  category: string;
  severity: number;
  summary: string;
  /** false when Gemma couldn't check it and only the keyword filter matched */
  verified: boolean;
};
export type RouteNewsResult = {
  articles: RouteNewsArticle[];
  checked: { streets: string[]; city: string | null; days: number };
  source: "gemma" | "keywords";
  unavailable: boolean;
};

export const NEWS_DAYS = 14;
const MAX_STREET_QUERIES = 8;
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; items: NewsItem[] }>();

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
// Google News descriptions are HTML inside escaped XML, so entities come out double-encoded.
const strip = (html: string) => decode(decode(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

/** Parse RSS <item>s. Google News titles end in " - Outlet", which we split off. */
export function parseRss(xml: string): NewsItem[] {
  return xml.split("<item>").slice(1).map((chunk) => {
    const item = chunk.split("</item>")[0];
    const outlet = strip(tag(item, "source"));
    let title = strip(tag(item, "title"));
    if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3));
    const pub = new Date(strip(tag(item, "pubDate")));
    return {
      title,
      url: strip(tag(item, "link")),
      outlet,
      publishedAt: isNaN(pub.getTime()) ? "" : pub.toISOString(),
      text: strip(tag(item, "description")),
    };
  }).filter((i) => i.title && i.url);
}

export async function searchNews(query: string): Promise<NewsItem[]> {
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-CA&gl=CA&ceid=CA:en`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (SafeTreat demo)" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`news search ${res.status}`);
  const items = parseRss(await res.text());
  cache.set(query, { at: Date.now(), items });
  return items;
}

/** Words that suggest a safety incident (the cheap first pass before Gemma). */
const DANGER = /\b(crash|collision|struck|hit[- ]and[- ]run|pedestrian|shoot|shot|shooting|stab|stabbing|robbery|robbed|assault|break[- ]?in|burglar|police|arrest|charged|weapon|gun|knife|fire|missing (child|girl|boy)|abduct|lur(e|ing)|candy|tamper|edible|overdose|dog attack|attacked|bitten|vandal|threatened|dangerous driving|speeding)\b/i;
export const keywordMatches = (i: Pick<NewsItem, "title" | "text">) => DANGER.test(`${i.title} ${i.text}`);

const mentions = (i: NewsItem, street: string) => {
  const core = street.replace(/\s+(Street|Road|Avenue|Drive|Court|Crescent|Boulevard|Place|Lane|Trail|Way|Circle|Terrace)(\s+(North|South|East|West))?$/i, "");
  return new RegExp(`\\b${core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(`${i.title} ${i.text}`);
};

/** Search each walked street (and the city at large) and keep recent articles that look like safety incidents. */
export async function newsForRoute(streets: string[], city: string | null): Promise<RouteNewsResult> {
  const checkedStreets = streets.slice(0, MAX_STREET_QUERIES);
  const checked = { streets: checkedStreets, city, days: NEWS_DAYS };
  if (!city || !checkedStreets.length) return { articles: [], checked, source: "keywords", unavailable: false };

  const queries: { q: string; street: string | null }[] = [
    ...checkedStreets.map((st) => ({ q: `"${st}" "${city}" when:${NEWS_DAYS}d`, street: st })),
    { q: `"${city}" (police OR crash OR shooting OR robbery OR assault OR candy) when:3d`, street: null },
  ];
  let failures = 0;
  const found: (NewsItem & { street: string | null })[] = [];
  for (let i = 0; i < queries.length; i += 3) {
    const batch = await Promise.all(queries.slice(i, i + 3).map(async ({ q, street }) => {
      try {
        return (await searchNews(q)).map((it) => ({ ...it, street }));
      } catch {
        failures++;
        return [];
      }
    }));
    found.push(...batch.flat());
  }
  if (failures === queries.length) return { articles: [], checked, source: "keywords", unavailable: true };

  const cutoff = Date.now() - NEWS_DAYS * 24 * 3600 * 1000;
  const seen = new Set<string>();
  const candidates = found.filter((a) => {
    const key = a.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    if (!a.publishedAt || new Date(a.publishedAt).getTime() < cutoff) return false;
    // City-wide results only count if they name a street on the route.
    if (!a.street) {
      const st = checkedStreets.find((s) => mentions(a, s));
      if (!st) return false;
      a.street = st;
    }
    return keywordMatches(a);
  }).slice(0, 15);

  if (!candidates.length) return { articles: [], checked, source: "keywords", unavailable: false };

  const verdicts = await classifyNews(candidates, checkedStreets, city);
  if (verdicts) {
    const articles = candidates.flatMap((a, i) => {
      const v = verdicts.find((x) => x.i === i);
      if (!v?.relevant) return [];
      return [{ ...a, street: v.street || a.street, category: v.category, severity: v.severity, summary: v.summary, verified: true }];
    });
    return { articles: articles.sort((x, y) => y.severity - x.severity), checked, source: "gemma", unavailable: false };
  }
  return {
    // Google's snippet is just the headline again, so there's no summary without Gemma.
    articles: candidates.map((a) => ({ ...a, category: "other", severity: 2, summary: "", verified: false })),
    checked,
    source: "keywords",
    unavailable: false,
  };
}
