import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { isSupabaseConfigured } from "@/lib/data/spots";
import { getSpots } from "@/lib/data/spots";
// Events temporarily hidden site-wide — no events fetched, so ArticleForm's
// spot/event/article link picker naturally drops its "event" tab (no data).
// import { getEvents } from "@/lib/data/events";
import { getArticles } from "@/lib/data/articles";
import { MOCK_ARTICLES } from "@/lib/data/mock-articles";
import type { ArticleRecord } from "@/lib/types/database";
import type { Locale } from "@/i18n/routing";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("admin.articleForm");
  const locale = (await getLocale()) as Locale;

  let article: ArticleRecord | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
    article = data as ArticleRecord | null;
  } else {
    article = MOCK_ARTICLES.find((a) => a.id === id) ?? null;
  }

  if (!article) notFound();

  const [spots, articles] = await Promise.all([getSpots(locale), getArticles(locale)]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("titleEdit")}</h1>
      <ArticleForm article={article} spots={spots} events={[]} articles={articles} />
    </div>
  );
}
