export const ALLERGENS = [
  { code: "PEANUT", label: "Peanuts" },
  { code: "TREE_NUT", label: "Tree nuts" },
  { code: "MILK", label: "Milk / dairy" },
  { code: "EGG", label: "Egg" },
  { code: "WHEAT_GLUTEN", label: "Wheat / gluten" },
  { code: "SOY", label: "Soy" },
  { code: "SESAME", label: "Sesame" },
  { code: "COCONUT", label: "Coconut" },
] as const;

export type AllergenCode = (typeof ALLERGENS)[number]["code"];
export const ALLERGEN_CODES = ALLERGENS.map((a) => a.code) as AllergenCode[];
export const allergenLabel = (code: string) => ALLERGENS.find((a) => a.code === code)?.label ?? code;

/**
 * Rough brand -> allergen table (Canadian recipes) for the offline fallback and quick-pick list.
 * Recipes vary by country and size; this is a helper, not medical advice.
 * Note: Canadian "Smarties" are candy-coated milk chocolate; the US sugar candy is sold here as "Rockets".
 */
export const CANDY_ALLERGENS: Record<string, AllergenCode[]> = {
  "Coffee Crisp": ["MILK", "WHEAT_GLUTEN", "SOY"],
  "Aero": ["MILK", "SOY"],
  "Mr. Big": ["PEANUT", "MILK", "WHEAT_GLUTEN", "SOY"],
  "Caramilk": ["MILK", "SOY"],
  "Oh Henry!": ["PEANUT", "MILK", "SOY"],
  "Crispy Crunch": ["PEANUT", "MILK", "SOY"],
  "Smarties": ["MILK", "WHEAT_GLUTEN", "SOY"],
  "Rockets": [],
  "Reese's": ["PEANUT", "MILK", "SOY"],
  "Snickers": ["PEANUT", "MILK", "EGG", "SOY"],
  "Peanut M&M's": ["PEANUT", "MILK", "SOY"],
  "M&M's": ["MILK", "SOY"],
  "Kit Kat": ["MILK", "WHEAT_GLUTEN", "SOY"],
  "Twix": ["MILK", "WHEAT_GLUTEN", "SOY"],
  "Mars": ["MILK", "EGG", "SOY"],
  "Glosette": ["MILK", "SOY"],
  "Maynards Swedish Berries": [],
  "Maynards Sour Patch Kids": [],
  "Skittles": [],
  "Starburst": [],
  "Nerds": [],
  "Dum Dums": [],
  "Jolly Rancher": [],
  "Airheads": ["SOY"],
  "Twizzlers": ["WHEAT_GLUTEN", "SOY"],
  "Tootsie Pops": ["MILK", "SOY"],
  "Candy Corn": ["EGG"],
  "Ketchup chips": ["MILK"],
  "Pretzels": ["WHEAT_GLUTEN"],
  "Goldfish": ["MILK", "WHEAT_GLUTEN"],
  "Glow sticks": [],
  "Stickers": [],
  "Pencils": [],
};

export const NON_FOOD = new Set(["Glow sticks", "Stickers", "Pencils"]);

export type Candy = { name: string; wrapped: boolean; homemade: boolean };

/** Find which allergens a candy name likely contains (case-insensitive substring match). */
export function knownAllergens(name: string): AllergenCode[] | null {
  const n = name.toLowerCase().replace(/[’']/g, "'");
  // Prefer the longest matching brand so "Peanut M&M's" wins over "M&M's".
  const hit = Object.keys(CANDY_ALLERGENS)
    .filter((k) => n.includes(k.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (hit) return CANDY_ALLERGENS[hit];
  const out: AllergenCode[] = [];
  if (/peanut/.test(n)) out.push("PEANUT");
  if (/almond|cashew|hazelnut|pecan|walnut|pistachio|nutella/.test(n)) out.push("TREE_NUT");
  if (/milk|chocolate|caramel|fudge|cheese/.test(n)) out.push("MILK");
  if (/cookie|wafer|pretzel|cracker|brownie|cupcake/.test(n)) out.push("WHEAT_GLUTEN");
  if (/coconut/.test(n)) out.push("COCONUT");
  if (/sesame|halva/.test(n)) out.push("SESAME");
  return out.length ? out : null;
}

export type AllergenConflict = { candy: string; allergen: AllergenCode };

/** Candies that contain an allergen the house claims to be free of (keyword table only). */
export function findAllergenConflicts(candies: Candy[], allergenFree: string[]): AllergenConflict[] {
  const out: AllergenConflict[] = [];
  for (const c of candies) {
    for (const a of knownAllergens(c.name) ?? []) {
      if (allergenFree.includes(a)) out.push({ candy: c.name, allergen: a });
    }
  }
  return out;
}

/**
 * Why a house is unsafe for a child with these allergies, or null if it looks fine.
 * A house counts as safe if it says it is free of every one of the child's allergens,
 * or if it offers non-food treats.
 */
export function houseConflictReason(
  house: { candies: Candy[]; allergenFree: string[]; nonFoodTreats: boolean },
  childAllergens: string[],
): string | null {
  if (childAllergens.length === 0) return null;
  if (house.nonFoodTreats) return null;
  for (const c of house.candies) {
    const hits = (knownAllergens(c.name) ?? []).filter((a) => childAllergens.includes(a));
    if (hits.length) return `hands out ${c.name} (${hits.map(allergenLabel).join(", ").toLowerCase()})`;
    if (c.homemade) return `hands out homemade ${c.name} (ingredients unknown)`;
  }
  const missing = childAllergens.filter((a) => !house.allergenFree.includes(a));
  if (missing.length) return `hasn't confirmed it's free of ${missing.map(allergenLabel).join(", ").toLowerCase()}`;
  return null;
}
