import { getLocale, getTranslations } from "next-intl/server";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { getSpots } from "@/lib/data/spots";
import { getEvents } from "@/lib/data/events";
import { getArticles } from "@/lib/data/articles";
import type { Locale } from "@/i18n/routing";

export default async function NewArticlePage() {
  const t = await getTranslations("admin.articleForm");
  const locale = (await getLocale()) as Locale;
  const [spots, events, articles] = await Promise.all([getSpots(locale), getEvents(locale), getArticles(locale)]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("titleNew")}</h1>
      <ArticleForm spots={spots} events={events} articles={articles} />
    </div>
  );
}
