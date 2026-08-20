import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { getAllArticles } from "@/lib/data/articles";
import type { Locale } from "@/i18n/routing";

export default async function AdminArticlesPage() {
  const t = await getTranslations("admin.articles");
  const locale = (await getLocale()) as Locale;
  const articles = await getAllArticles(locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <Link href="/admin/articles/new">
          <Button variant="primary">+ {t("add")}</Button>
        </Link>
      </div>

      <ArticlesTable articles={articles} />
    </div>
  );
}
