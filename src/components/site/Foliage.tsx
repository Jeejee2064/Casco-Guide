type FoliageName = "monstera" | "palme" | "bamboo" | "heliconia";

/**
 * Decorative tropical silhouette (from /public/foliage). Rendered as a CSS
 * mask so the shape takes `currentColor` — recolor it with a text-* class,
 * soften it with opacity. Purely ornamental: aria-hidden, no pointer events.
 * The parent must be `relative isolate` (so -z-10 stays above its own background) and usually `overflow-hidden`; position and
 * size it via className.
 */
export function Foliage({
  name,
  className = "",
  style,
}: {
  name: FoliageName;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url = `url(/foliage/${name}.svg)`;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -z-10 select-none bg-current ${className}`}
      style={{
        ...style,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

const NAMES: FoliageName[] = ["monstera", "palme", "bamboo", "heliconia"];

// Small deterministic PRNG seeded from a string, so a given page always gets
// the same arrangement (no hydration mismatch, no flicker between visits) but
// different pages get different ones.
function rngFrom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Static class strings (Tailwind can't see dynamically built ones).
const SIDE = {
  right: "-right-20 sm:-right-10",
  left: "-left-24 sm:-left-12",
} as const;
const SIZE = [
  "h-[16rem] w-[16rem] sm:h-[24rem] sm:w-[24rem]",
  "h-[18rem] w-[18rem] sm:h-[28rem] sm:w-[28rem]",
  "h-[20rem] w-[20rem] sm:h-[30rem] sm:w-[30rem]",
] as const;
const TONE = ["text-[var(--foliage)]", "text-[var(--foliage-green)]"] as const;
// Vertical bands (% of the parent's height) — one item per band, jittered
// inside it, so silhouettes never stack on each other.
const BANDS: [number, number][] = [
  [3, 12],
  [42, 54],
  [80, 88],
];

export function pickFoliageName(seed: string): FoliageName {
  return NAMES[Math.floor(rngFrom(seed)() * NAMES.length)];
}

// Three silhouettes down the height of a long page, arranged differently per
// `seed` (plant, side, size, tilt, mirroring, tone, vertical spot). The parent
// must be `relative isolate overflow-clip`.
export function FoliageTrail({ seed }: { seed: string }) {
  const rnd = rngFrom(seed);
  const names = [...NAMES].sort(() => rnd() - 0.5).slice(0, 3);
  const startRight = rnd() < 0.5;
  const toneStart = Math.floor(rnd() * 2);
  return (
    <>
      {names.map((name, i) => {
        const side = (i % 2 === 0) === startRight ? "right" : "left";
        const [lo, hi] = BANDS[i];
        return (
          <Foliage
            key={name}
            name={name}
            className={`${SIDE[side]} ${SIZE[Math.floor(rnd() * SIZE.length)]} ${TONE[(toneStart + i) % 2]}`}
            style={{
              top: `${lo + rnd() * (hi - lo)}%`,
              rotate: `${Math.round((rnd() - 0.5) * 40)}deg`,
              scale: rnd() < 0.5 ? "-1 1" : "1 1",
            }}
          />
        );
      })}
    </>
  );
}
