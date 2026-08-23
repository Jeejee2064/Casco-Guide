import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Montserrat } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";
import { Toaster } from "sonner";
import { routing, type Locale } from "@/i18n/routing";
import { MotionProvider } from "@/components/site/MotionProvider";
import { NightModeProvider, NIGHT_MODE_STORAGE_KEY } from "@/components/site/NightModeContext";
import { InstallPwaPrompt } from "@/components/site/InstallPwaPrompt";
import { JsonLd } from "@/components/site/JsonLd";
import { buildAlternates } from "@/lib/seo/alternates";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, ogLocaleOf } from "@/lib/seo/site";
import "../globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#146b8c" },
    { media: "(prefers-color-scheme: dark)", color: "#201a2e" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "seo.home" });
  const ogLocale = ogLocaleOf(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s | ${SITE_NAME}` },
    description: t("description"),
    keywords: t("keywords"),
    applicationName: SITE_NAME,
    alternates: buildAlternates("/", locale),
    openGraph: {
      siteName: SITE_NAME,
      title: t("title"),
      description: t("description"),
      url: buildAlternates("/", locale)?.canonical as string,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 650, alt: SITE_NAME }],
      locale: ogLocale,
      alternateLocale: routing.locales.filter((l) => l !== locale).map(ogLocaleOf),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [DEFAULT_OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    // The favicon.ico file convention (src/app/favicon.ico) already emits
    // its own <link rel="icon">, so this only adds the sized PNG marks on
    // top of that fallback — pre-rendered from cascoviejo.svg into
    // public/favicon_io/ (the manifest.ts icons reuse the same set).
    icons: {
      icon: [
        { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon_io/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/favicon_io/apple-touch-icon.png",
    },
    ...(process.env.GOOGLE_SITE_VERIFICATION && {
      verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
    }),
  };
}

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      // The night-mode init script below stamps `data-night` on this element
      // before hydration (to avoid a flash back to day mode on load), which
      // React never sees coming — suppress the resulting one-attribute
      // hydration warning rather than the whole tree's. It's a `data-*`
      // attribute rather than a class in `className` above on purpose: this
      // layout is keyed by the `[locale]` segment, so switching locale makes
      // it re-render server-side and React reconciles `className`'s literal
      // value (never "night") back onto this same real DOM node — wiping
      // out a class added outside of React. `data-night` is never mentioned
      // in any prop React renders here, so reconciliation never touches it.
      suppressHydrationWarning
      className={`${poppins.variable} ${inter.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Site-wide identity — emitted once here rather than per-page so
            every route shares the same Organization/WebSite nodes. */}
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        {/* Runs before hydration so a returning visitor who left Night Mode
            on doesn't see a flash of the day theme first. Kept tiny and
            defensive (storage can be unavailable in private browsing). */}
        <Script id="night-mode-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem(${JSON.stringify(NIGHT_MODE_STORAGE_KEY)})==="night"){document.documentElement.setAttribute("data-night","")}}catch(e){}`}
        </Script>
        <NextIntlClientProvider messages={messages}>
          <MotionProvider>
            <NightModeProvider>
              {children}
              {/* Mounted globally rather than per-page so it can surface on
                  whichever page the visitor is on once they've engaged with
                  real content — see InstallPwaPrompt's doc comment. */}
              <InstallPwaPrompt />
              <Toaster richColors position="top-center" />
            </NightModeProvider>
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
