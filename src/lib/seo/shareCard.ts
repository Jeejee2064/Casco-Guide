import "server-only";

import { getSpotBySlug } from "@/lib/data/spots";
import { getEventBySlug } from "@/lib/data/events";
import { getArticleBySlug } from "@/lib/data/articles";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderShareImage, type ShareImageInput } from "./shareImage";
import { SHARE_DESIGN_VERSION } from "./site";
import type { Locale } from "@/i18n/routing";

export type ShareCardType = "spots" | "guides" | "events";

const BUCKET = "spot-photos";
const keyPrefix = (type: ShareCardType, slug: string, locale: Locale) =>
  `share/${type}-${slug}-${locale}-d${SHARE_DESIGN_VERSION}-`;

/** What to print on the card for a record: its photo and name, in the given
 * locale. */
export async function resolveShareInput(
  type: ShareCardType,
  slug: string,
  locale: Locale,
): Promise<ShareImageInput | null> {
  if (type === "spots") {
    const spot = await getSpotBySlug(slug, locale);
    return spot
      ? { photoUrl: spot.featured_photo ?? spot.photos[0]?.url ?? null, name: spot.name }
      : null;
  }

  if (type === "events") {
    const event = await getEventBySlug(slug, locale);
    return event
      ? { photoUrl: event.photo ?? event.photos[0]?.url ?? null, name: event.title }
      : null;
  }

  const article = await getArticleBySlug(slug, locale);
  return article
    ? {
        photoUrl: article.cover_photo ?? article.blocks.find((b) => b.photo)?.photo ?? null,
        name: article.title,
      }
    : null;
}

/** Returns the stored share card for this record version, generating and
 * saving it first if it doesn't exist yet (null when the record is unknown).
 * Images live in Supabase Storage under a key that embeds the record's
 * updated_at, so an edit naturally points at a fresh file; stale versions
 * are deleted once the new one is saved. A storage failure never blocks
 * the response — the generated image is still returned, just not saved. */
export async function ensureShareImage(
  type: ShareCardType,
  slug: string,
  locale: Locale,
  version: number,
): Promise<Buffer | null> {
  const prefix = keyPrefix(type, slug, locale);
  const key = `${prefix}${version}.jpg`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${key}`;

  try {
    const hit = await fetch(publicUrl);
    if (hit.ok) return Buffer.from(await hit.arrayBuffer());
  } catch {
    // fall through to generation
  }

  const input = await resolveShareInput(type, slug, locale);
  if (!input) return null;
  const image = await renderShareImage(input);
  // No version in the request (e.g. someone hitting the bare URL): serve the
  // card but never store it, so it can't shadow or evict a real version.
  if (!version) return image;

  try {
    const storage = createAdminClient().storage.from(BUCKET);
    const { error } = await storage.upload(key, image, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw error;
    const { data: files } = await storage.list("share", { search: prefix.slice("share/".length) });
    // Only versions older than this one are stale — a request carrying an
    // outdated `v` must never delete a newer card.
    const stale = (files ?? [])
      .filter((f) => `share/${f.name}`.startsWith(prefix))
      .filter((f) => Number(f.name.slice(prefix.length - "share/".length).replace(".jpg", "")) < version)
      .map((f) => `share/${f.name}`);
    if (stale.length) await storage.remove(stale);
  } catch (err) {
    console.warn("share image not saved to storage:", err instanceof Error ? err.message : err);
  }
  return image;
}
