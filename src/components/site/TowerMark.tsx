/**
 * The Casco Viejo bell-tower mark (/public/hero-tower.svg) as a CSS mask, so
 * it takes `currentColor` — tint it with a text-* class, soften it with
 * opacity. Purely ornamental: aria-hidden, no pointer events. The parent must
 * be `relative isolate` (and usually `overflow-hidden`); position and size it
 * via className. Sibling of Foliage.tsx.
 */
export function TowerMark({ className = "" }: { className?: string }) {
  const url = "url(/hero-tower.svg)";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -z-10 select-none bg-current ${className}`}
      style={{
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
