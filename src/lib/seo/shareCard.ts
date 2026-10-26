import "server-only";

import { getTranslations } from "next-intl/server";
import { getSpotBySlug } from "@/lib/data/spots";
import { getEventBySlug } from "@/lib/data/events";
import { getArticleBySlug } from "@/lib/data/articles";
import { VIBE_META } from "@/lib/vibes";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderShareImage, type ShareImageInput } from "./shareImage";
import type { Locale } from "@/i18n/routing";

export type ShareCardType = "spots" | "guides" | "events";

const BUCKET = "spot-photos";
const keyPrefix = (type: ShareCardType, slug: string, locale: Locale) =>
  `share/${type}-${slug}-${locale}-`;

const wordCount = (html: string | null) =>
  html ? html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length : 0;

/** What to print on the card for a record, in the given locale. */
export async function resolveShareInput(
  type: ShareCardType,
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

  const article = await getArticleBySlug(slug, locale);
  if (!article) return null;
  const words =
    wordCount(article.body) + article.blocks.reduce((n, b) => n + wordCount(b.text), 0);
  return {
    photoUrl: article.cover_photo ?? article.blocks.find((b) => b.photo)?.photo ?? null,
    name: article.title,
    meta: tShare("guide"),
    chip: {
      label: tShare("readingTime", { minutes: Math.max(1, Math.round(words / 200)) }),
      color: "#1fa6da",
    },
  };
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

  try {
    const storage = createAdminClient().storage.from(BUCKET);
    const { error } = await storage.upload(key, image, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw error;
    const { data: files } = await storage.list("share", { search: prefix.slice("share/".length) });
    const stale = (files ?? [])
      .map((f) => `share/${f.name}`)
      .filter((name) => name.startsWith(prefix) && name !== key);
    if (stale.length) await storage.remove(stale);
  } catch (err) {
    console.warn("share image not saved to storage:", err instanceof Error ? err.message : err);
  }
  return image;
}
