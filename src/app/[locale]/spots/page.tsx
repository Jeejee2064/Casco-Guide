import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SpotsExplorerSection } from "@/components/site/SpotsExplorerSection";
import { getSpots } from "@/lib/data/spots";
import { buildAlternates } from "@/lib/seo/alternates";
import { SITE_NAME, ogLocaleOf } from "@/lib/seo/site";
import { SPOT_VIBES } from "@/lib/vibes";
import type { Locale } from "@/i18n/routing";
import type { SpotVibe } from "@/lib/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "seo.spots" });
  const alternates = buildAlternates("/spots", locale);
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

// Only a recognized SpotVibe id is honored — anything else (a typo'd or
// stale link) just falls back to "no vibe pre-selected" instead of crashing.
function parseVibe(value: string | string[] | undefined): SpotVibe | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && (SPOT_VIBES as readonly string[]).includes(v) ? (v as SpotVibe) : null;
}

export default async function SpotsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;

  const spots = await getSpots(locale);

  // Powers the homepage vibe teaser's deep links (?vibe=romantic_sunset) and
  // the general "Discover your vibe" CTA (?mode=vibes, no vibe picked yet) —
  // read here, server-side, rather than via useSearchParams() client-side,
  // so opening straight into vibes mode doesn't need its own Suspense
  // boundary the way the old `?view=map` toggle used to.
  const vibe = parseVibe(sp.vibe);
  const initialMode = vibe || sp.mode === "vibes" ? "vibes" : "classic";

  return (
    <>
      <Header />
      <main className="flex-1">
        <SpotsExplorerSection
          spots={spots}
          initialMode={initialMode}
          initialVibes={vibe ? [vibe] : []}
        />
      </main>
      <Footer />
    </>
  );
}
