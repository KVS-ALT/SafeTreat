/**
 * Demo data for central Brampton, Ontario (about 3 × 3.5 km around downtown). Run with `npm run db:seed`.
 * House positions are spaced along real OpenStreetMap streets (one per ~320 m cell); house numbers are made up.
 */
import { PrismaClient, type House } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CANDY_ALLERGENS, ALLERGEN_CODES, type Candy } from "../src/lib/allergens";
import { matchTripToReports } from "../src/lib/matching";
import { haversine } from "../src/lib/geo";
import { valhallaRoute } from "../src/lib/routing";

const db = new PrismaClient();
const SEED_INCIDENT_TTL_H = Number(process.env.SEED_INCIDENT_TTL_HOURS ?? 48);
type Spot = { address: string; lat: number; lng: number; street: string };
const spots: Spot[] = JSON.parse(readFileSync(join(__dirname, "seed-houses.json"), "utf8"));

// Small deterministic PRNG so every seed run gives the same neighbourhood.
let s = 42;
const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const SURNAMES = ["Garcia", "Nguyen", "Okafor", "Miller", "Rivera", "Patel", "Kowalski", "Johnson", "Haddad", "Lee", "O'Brien", "Schmidt",
  "Yamamoto", "Anderson", "Dubois", "Hernandez", "Cohen", "Bianchi", "Murphy", "Sato", "Rossi", "Kim", "Mendoza", "Fischer", "Abebe",
  "Novak", "Singh", "Walsh", "Lindqvist", "Moreau", "Brooks", "Alvarez", "Chen", "Osei", "Kaur", "Petrov", "Silva", "Hughes", "Tanaka",
  "Mwangi", "Larsen", "Ortiz", "Romano", "Byrne", "Ivanova", "Park", "Mensah", "Costa", "Weber", "Sharma", "Reyes", "Quinn", "Nakamura",
  "Adeyemi", "Horvat", "Farouk", "Jensen", "Delgado", "Wright", "Ahmed", "Kovacs", "Bauer", "Lopez", "Morales"];
const FIRST = ["Maria", "Linh", "Chidi", "Sarah", "Jose", "Priya", "Anna", "Mark", "Rami", "Grace", "Sean", "Jonas", "Aiko", "Erik", "Claire",
  "Luis", "Rachel", "Marco", "Kate", "Ken", "Gina", "Daniel", "Ana", "Lena", "Hanna", "Petr", "Harpreet", "Niamh", "Elsa", "Paul", "Tasha",
  "Diego", "Wei", "Kwame", "Simran", "Olga", "Tomas", "Fatima", "Yuki", "Amara"];

const displayName = (last: string) => pick([`The ${last}s`, `The ${last} family`, `Casa ${last}`, `The ${last} house`]);

const BUNDLES: string[][] = [
  ["Skittles", "Starburst", "Dum Dums"],
  ["Coffee Crisp", "Kit Kat", "Aero"],
  ["Rockets", "Nerds", "Jolly Rancher"],
  ["Smarties", "Twix", "Caramilk"],
  ["Maynards Sour Patch Kids", "Maynards Swedish Berries", "Skittles"],
  ["Reese's", "Oh Henry!", "Mr. Big"],
  ["Ketchup chips", "Glosette", "Mars"],
  ["Twizzlers", "Airheads", "Starburst"],
  ["Peanut M&M's", "Crispy Crunch", "Snickers"],
  ["Dum Dums", "Rockets", "Glow sticks"],
];

function allergenFreeFor(candies: Candy[]) {
  const contained = new Set(candies.flatMap((c) => CANDY_ALLERGENS[c.name] ?? []));
  return ALLERGEN_CODES.filter((a) => !contained.has(a) && rand() < 0.85);
}

async function main() {
  console.log("Clearing old data…");
  await db.alert.deleteMany();
  await db.trackPoint.deleteMany();
  await db.trip.deleteMany();
  await db.report.deleteMany();
  await db.house.deleteMany();
  await db.user.deleteMany();

  const demoPw = await bcrypt.hash(process.env.DEMO_PASSWORD || "trickortreat", 10);
  const lockedPw = await bcrypt.hash(`locked-${Math.random()}`, 4);

  const parent = await db.user.create({ data: { username: "demo", passwordHash: demoPw, role: "PARENT", childAllergens: JSON.stringify(["PEANUT"]) } });
  const homeowner = await db.user.create({ data: { username: "demo-home", passwordHash: demoPw, role: "HOMEOWNER" } });

  console.log(`Creating ${spots.length} houses…`);
  const houses: House[] = [];
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const owner = i === 0 ? homeowner : await db.user.create({ data: { username: `neighbour-${i}`, passwordHash: lockedPw, role: "HOMEOWNER" } });
    const last = SURNAMES[i % SURNAMES.length];
    const legal = `${FIRST[(i * 7) % FIRST.length]} ${last}`;
    const bundle = BUNDLES[Math.floor(rand() * BUNDLES.length)];
    const candies: Candy[] = bundle.map((name) => ({ name, wrapped: true, homemade: false }));
    if (rand() < 0.08) candies.push({ name: "Homemade pumpkin cookies", wrapped: false, homemade: true });
    const verified = i !== 0 && rand() < 0.55;
    houses.push(await db.house.create({
      data: {
        ownerId: owner.id,
        displayName: `${displayName(last)} ${pick(["🎃", "👻", "🦇", "🕸️", "🍭"])}`,
        legalName: legal,
        address: spot.address,
        lat: spot.lat,
        lng: spot.lng,
        candies: JSON.stringify(candies),
        allergenFree: JSON.stringify(allergenFreeFor(candies)),
        nonFoodTreats: bundle.includes("Glow sticks") || rand() < 0.15,
        hoursStart: pick(["17:00", "17:30", "18:00"]),
        hoursEnd: pick(["20:00", "20:30", "21:00"]),
        verificationStatus: verified ? "VERIFIED" : "UNVERIFIED",
        verifiedName: verified ? legal : null,
        verifiedAt: verified ? new Date() : null,
        addressMatchesId: verified && rand() < 0.7,
      },
    }));
  }

  // Spread reports out: farthest-point sampling over the houses, at least 450 m apart.
  const center = { lat: 43.6835, lng: -79.7615 };
  const byCenter = [...houses].sort((a, b) => haversine(a, center) - haversine(b, center));
  const sites: House[] = [byCenter[0]];
  while (sites.length < 12) {
    let best: House | null = null, bestD = 0;
    for (const h of houses) {
      const d = Math.min(...sites.map((x) => haversine(x, h)));
      if (d > bestD && haversine(h, center) < 1700) { bestD = d; best = h; }
    }
    if (!best || bestD < 450) break;
    sites.push(best);
  }
  // Incidents happen on the street, not at the door: nudge them ~25 m off the house.
  const street = (h: House) => ({ lat: h.lat + 0.0002, lng: h.lng + 0.0001 });
  const road = (h: House) => h.address.split(",")[0].replace(/^\d+\s+/, "");

  const ago = (min: number) => new Date(Date.now() - min * 60000);

  type R = { type: "CANDY" | "INCIDENT"; title: string; description: string; placeName: string; candyDescription?: string;
    severity: number; category: string; aiSummary: string; lat: number; lng: number; minutesAgo: number; flag?: House };
  const T: ((h: House) => R)[] = [
    (h) => ({ type: "CANDY", title: "Chocolate bar with a pinhole in the wrapper", description: "Found a tiny hole in a fun-size bar, looked like something poked through.", placeName: h.address,
      candyDescription: "Fun-size Snickers, hole near the seam", severity: 5, category: "foreign_object", aiSummary: "A fun-size chocolate bar with a punctured wrapper was handed out here; check bags for pierced wrappers.", lat: h.lat, lng: h.lng, minutesAgo: 50, flag: h }),
    (h) => ({ type: "INCIDENT", title: "Car speeding past groups of kids", description: "Grey SUV doing at least 40 down the block, didn't slow for the crowd at the corner.", placeName: road(h),
      severity: 4, category: "traffic", aiSummary: "A vehicle was reported speeding past trick-or-treaters; use crosswalks and stay on the sidewalk.", ...street(h), minutesAgo: 20 }),
    (h) => ({ type: "CANDY", title: "Gummies that look like cannabis edibles", description: "Bag of gummy bears in plain packaging labelled with a leaf logo.", placeName: "Party at " + h.address,
      candyDescription: "Clear bag of gummy bears, green leaf sticker", severity: 5, category: "drugs_or_edibles", aiSummary: "Gummies resembling cannabis edibles were given out at a house party; do not let children eat unbranded gummies.", lat: h.lat, lng: h.lng, minutesAgo: 95, flag: h }),
    (h) => ({ type: "INCIDENT", title: "Adult following groups of children", description: "Man in a hooded costume without kids has been walking behind several groups for 20 minutes.", placeName: road(h),
      severity: 4, category: "suspicious_person", aiSummary: "An adult without children was reported following groups of trick-or-treaters; stay with your group.", ...street(h), minutesAgo: 15 }),
    (h) => ({ type: "CANDY", title: "'Peanut-free' bag had Reese's inside", description: "Sign said nut-free treats but the bag had peanut butter cups. My son is allergic.", placeName: h.address,
      candyDescription: "Orange treat bag labelled nut-free", severity: 4, category: "allergen_mislabel", aiSummary: "Treat bags labelled nut-free contained peanut butter cups; parents of allergic kids should check carefully.", lat: h.lat, lng: h.lng, minutesAgo: 30, flag: h }),
    (h) => ({ type: "INCIDENT", title: "Loose aggressive dog", description: "Large dog off leash barking and lunging at kids near the corner.", placeName: road(h),
      severity: 3, category: "injury", aiSummary: "A loose, aggressive dog was reported near the corner.", ...street(h), minutesAgo: 35 }),
    (h) => ({ type: "INCIDENT", title: "Broken porch steps, no lights", description: "Steps are cracked and it's pitch dark, a kid tripped.", placeName: h.address,
      severity: 2, category: "injury", aiSummary: "Dark porch with broken steps; a child tripped here.", lat: h.lat, lng: h.lng, minutesAgo: 60 }),
    (h) => ({ type: "CANDY", title: "Unwrapped homemade brownies", description: "Loose brownies in a bowl, no label or ingredient list.", placeName: h.address,
      candyDescription: "Brownie squares, no wrapping", severity: 3, category: "homemade_unlabeled", aiSummary: "Unwrapped homemade brownies with no ingredient list were offered here.", lat: h.lat, lng: h.lng, minutesAgo: 140, flag: h }),
    (h) => ({ type: "INCIDENT", title: "Eggs thrown at kids", description: "Teens in a car threw eggs at a group of younger kids.", placeName: road(h),
      severity: 3, category: "vandalism", aiSummary: "Eggs were thrown from a passing car at children.", ...street(h), minutesAgo: 70 }),
    (h) => ({ type: "INCIDENT", title: "Fireworks set off on the sidewalk", description: "Group of teens lighting firecrackers right where kids are walking.", placeName: road(h),
      severity: 4, category: "injury", aiSummary: "Firecrackers were being set off on a busy sidewalk; give the area a wide berth.", ...street(h), minutesAgo: 25 }),
    (h) => ({ type: "CANDY", title: "Lollipop wrapper looked resealed", description: "Wrapper was twisted shut by hand and the candy looked scratched.", placeName: h.address,
      candyDescription: "Red lollipop, hand-twisted wrapper", severity: 4, category: "tampered_wrapper", aiSummary: "A lollipop with a hand-resealed wrapper was handed out here; check for twisted or loose wrappers.", lat: h.lat, lng: h.lng, minutesAgo: 80, flag: h }),
    (h) => ({ type: "INCIDENT", title: "No sidewalk, cars parked on both sides", description: "Kids are walking in the road because of parked cars and no sidewalk.", placeName: road(h),
      severity: 3, category: "traffic", aiSummary: "Kids are walking in the roadway here; hold hands and use a flashlight.", ...street(h), minutesAgo: 45 }),
  ];
  const reports: R[] = sites.map((h, i) => T[i % T.length](h));

  console.log(`Creating ${reports.length} reports…`);
  for (const r of reports) {
    const { minutesAgo, flag, ...data } = r;
    await db.report.create({
      data: {
        ...data, aiSource: "gemma", occurredAt: ago(minutesAgo), createdAt: ago(minutesAgo),
        // 48 h, so data seeded in the morning still shows at an evening demo.
        expiresAt: r.type === "INCIDENT" ? new Date(Date.now() + SEED_INCIDENT_TTL_H * 3600000) : null,
      },
    });
    if (flag) await db.house.update({ where: { id: flag.id }, data: { safetyFlag: "REPORTED" } });
  }

  // A finished trip from earlier tonight that walked past the first candy report, so the inbox has an alert.
  const target = sites[0];
  const nearby = [...houses].filter((h) => h.id !== target.id).sort((a, b) => haversine(a, target) - haversine(b, target)).slice(0, 4);
  const stopsOnWay = [nearby[0], nearby[1], target, nearby[2], nearby[3]];
  const path = stopsOnWay.map((h) => ({ lat: h.lat, lng: h.lng, label: h.address }));
  // Walk real streets for the fake GPS track (falls back to straight lines if the router is down).
  let pts: { lat: number; lng: number }[];
  try {
    const walked = await valhallaRoute(path, []);
    const coords = walked.line.geometry.coordinates;
    const step = Math.max(1, Math.floor(coords.length / 60));
    pts = coords.filter((_, i) => i % step === 0 || i === coords.length - 1).map(([lng, lat]) => ({ lat, lng }));
  } catch {
    pts = [];
    for (let i = 1; i < path.length; i++) {
      for (let k = 0; k < 6; k++) pts.push({ lat: path[i - 1].lat + ((path[i].lat - path[i - 1].lat) * k) / 6, lng: path[i - 1].lng + ((path[i].lng - path[i - 1].lng) * k) / 6 });
    }
    pts.push(path[path.length - 1]);
  }
  const start = ago(120);
  const trip = await db.trip.create({
    data: {
      userId: parent.id, name: "Early loop with Maya", status: "DONE", startedAt: start, endedAt: ago(75),
      plannedRoute: JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map((p) => [p.lng, p.lat]) } }),
      waypoints: JSON.stringify(stopsOnWay.map((h, i) => ({ lat: h.lat, lng: h.lng, label: i === 0 ? "Home" : h.address }))),
      points: { create: pts.map((p, i) => ({ ...p, recordedAt: new Date(start.getTime() + (i * 45 * 60000) / pts.length) })) },
    },
  });
  // Template text only, so seeding never depends on the model being up.
  const created = await matchTripToReports(trip.id);
  console.log(`Seeded trip with ${created.length} alert(s).`);
  console.log(`\nDone. Log in as "demo" (parent) or "demo-home" (homeowner) with password from DEMO_PASSWORD.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
