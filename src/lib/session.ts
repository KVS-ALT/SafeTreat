import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { db } from "./db";

export type SessionData = { userId?: string };

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "safetreat_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, role: true, childAllergens: true },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(role?: "PARENT" | "HOMEOWNER") {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please log in first.");
  if (role && user.role !== role) throw new HttpError(403, `Only ${role.toLowerCase()} accounts can do that.`);
  return user;
}
