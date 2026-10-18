import { NextResponse } from "next/server";
import { z } from "zod";
import { db, parseJson } from "@/lib/db";
import { handler } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/session";
import { ALLERGEN_CODES } from "@/lib/allergens";

export const GET = handler(async () => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { ...user, childAllergens: parseJson<string[]>(user.childAllergens, []) } });
});

const Patch = z.object({ childAllergens: z.array(z.enum(ALLERGEN_CODES as [string, ...string[]])) });

export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const body = Patch.parse(await req.json());
  await db.user.update({ where: { id: user.id }, data: { childAllergens: JSON.stringify(body.childAllergens) } });
  return NextResponse.json({ ok: true });
});
