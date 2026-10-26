import { ensureShareImage, type ShareCardType } from "@/lib/seo/shareCard";
import { renderShareImage } from "@/lib/seo/shareImage";
import { routing, type Locale } from "@/i18n/routing";

// Node runtime (sharp). Lives under /api so the next-intl proxy never
// redirects it and crawlers (WhatsApp, facebookexternalhit, Twitterbot) get
// the image directly. The card itself is generated once per record version
// and kept in Supabase Storage (see ensureShareImage); this route just serves
// it from our own domain. `?v=<updated_at ms>` selects the version.
export const runtime = "nodejs";

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable";
const SHORT = "public, max-age=300, s-maxage=300";
const TYPES: readonly string[] = ["spots", "guides", "events"];

const jpeg = (body: Buffer, cache: string) =>
  new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": cache },
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; slug: string }> },
) {
  const { type, slug } = await params;
  const search = new URL(request.url).searchParams;
  const requested = search.get("locale") ?? "";
  const locale = (routing.locales as readonly string[]).includes(requested)
    ? (requested as Locale)
    : routing.defaultLocale;
  const version = Number(search.get("v")) || 0;

  const image = TYPES.includes(type)
    ? await ensureShareImage(type as ShareCardType, slug, locale, version)
    : null;
  if (image) return jpeg(image, IMMUTABLE);

  // Unknown record: still return a branded image (never a broken preview),
  // but don't let it be cached for long in case the record appears later.
  const fallback = await renderShareImage({ photoUrl: null, name: "Casco Viejo Guide", meta: "Panamá" });
  return jpeg(fallback, SHORT);
}
