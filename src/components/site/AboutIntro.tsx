import { getTranslations } from "next-intl/server";
import { Bed, Camera, Utensils } from "lucide-react";

const SECTION_ICONS = { eat: Utensils, see: Camera, stay: Bed } as const;

/**
 * Long-form "About Casco Viejo" copy — history, what makes it special, an
 * eat/see/stay primer. Two jobs at once: gives visitors real context before
 * they open a spot, and gives Google substantial, crawlable on-page text on
 * the homepage. The intro paragraph is set large in the display serif so it
 * reads as the editorial voice of the page; eat/see/stay sit below as three
 * ruled columns.
 */
export async function AboutIntro() {
  const t = await getTranslations("about");
  const sections = ["eat", "see", "stay"] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <h2 className="font-heading max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
        {t("title")}
      </h2>
      <p
        className="mt-6 max-w-3xl text-xl leading-relaxed text-foreground/80 sm:text-2xl sm:leading-relaxed"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {t("intro")}
      </p>

      <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-3">
        {sections.map((key) => {
          const Icon = SECTION_ICONS[key];
          return (
            <div key={key} className="bg-surface p-6 sm:p-8">
              <Icon size={22} className="text-aqua" strokeWidth={2} />
              <h3 className="mt-4 font-heading text-lg font-bold">{t(`sections.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                {t(`sections.${key}.body`)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
