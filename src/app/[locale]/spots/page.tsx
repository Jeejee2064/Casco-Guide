import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/site/JsonLd";
import { SpotsExplorerSection } from "@/components/site/SpotsExplorerSection";
import { getSpots } from "@/lib/data/spots";
import { getPathname } from "@/i18n/navigation";
import { buildAlternates } from "@/lib/seo/alternates";
import { collectionSchema } from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";
import { socialMetadata } from "@/lib/seo/metadata";
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
    ...socialMetadata({
      locale,
      title: t("title"),
      description: t("description"),
      url: alternates?.canonical as string,
    }),
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

  const [spots, tSeo] = await Promise.all([
    getSpots(locale),
    getTranslations({ locale, namespace: "seo.spots" }),
  ]);

  // Powers the homepage vibe teaser's deep links (?vibe=romantic_sunset) and
  // the general "Discover your vibe" CTA (?mode=vibes&vibesModal=1, no vibe
  // picked yet, VibesModal popped open right away) — read here, server-side,
  // rather than via useSearchParams() client-side, so opening straight into
  // vibes mode doesn't need its own Suspense boundary the way the old
  // `?view=map` toggle used to. Same params /map's page.tsx reads.
  const vibe = parseVibe(sp.vibe);
  // Vibes is the default filter mode — only an explicit ?mode=classic (the
  // Classic toggle's own link, if it ever needs one) opts back out.
  const initialMode = sp.mode === "classic" ? "classic" : "vibes";
  const autoOpenVibesModal = sp.vibesModal === "1";
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const initialQuery = (q ?? "").slice(0, 80);

  return (
    <>
      <JsonLd
        data={collectionSchema({
          name: tSeo("title"),
          description: tSeo("description"),
          url: buildAlternates("/spots", locale)!.canonical as string,
          items: spots.map((spot) => ({
            name: spot.name,
            url: absoluteUrl(
              getPathname({ href: { pathname: "/spots/[slug]", params: { slug: spot.slug } }, locale }),
            ),
          })),
        })}
      />
      <Header />
      <main className="relative isolate flex-1 overflow-clip">
        <FoliageTrail seed="spots" />
        <h1 className="sr-only">{tSeo("h1")}</h1>
        <SpotsExplorerSection
          spots={spots}
          initialMode={initialMode}
          initialVibes={vibe ? [vibe] : []}
          autoOpenVibesModal={autoOpenVibesModal}
          initialQuery={initialQuery}
        />
      </main>
      <Footer />
    </>
  );
}
