import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { getCurrentUser, requireUser } from "@/lib/session";

export const GET = handler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ alerts: [], unread: 0 });
  const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";
  const [alerts, unread] = await Promise.all([
    db.alert.findMany({
      where: { userId: user.id, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        report: { select: { id: true, title: true, placeName: true, lat: true, lng: true, severity: true, category: true, candyDescription: true, createdAt: true } },
        trip: { select: { id: true, name: true } },
      },
    }),
    db.alert.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({ alerts, unread });
});

const Patch = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });

export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const body = Patch.parse(await req.json());
  await db.alert.updateMany({
    where: { userId: user.id, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
});
