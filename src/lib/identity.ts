/**
 * Homeowner ID check. Gemma reads the ID photo (see readIdDocument in gemma.ts);
 * the pass/fail decision is made here, in plain code, so it's predictable and testable.
 *
 * This confirms that a real-looking government photo ID carries the homeowner's name.
 * It cannot detect forgeries or prove the uploader is the person on the card.
 */

export type IdRead = {
  readable: boolean;
  isGovernmentPhotoId: boolean;
  isSampleOrSpecimen: boolean;
  documentType: string | null;
  issuer: string | null;
  givenNames: string | null;
  surname: string | null;
  expiryDate: string | null; // YYYY-MM-DD
  addressLine: string | null;
  city: string | null;
  concerns: string[];
};

export type IdCheck = { label: string; ok: boolean };
export type IdDecision = {
  status: "VERIFIED" | "FAILED";
  note: string | null;
  verifiedName: string | null;
  addressMatchesId: boolean;
  idDocumentType: string | null;
  checks: IdCheck[];
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter(Boolean);

/**
 * Does the name on the ID match the legal name the homeowner typed?
 * First given name and every part of the surname must appear; middle names and order are ignored.
 */
export function namesMatch(typed: string, idFirst: string, idLast: string): boolean {
  const t = new Set(normalize(typed));
  const first = normalize(idFirst);
  const last = normalize(idLast);
  if (!first.length || !last.length) return false;
  return t.has(first[0]) && last.every((p) => t.has(p));
}

/** Loose address comparison: same house number and first street word, and the same city if the ID shows one. */
export function addressMatches(houseAddress: string, idLine: string | null, idCity: string | null): boolean {
  if (!idLine) return false;
  const h = houseAddress.toLowerCase();
  const [num, street] = idLine.toLowerCase().replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
  if (!num || !street || !/^\d+/.test(num)) return false;
  if (!new RegExp(`\\b${num}\\b`).test(h) || !h.includes(street)) return false;
  return !idCity || h.includes(idCity.toLowerCase());
}

/** "Ontario driver's licence (Ontario)" → "Ontario driver's licence"; a demo sample says so. */
function describeDocument(read: IdRead): string {
  const base = read.documentType?.trim() || (read.isSampleOrSpecimen ? "Sample card" : "Photo ID");
  const issuer = read.issuer && !base.toLowerCase().includes(read.issuer.toLowerCase()) ? ` (${read.issuer})` : "";
  return `${base}${issuer}${read.isSampleOrSpecimen ? ", demo mode" : ""}`;
}

const title = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

export function decideVerification(
  read: IdRead,
  ctx: { legalName: string; houseAddress: string; allowSamples: boolean; today?: Date },
): IdDecision {
  const today = ctx.today ?? new Date();
  const given = read.givenNames?.trim() ?? "";
  const surname = read.surname?.trim() ?? "";
  const expiry = read.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(read.expiryDate) ? new Date(`${read.expiryDate}T23:59:59`) : null;
  const sampleOk = !read.isSampleOrSpecimen || ctx.allowSamples;
  // Demo mode: a generic card marked SAMPLE stands in for a government ID (no real ID needed to demo).
  const demoSample = read.isSampleOrSpecimen && ctx.allowSamples;
  const govOk = read.isGovernmentPhotoId || demoSample;
  const nameOk = namesMatch(ctx.legalName, given, surname);
  const checks: IdCheck[] = [
    { label: "Photo is clear and readable", ok: read.readable },
    { label: demoSample ? "Sample card stands in for a government ID (demo mode)" : "Looks like a government photo ID", ok: govOk },
    ...(demoSample ? [] : [{ label: "Not a sample or specimen", ok: sampleOk }]),
    { label: expiry ? `Not expired (expires ${read.expiryDate})` : "Expiry date readable", ok: !!expiry && expiry >= today },
    { label: `Name matches "${ctx.legalName}"`, ok: nameOk },
  ];
  const fail = (note: string): IdDecision => ({ status: "FAILED", note, verifiedName: null, addressMatchesId: false, idDocumentType: null, checks });

  if (!read.readable) return fail("We couldn't read the ID. Retake the photo flat, in good light, with all four corners visible.");
  if (!sampleOk) return fail("This is a sample or specimen card, not a real ID.");
  if (!govOk) return fail("This doesn't look like a government photo ID (driver's licence, Ontario Photo Card or passport).");
  if (!expiry) return fail("We couldn't read the expiry date. Retake the photo so the dates are sharp.");
  if (expiry < today) return fail(`This ID expired on ${read.expiryDate}.`);
  if (!nameOk) return fail(`The name on the ID (${title(`${given} ${surname}`.trim()) || "unreadable"}) doesn't match "${ctx.legalName}". Fix your legal name on the house page if it's wrong.`);

  return {
    status: "VERIFIED",
    note: null,
    verifiedName: title(`${given.split(/\s+/)[0]} ${surname}`),
    addressMatchesId: addressMatches(ctx.houseAddress, read.addressLine, read.city),
    idDocumentType: describeDocument(read),
    checks,
  };
}
