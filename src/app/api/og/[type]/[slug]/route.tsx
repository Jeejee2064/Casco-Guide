import { getTranslations } from "next-intl/server";
import { getSpotBySlug } from "@/lib/data/spots";
import { getEventBySlug } from "@/lib/data/events";
import { getArticleBySlug } from "@/lib/data/articles";
import { VIBE_META } from "@/lib/vibes";
import { buildShareImage, type ShareImageInput } from "@/lib/seo/shareImage";
import { routing, type Locale } from "@/i18n/routing";

// Node runtime (sharp). Lives under /api so the next-intl proxy never
// redirects it and crawlers (WhatsApp, facebookexternalhit, Twitterbot) get
// the image directly. Callers append `?locale=es&v=<updated_at>`: the version
// busts messenger caches on edit, which is what makes the long max-age safe.
export const runtime = "nodejs";

const CACHE = "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable";
const FALLBACK_CACHE = "public, max-age=300, s-maxage=300";

const wordCount = (html: string | null) =>
  html ? html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length : 0;

async function resolve(
  type: string,
  slug: string,
  locale: Locale,
): Promise<ShareImageInput | null> {
  const [tCategory, tVibe, tEventCategory, tShare] = await Promise.all([
    getTranslations({ locale, namespace: "category" }),
    getTranslations({ locale, namespace: "vibe" }),
    getTranslations({ locale, namespace: "eventCategory" }),
    getTranslations({ locale, namespace: "share" }),
  ]);

  if (type === "spots") {
    const spot = await getSpotBySlug(slug, locale);
    if (!spot) return null;
    const vibe = spot.vibes[0];
    return {
      photoUrl: spot.featured_photo ?? spot.photos[0]?.url ?? null,
      name: spot.name,
      meta: tCategory(spot.category),
      chip: vibe ? { label: tVibe(vibe), color: VIBE_META[vibe].color } : null,
    };
  }

  if (type === "events") {
    const event = await getEventBySlug(slug, locale);
    if (!event) return null;
    const date = new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(`${event.date}T00:00:00`));
    return {
      photoUrl: event.photo ?? event.photos[0]?.url ?? null,
      name: event.title,
      meta: tEventCategory(event.category),
      chip: { label: `${date} · ${event.time_start.slice(0, 5)}`, color: "#1fa6da" },
    };
  }

  if (type === "guides") {
    const article = await getArticleBySlug(slug, locale);
    if (!article) return null;
    const words =
      wordCount(article.body) +
      article.blocks.reduce((n, b) => n + wordCount(b.text), 0);
    const minutes = Math.max(1, Math.round(words / 200));
    return {
      photoUrl: article.cover_photo ?? article.blocks.find((b) => b.photo)?.photo ?? null,
      name: article.title,
      meta: tShare("guide"),
      chip: { label: tShare("readingTime", { minutes }), color: "#1fa6da" },
    };
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; slug: string }> },
) {
  const { type, slug } = await params;
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = (routing.locales as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : routing.defaultLocale;

  const input = await resolve(type, slug, locale);
  // Unknown record: still return a branded image (never a broken preview),
  // but don't let it be cached for long in case the record appears later.
  if (!input) {
    return buildShareImage({ photoUrl: null, name: "Casco Viejo Guide", meta: "Panamá" }, FALLBACK_CACHE);
  }
  return buildShareImage(input, CACHE);
}
