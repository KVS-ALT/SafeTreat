import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { getSession, HttpError } from "@/lib/session";

const Body = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/, "letters, numbers, - and _ only"),
  password: z.string().min(8).max(200),
  role: z.enum(["PARENT", "HOMEOWNER"]),
});

export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json());
  const exists = await db.user.findUnique({ where: { username: body.username } });
  if (exists) throw new HttpError(409, "That username is taken.");
  const user = await db.user.create({
    data: { username: body.username, role: body.role, passwordHash: await bcrypt.hash(body.password, 10) },
  });
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  return NextResponse.json({ id: user.id, username: user.username, role: user.role });
});
