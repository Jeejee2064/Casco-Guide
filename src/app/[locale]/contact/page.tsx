import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { InfoPage, type InfoSection } from "@/components/site/InfoPage";
import { buildAlternates } from "@/lib/seo/alternates";
import { socialMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema, webPageSchema } from "@/lib/seo/schema";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/seo/site";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "pages.contact" });
  const alternates = buildAlternates("/contact", locale);
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

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.contact" });
  const url = buildAlternates("/contact", locale)!.canonical as string;
  const homeUrl = buildAlternates("/", locale)!.canonical as string;

  return (
    <>
      <Header />
      <main className="relative isolate flex-1 overflow-clip">
        <FoliageTrail seed="contact" />
        <InfoPage
          title={t("title")}
          lead={t("lead")}
          sections={t.raw("sections") as InfoSection[]}
          jsonLd={[
            webPageSchema({
              type: "ContactPage",
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
          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-foreground/50">
            {t("emailLabel")}
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-heading text-2xl font-extrabold text-aqua underline-offset-4 hover:underline sm:text-3xl"
          >
            {CONTACT_EMAIL}
          </a>
        </InfoPage>
      </main>
      <Footer />
    </>
  );
}
