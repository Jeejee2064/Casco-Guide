import { getTranslations } from "next-intl/server";
import { MapIcon, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Homepage teaser into /map — just a static image of the map (pre-rendered
 * from the basemap geojson into /map/preview.svg) linking to the real map
 * page, so the homepage doesn't load Leaflet or any of SpotMap's code.
 */
export async function MapTeaserSection() {
  const t = await getTranslations("home.mapTeaser");
  const tDiscover = await getTranslations("discover");

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h2 className="font-heading mb-6 text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
      <Link
        href="/map"
        className="card-lift group relative block h-[400px] overflow-hidden rounded-[var(--radius-card)] border border-border sm:h-[480px]"
      >
        {/* eslint-disable @next/next/no-img-element */}
        <img
          src="/map/preview.svg"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover [html[data-night]_&]:hidden"
        />
        <img
          src="/map/preview-night.svg"
          alt=""
          loading="lazy"
          className="hidden h-full w-full object-cover [html[data-night]_&]:block"
        />
        {/* eslint-enable @next/next/no-img-element */}
        <span className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface/95 p-4 shadow-lg backdrop-blur">
          <span className="brand-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
            <MapIcon size={20} />
          </span>
          <span className="font-heading min-w-0 flex-1 font-bold">{tDiscover("exploreMap")}</span>
          <ArrowRight size={18} className="shrink-0 text-foreground/40" />
        </span>
      </Link>
    </section>
  );
}
