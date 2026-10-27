import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/site/JsonLd";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { ArticlesGrid } from "@/components/site/ArticlesGrid";
import { getArticles } from "@/lib/data/articles";
import { buildAlternates } from "@/lib/seo/alternates";
import { collectionSchema } from "@/lib/seo/schema";
import { getPathname } from "@/i18n/navigation";
import { absoluteUrl } from "@/lib/seo/site";
import { socialMetadata } from "@/lib/seo/metadata";
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
    ...socialMetadata({
      locale,
      title: t("title"),
      description: t("description"),
      url: alternates?.canonical as string,
    }),
  };
}

export default async function ArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("articles");

  const [articles, tSeo] = await Promise.all([
    getArticles(locale),
    getTranslations({ locale, namespace: "seo.articles" }),
  ]);

  return (
    <>
      <JsonLd
        data={collectionSchema({
          name: tSeo("title"),
          description: tSeo("description"),
          url: buildAlternates("/articles", locale)!.canonical as string,
          items: articles.map((article) => ({
            name: article.title,
            url: absoluteUrl(
              getPathname({
                href: { pathname: "/articles/[slug]", params: { slug: article.slug } },
                locale,
              }),
            ),
          })),
        })}
      />
      <Header />
      <main className="relative isolate flex-1 overflow-clip">
        <FoliageTrail seed="articles" />
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
