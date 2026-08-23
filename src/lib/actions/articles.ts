"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ArticleBlockRecord, ArticleLayout } from "@/lib/types/database";

export interface ArticleFormValues {
  id?: string;
  title_es: string;
  title_en: string;
  slug: string;
  excerpt_es: string;
  excerpt_en: string;
  // Total time, shown near the title when set — see ArticleDetailView /
  // database.ts (Article.duration) for details.
  duration_es: string;
  duration_en: string;
  // HTML from ArticleBodyEditor — contains <a data-ref-type="spot|event"
  // data-ref-id="..."> for every linked place, parsed below into
  // spot_refs/event_refs.
  body_es: string;
  body_en: string;
  layout: ArticleLayout;
  blocks: ArticleBlockRecord[];
  cover_photo: string;
  tags: string[];
  author: string;
  is_published: boolean;
  is_featured: boolean;
}

/** Pulls every `data-ref-type="spot|event" data-ref-id="<uuid>"` pair out of
 * the editor's HTML output, plus every block's own ref_type/ref_id, and
 * returns the distinct spot/event ids referenced — powers the "places
 * mentioned" map on the public article page. Regex is safe here because
 * this exact attribute shape is only ever produced by ArticleBodyEditor's
 * Link extension, never freehand HTML. */
function extractRefs(
  htmlBlocks: string[],
  blocks: ArticleBlockRecord[],
): { spotIds: string[]; eventIds: string[] } {
  const refPattern = /data-ref-type="(spot|event)"\s+data-ref-id="([^"]+)"/g;
  const spotIds = new Set<string>();
  const eventIds = new Set<string>();

  for (const html of htmlBlocks) {
    if (!html) continue;
    for (const match of html.matchAll(refPattern)) {
      const [, type, id] = match;
      if (type === "spot") spotIds.add(id);
      else eventIds.add(id);
    }
  }

  for (const block of blocks) {
    if (block.ref_type === "spot" && block.ref_id) spotIds.add(block.ref_id);
    else if (block.ref_type === "event" && block.ref_id) eventIds.add(block.ref_id);
  }

  return { spotIds: [...spotIds], eventIds: [...eventIds] };
}

export async function upsertArticle(locale: Locale, values: ArticleFormValues) {
  const supabase = await createClient();
  const { id, ...rest } = values;
  const { spotIds, eventIds } = extractRefs([rest.body_es, rest.body_en], rest.blocks);

  let published_at: string | null | undefined;
  if (rest.is_published) {
    if (id) {
      const { data: existing } = await supabase
        .from("articles")
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      published_at = existing?.published_at ?? new Date().toISOString();
    } else {
      published_at = new Date().toISOString();
    }
  } else {
    published_at = null;
  }

  const payload = {
    ...rest,
    excerpt_es: rest.excerpt_es || null,
    excerpt_en: rest.excerpt_en || null,
    duration_es: rest.duration_es || null,
    duration_en: rest.duration_en || null,
    body_es: rest.body_es || null,
    body_en: rest.body_en || null,
    cover_photo: rest.cover_photo || null,
    author: rest.author || null,
    spot_refs: spotIds,
    event_refs: eventIds,
    published_at,
  };

  const { error, data } = id
    ? await supabase.from("articles").update(payload).eq("id", id).select("slug").single()
    : await supabase.from("articles").insert(payload).select("slug").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/[locale]/admin/articles", "page");
  revalidatePath("/[locale]/articles", "page");
  redirect({ href: "/admin/articles", locale });
  return { error: null, slug: data?.slug };
}

export async function deleteArticle(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/[locale]/admin/articles", "page");
  return { error: null };
}
