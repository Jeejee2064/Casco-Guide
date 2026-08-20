import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { Article, ArticleRecord } from "@/lib/types/database";
import { localizeArticle } from "@/lib/i18n/content";
import { isSupabaseConfigured } from "./spots";
import { MOCK_ARTICLES } from "./mock-articles";

/** All published articles, most recent first — powers the public listing page. */
export async function getArticles(locale: Locale): Promise<Article[]> {
  if (!isSupabaseConfigured) {
    return MOCK_ARTICLES.filter((a) => a.is_published).map((a) => localizeArticle(a, locale));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("getArticles error:", error.message);
    return MOCK_ARTICLES.filter((a) => a.is_published).map((a) => localizeArticle(a, locale));
  }
  return (data as ArticleRecord[]).map((a) => localizeArticle(a, locale));
}

/** All articles including drafts, most recently updated first — powers the admin list. */
export async function getAllArticles(locale: Locale): Promise<Article[]> {
  if (!isSupabaseConfigured) return MOCK_ARTICLES.map((a) => localizeArticle(a, locale));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getAllArticles error:", error.message);
    return MOCK_ARTICLES.map((a) => localizeArticle(a, locale));
  }
  return (data as ArticleRecord[]).map((a) => localizeArticle(a, locale));
}

/** A single published article by slug — `null` for drafts, so the public
 * page 404s on an unpublished or unknown slug. */
export async function getArticleBySlug(slug: string, locale: Locale): Promise<Article | null> {
  if (!isSupabaseConfigured) {
    const record = MOCK_ARTICLES.find((a) => a.slug === slug && a.is_published);
    return record ? localizeArticle(record, locale) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("getArticleBySlug error:", error.message);
    return null;
  }
  return data ? localizeArticle(data as ArticleRecord, locale) : null;
}

/** A single article by id, published or draft — used by the admin edit form. */
export async function getArticleById(id: string, locale: Locale): Promise<Article | null> {
  if (!isSupabaseConfigured) {
    const record = MOCK_ARTICLES.find((a) => a.id === id);
    return record ? localizeArticle(record, locale) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();

  if (error) {
    console.error("getArticleById error:", error.message);
    return null;
  }
  return data ? localizeArticle(data as ArticleRecord, locale) : null;
}

/** Other published articles, most recent first — powers a "more articles"
 * rail at the bottom of an article page. */
export async function getRecentArticles(
  locale: Locale,
  { excludeId, limit = 3 }: { excludeId?: string; limit?: number } = {},
): Promise<Article[]> {
  const articles = await getArticles(locale);
  return articles.filter((a) => a.id !== excludeId).slice(0, limit);
}

/** Published articles whose `spot_refs` cite the given spot, most recent
 * first — powers the "featured in" rail on a spot's detail page (the
 * inverse of `getSpotsByIds`, see spots.ts). */
export async function getArticlesForSpot(spotId: string, locale: Locale): Promise<Article[]> {
  if (!isSupabaseConfigured) {
    return MOCK_ARTICLES.filter((a) => a.is_published && a.spot_refs.includes(spotId)).map((a) =>
      localizeArticle(a, locale),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .contains("spot_refs", [spotId])
    .order("published_at", { ascending: false });

  if (error) {
    console.error("getArticlesForSpot error:", error.message);
    return [];
  }
  return (data as ArticleRecord[]).map((a) => localizeArticle(a, locale));
}
