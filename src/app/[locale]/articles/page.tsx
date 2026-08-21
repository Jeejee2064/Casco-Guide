import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ArticlesGrid } from "@/components/site/ArticlesGrid";
import { getArticles } from "@/lib/data/articles";
import { buildAlternates } from "@/lib/seo/alternates";
import { SITE_NAME, ogLocaleOf } from "@/lib/seo/site";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "seo.articles" });
  const alternates = buildAlternates("/articles", locale);
  return {
    title: t("title"),
    description: t("description"),
    alternates,
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: alternates?.canonical as string,
      siteName: SITE_NAME,
      locale: ogLocaleOf(locale),
      type: "website",
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
  };
}

export default async function ArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("articles");

  const articles = await getArticles(locale);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
            <p className="mt-2 text-foreground/60">{t("subtitle")}</p>
          </div>
          <ArticlesGrid articles={articles} />
        </div>
      </main>
      <Footer />
    </>
  );
}
