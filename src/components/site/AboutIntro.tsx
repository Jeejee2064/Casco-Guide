import { getTranslations } from "next-intl/server";

/**
 * Long-form "About Casco Viejo" copy — history, what makes it special, an
 * eat/see/stay primer — right under the Hero. Two jobs at once: gives
 * visitors real context before they even open a spot, and gives Google
 * substantial, crawlable on-page text near the top of the homepage (which
 * otherwise leads with an app shell of teasers into /spots and /map).
 * Split out of the old AboutCascoViejo — see AboutFaq for its other half.
 */
export async function AboutIntro() {
  const t = await getTranslations("about");
  const sections = ["eat", "see", "stay"] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
        <p className="mt-4 text-foreground/70 leading-relaxed">{t("intro")}</p>
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        {sections.map((key) => (
          <div key={key}>
            <h3 className="font-heading text-lg font-bold">{t(`sections.${key}.title`)}</h3>
            <p className="mt-2 text-sm text-foreground/65 leading-relaxed">
              {t(`sections.${key}.body`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
