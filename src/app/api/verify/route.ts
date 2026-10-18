import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/session";
import { gemmaStatus, readIdDocument } from "@/lib/gemma";
import { decideVerification } from "@/lib/identity";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 24 * 3600 * 1000;

async function myHouse(userId: string) {
  const house = await db.house.findFirst({ where: { ownerId: userId } });
  if (!house) throw new HttpError(400, "Register your house before verifying.");
  return house;
}

export const GET = handler(async () => {
  const user = await requireUser("HOMEOWNER");
  const h = await myHouse(user.id);
  const demoSamples = process.env.ID_CHECK_ALLOW_SAMPLES === "true";
  return NextResponse.json({
    status: h.verificationStatus, note: h.verificationNote, verifiedName: h.verifiedName, idDocumentType: h.idDocumentType,
    available: gemmaStatus().provider !== "none",
    // Demo mode only: the owner's own name/address, so the page can draw a matching SAMPLE card.
    demoSamples,
    sample: demoSamples ? { name: h.legalName, address: h.address } : null,
  });
});

/**
 * Upload a photo of an ID; Gemma reads it, identity.ts decides. The image only lives in memory
 * for this request: it is never written to disk, the database or the logs.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser("HOMEOWNER");
  const house = await myHouse(user.id);
  if (house.verificationStatus === "VERIFIED") throw new HttpError(400, "Your ID is already checked.");
  if (gemmaStatus().provider === "none") throw new HttpError(503, "ID checks aren't available on this server (Gemma isn't configured).");

  // 5 attempts per rolling 24 h window.
  const windowFresh = house.verificationWindowStart && Date.now() - house.verificationWindowStart.getTime() < WINDOW_MS;
  const attempts = windowFresh ? house.verificationAttempts : 0;
  if (attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts. Try again tomorrow.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("id");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a photo of your ID.");
  if (!TYPES.includes(file.type)) throw new HttpError(400, "Use a JPEG, PNG or WebP photo.");
  if (file.size > MAX_BYTES) throw new HttpError(400, "That photo is over 8 MB. Try a smaller one.");

  await db.house.update({
    where: { id: house.id },
    data: { verificationAttempts: attempts + 1, verificationWindowStart: windowFresh ? house.verificationWindowStart : new Date() },
  });

  const read = await readIdDocument({ mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") });
  if (!read) throw new HttpError(503, "The ID check is busy or unavailable right now. Nothing was saved; please try again in a minute.");

  const d = decideVerification(read, {
    legalName: house.legalName,
    houseAddress: house.address,
    allowSamples: process.env.ID_CHECK_ALLOW_SAMPLES === "true",
  });
  await db.house.update({
    where: { id: house.id },
    data: {
      verificationStatus: d.status,
      verificationNote: d.note,
      verifiedName: d.verifiedName,
      addressMatchesId: d.addressMatchesId,
      idDocumentType: d.idDocumentType,
      verificationMethod: "gemma-id-read",
      verifiedAt: d.status === "VERIFIED" ? new Date() : null,
    },
  });
  return NextResponse.json({ status: d.status, note: d.note, verifiedName: d.verifiedName, checks: d.checks, attemptsLeft: MAX_ATTEMPTS - attempts - 1 });
});
