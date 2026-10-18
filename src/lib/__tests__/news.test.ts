import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keywordMatches, parseRss } from "../news";
import { cityFromLabels, rankStreets, streetFromLabel, streetKey } from "../routing";

const xml = readFileSync(join(__dirname, "fixtures/gnews-sample.xml"), "utf8");

describe("parseRss", () => {
  it("reads items, strips the outlet suffix and double-encoded entities", () => {
    const items = parseRss(xml);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Pedestrian struck near Queen Street West and Mill Street");
    expect(items[0].outlet).toBe("Example Daily");
    expect(items[0].url).toBe("https://news.example.com/a1");
    expect(items[0].publishedAt).toBe("2026-10-16T21:10:00.000Z");
    expect(items[0].text).not.toMatch(/&nbsp;|&amp;|</);
  });
});

describe("keywordMatches", () => {
  it("keeps incidents and drops everyday news", () => {
    const [crash, market] = parseRss(xml);
    expect(keywordMatches(crash)).toBe(true);
    expect(keywordMatches(market)).toBe(false);
    expect(keywordMatches({ title: "Councillor calls rival an attack dog", text: "" })).toBe(false);
  });
});

describe("street helpers", () => {
  it("pulls a spelled-out street and city from stop labels", () => {
    expect(streetFromLabel("The Garcias 🎃 — 65 Archdekin Dr, Brampton, ON")).toBe("Archdekin Drive");
    expect(streetFromLabel("70 Mill St N, Brampton, ON")).toBe("Mill Street North");
    expect(streetFromLabel("Home")).toBeNull();
    expect(cityFromLabels(["Home", "70 Mill St N, Brampton, ON"])).toBe("Brampton");
  });
  it("ranks router streets by distance and dedupes abbreviations", () => {
    const t = new Map([["Queen Street West", 400], ["Archdekin Drive", 900]]);
    expect(rankStreets(t, ["65 Archdekin Dr, Brampton, ON", "12 Elliott St, Brampton, ON"])).toEqual(["Archdekin Drive", "Queen Street West", "Elliott Street"]);
    expect(streetKey("Mill St. N")).toBe(streetKey("Mill Street North"));
  });
});
