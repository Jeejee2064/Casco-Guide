import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { MapExplorerSection } from "@/components/site/MapExplorerSection";
import { getSpots } from "@/lib/data/spots";
import { buildAlternates } from "@/lib/seo/alternates";
import { SITE_NAME, ogLocaleOf } from "@/lib/seo/site";
import { SPOT_VIBES } from "@/lib/vibes";
import type { Locale } from "@/i18n/routing";
import type { SpotVibe } from "@/lib/types/database";

// Only a recognized SpotVibe id is honored — anything else (a typo'd or
// stale link) just falls back to "no vibe pre-selected" instead of crashing.
// Same as /spots/page.tsx's parseVibe.
function parseVibe(value: string | string[] | undefined): SpotVibe | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && (SPOT_VIBES as readonly string[]).includes(v) ? (v as SpotVibe) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "seo.map" });
  const alternates = buildAlternates("/map", locale);
  return {
    title: t("title"),
    description: t("description"),
    alternates,
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: alternates?.canonical as string,
      siteName: SITE_NAME,
      locale: ogLocaleOf(locale),
      type: "website",
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
  };
}

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;

  // Events omitted, same as the old home page's ExploreSection — hidden
  // site-wide for now (see AGENTS note), not specific to this page.
  const spots = await getSpots(locale);

  // Powers the homepage vibe teaser: each mood card deep-links a specific
  // vibe (?vibe=<id>), the general "Discover your vibe" CTA instead opens
  // the picker with nothing chosen yet (?mode=vibes&vibesModal=1) — read
  // here, server-side, same reasoning as /spots's own ?vibe=/?mode= parsing.
  const vibe = parseVibe(sp.vibe);
  const initialMode = vibe || sp.mode === "vibes" ? "vibes" : "classic";
  const autoOpenVibesModal = sp.vibesModal === "1";

  // SpotDetailView's "Get directions" button, instead of opening Google
  // Maps directly — see MapExplorerSection/SpotMap's itinerary mode.
  const directionsSlugParam = Array.isArray(sp.directions) ? sp.directions[0] : sp.directions;
  const initialDirectionsSlug = directionsSlugParam ?? null;

  return (
    <>
      <Header />
      {/* No Footer here — SpotMap's `fullScreen` mode is `position: fixed`,
          covering the viewport below the header on its own (the same way it
          already did as the "map" branch of the old ExploreSection), so a
          footer underneath would only ever be reachable if fullScreen were
          ever turned off. `main` still wraps it for the usual landmark
          structure — the fixed positioning ignores it either way. */}
      <main className="flex-1">
        <MapExplorerSection
          spots={spots}
          initialMode={initialMode}
          initialVibes={vibe ? [vibe] : []}
          autoOpenVibesModal={autoOpenVibesModal}
          initialDirectionsSlug={initialDirectionsSlug}
        />
      </main>
    </>
  );
}
