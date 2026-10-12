import { getTranslations } from "next-intl/server";
import { MapTeaserCanvas } from "./MapTeaserCanvas";
import type { Spot } from "@/lib/types/database";

/**
 * Homepage teaser into /map — the real map, read-only and framed on every
 * pin, with one big button in the middle linking to the full page. The map
 * itself is a client island that only loads when the section nears the
 * viewport (see MapTeaserCanvas), so the homepage stays light.
 */
export async function MapTeaserSection({ spots }: { spots: Spot[] }) {
  const t = await getTranslations("home.mapTeaser");
  const tDiscover = await getTranslations("discover");

  const points = spots
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, lat: s.latitude, lng: s.longitude }));

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h2 className="font-heading mb-6 text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
      <div className="card-lift group relative h-[400px] overflow-hidden rounded-[var(--radius-card)] border border-border sm:h-[480px]">
        <MapTeaserCanvas points={points} label={tDiscover("exploreMap")} />
      </div>
    </section>
  );
}
