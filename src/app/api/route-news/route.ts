import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { newsForRoute } from "@/lib/news";
import { cityFromLabels, rankStreets } from "@/lib/routing";

const Body = z.object({
  /** Streets the router walked, most-walked first (empty for saved trips). */
  streets: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  /** Waypoint labels; their addresses add streets and give us the city. */
  labels: z.array(z.string().max(200)).max(40).default([]),
});

export const POST = handler(async (req: Request) => {
  await requireUser();
  const { streets, labels } = Body.parse(await req.json());
  const merged = rankStreets(new Map(streets.map((s, i) => [s, streets.length - i])), labels).slice(0, 12);
  return NextResponse.json(await newsForRoute(merged, cityFromLabels(labels)));
});
