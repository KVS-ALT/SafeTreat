import { gridPath } from "./Icon";

// 12×12 pumpkin sprite for Pixel Patrol: g = stem, o = body, d = shade, k = face.
const SPRITE = [
  ".....gg.....",
  "......g.....",
  "..oooooooo..",
  ".ooodoodooo.",
  "oookkookkooo",
  "oookkookkooo",
  "oooodoodoooo",
  "ookkkkkkkkoo",
  "ooodkdkkdooo",
  ".oooodoooo..",
  "..oooooooo..",
  "............",
];
const COLORS: Record<string, string> = { g: "#5ee08a", o: "#ff8a1f", d: "#d9661a", k: "#241303" };

/** Brand mark: a line-drawn pumpkin, or the pixel sprite under the Pixel Patrol design. */
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex" aria-hidden>
      <svg className="icon-line" width={size} height={size} viewBox="0 0 32 32">
        <path d="M16 8c-1-3 1-5 3-5" fill="none" stroke="var(--safe)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 8c-4.5-2-11 0-12 8.5C3 25 9 29 16 29s13-4 12-12.5C27 8 20.5 6 16 8Z" fill="var(--accent)" />
        <path d="M16 8c-2.5 2-3.5 6-3.5 10.5S14 27 16 29M16 8c2.5 2 3.5 6 3.5 10.5S18 27 16 29" fill="none" stroke="var(--accent-ink)" strokeOpacity=".28" strokeWidth="1.4" />
        <path d="M10 15.5l2.6-2.2 1 3.2Zm12 0-2.6-2.2-1 3.2ZM10 21c3.5 2.6 8.5 2.6 12 0-1.6 3.6-10.4 3.6-12 0Z" fill="var(--accent-ink)" />
      </svg>
      <svg className="icon-pixel" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges">
        {Object.entries(COLORS).map(([c, fill]) => <path key={c} d={gridPath(SPRITE, c)} fill={fill} />)}
      </svg>
    </span>
  );
}
