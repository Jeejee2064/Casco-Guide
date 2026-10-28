import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { InfoPage, type InfoSection } from "@/components/site/InfoPage";
import { Link } from "@/i18n/navigation";
import { buildAlternates } from "@/lib/seo/alternates";
import { socialMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema, webPageSchema } from "@/lib/seo/schema";
import { SITE_NAME } from "@/lib/seo/site";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "pages.about" });
  const alternates = buildAlternates("/about", locale);
  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates,
    ...socialMetadata({
      locale,
      title: t("seoTitle"),
      description: t("seoDescription"),
      url: alternates?.canonical as string,
    }),
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.about" });
  const url = buildAlternates("/about", locale)!.canonical as string;
  const homeUrl = buildAlternates("/", locale)!.canonical as string;

  return (
    <>
      <Header />
      <main className="relative isolate flex-1 overflow-clip">
        <FoliageTrail seed="about" />
        <InfoPage
          title={t("title")}
          lead={t("lead")}
          sections={t.raw("sections") as InfoSection[]}
          jsonLd={[
            webPageSchema({
              type: "AboutPage",
              url,
              name: t("seoTitle"),
              description: t("seoDescription"),
              locale,
            }),
            breadcrumbSchema([
              { name: SITE_NAME, url: homeUrl },
              { name: t("title"), url },
            ]),
          ]}
        >
          <Link
            href="/contact"
            className="mt-6 inline-block font-semibold text-aqua underline-offset-4 hover:underline"
          >
            {t("ctaText")}
          </Link>
        </InfoPage>
      </main>
      <Footer />
    </>
  );
}
