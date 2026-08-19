"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SpotCard } from "./SpotCard";
import { EventCard } from "./EventCard";
import type { EventRow, Spot } from "@/lib/types/database";

/**
 * Bottom-of-page "keep browsing" block for a spot or event detail page:
 * "related events" / "nearby spots" rails. The CTA back to the full map
 * lives right under the MiniMap in the aside instead — see ExploreMapCard.
 * Either rail can be empty and just doesn't render; if both are empty there's
 * nothing to show at all.
 */
export function NearbySection({
  nearbySpots = [],
  nearbyEvents = [],
}: {
  nearbySpots?: Spot[];
  nearbyEvents?: EventRow[];
}) {
  const t = useTranslations("discover");
  const router = useRouter();

  if (nearbySpots.length === 0 && nearbyEvents.length === 0) return null;

  return (
    <div className="mt-12 space-y-10 border-t border-border pt-8 sm:mt-16 sm:pt-10">
      {nearbyEvents.length > 0 && (
        <section>
          <h2 className="font-heading mb-4 text-xl font-extrabold">{t("relatedEvents")}</h2>
          <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {nearbyEvents.map((event) => (
              <div key={event.id} className="w-[320px] shrink-0 sm:w-[360px]">
                <EventCard event={event} />
              </div>
            ))}
          </div>
        </section>
      )}

      {nearbySpots.length > 0 && (
        <section>
          <h2 className="font-heading mb-4 text-xl font-extrabold">{t("nearbySpots")}</h2>
          <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {nearbySpots.map((spot) => (
              <div key={spot.id} className="w-[240px] shrink-0 sm:w-[260px]">
                <SpotCard
                  spot={spot}
                  onClick={() =>
                    router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } })
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
