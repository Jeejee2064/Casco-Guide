import { getTranslations } from "next-intl/server";
import { SpotMap } from "./SpotMap";
import { ExploreMapCard } from "./ExploreMapCard";
import type { Spot } from "@/lib/types/database";

/**
 * Homepage teaser into /map — a compact, non-fullscreen SpotMap (same
 * "preview" usage ArticleDetailView already makes of it) plus the existing
 * ExploreMapCard CTA, rather than a bespoke map widget.
 */
export async function MapTeaserSection({ spots }: { spots: Spot[] }) {
  const t = await getTranslations("home.mapTeaser");

  if (spots.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h2 className="font-heading mb-6 text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
      <div className="space-y-4">
        <SpotMap spots={spots} heightClassName="h-[400px] sm:h-[480px]" />
        <ExploreMapCard />
      </div>
    </section>
  );
}
