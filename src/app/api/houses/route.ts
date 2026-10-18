import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { publicHouse } from "@/lib/housesQuery";

export const GET = handler(async () => {
  const houses = await db.house.findMany({ where: { active: true }, take: 1000 });
  return NextResponse.json({ houses: houses.map(publicHouse) });
});
