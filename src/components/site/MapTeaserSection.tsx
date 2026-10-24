import { getTranslations } from "next-intl/server";
import { MapTeaserCanvas } from "./MapTeaserCanvas";
import type { Spot } from "@/lib/types/database";

/**
 * Homepage teaser into /map — the real map, read-only and framed on every
 * pin, with one big button in the middle linking to the full page. Sits on a
 * dark navy band (same tone as the hero's shade) so it reads as the page's
 * one full-contrast moment. The map itself is a client island that only
 * loads when the section nears the viewport (see MapTeaserCanvas), so the
 * homepage stays light.
 */
export async function MapTeaserSection({ spots }: { spots: Spot[] }) {
  const t = await getTranslations("home.mapTeaser");
  const tDiscover = await getTranslations("discover");

  const points = spots
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, lat: s.latitude, lng: s.longitude, category: s.category }));

  return (
    <section className="text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="font-heading mb-8 max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <div className="group relative h-[400px] text-foreground overflow-hidden rounded-[var(--radius-card)] border border-white/10 sm:h-[520px]">
          <MapTeaserCanvas points={points} label={tDiscover("exploreMap")} />
        </div>
      </div>
    </section>
  );
}
