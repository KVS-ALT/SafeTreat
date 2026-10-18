import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { getSession, HttpError } from "@/lib/session";

const Body = z.object({ username: z.string().trim(), password: z.string() });

export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json());
  const user = await db.user.findUnique({ where: { username: body.username } });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, "Wrong username or password.");
  }
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  return NextResponse.json({ id: user.id, username: user.username, role: user.role });
});
