/** The four SafeTreat designs. Tokens live in design-systems/<id>/tokens.css. */
export const THEMES = [
  {
    id: "nightfall",
    name: "Nightfall",
    tagline: "Precise and calm. Near-black, one pumpkin accent.",
    basedOn: "linear-app",
    fonts: "Geist · Geist Mono",
    swatches: ["#09090c", "#18181f", "#f4f4f6", "#f2762e", "#f0525f", "#3fcf8e"],
  },
  {
    id: "porchlight",
    name: "Porchlight",
    tagline: "Warm paper and serif headlines, for planning in daylight.",
    basedOn: "warm-editorial",
    fonts: "Fraunces · DM Sans",
    swatches: ["#f7f2ea", "#fffdf9", "#1c1a17", "#c0512f", "#b42318", "#2f7d5b"],
  },
  {
    id: "candy",
    name: "Candy Shop",
    tagline: "Neobrutalist. Ink outlines and buttons you can feel.",
    basedOn: "neobrutalism",
    fonts: "Bricolage Grotesque · Space Grotesk",
    swatches: ["#fff4d6", "#ffeebd", "#1d1b26", "#ff8a1f", "#e5383b", "#1f9d55"],
  },
  {
    id: "pixel",
    name: "Pixel Patrol",
    tagline: "A 1994 handheld monster tracker. Inspired by Spidey Tracker.",
    basedOn: "retro + dithered",
    fonts: "Silkscreen · Pixelify Sans · Bitcount",
    swatches: ["#13265c", "#0e1c3b", "#dff6ff", "#ffb347", "#ff5a5f", "#5ee08a"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "nightfall";
export const THEME_COOKIE = "safetreat_theme";

export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);
export const themeById = (id: ThemeId) => THEMES.find((t) => t.id === id)!;

/** One keyless tile source; each design restyles it with its --tile-filter token. */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
