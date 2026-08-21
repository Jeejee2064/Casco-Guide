import { getTranslations } from "next-intl/server";
import { JsonLd } from "./JsonLd";
import { faqSchema } from "@/lib/seo/schema";

// Fixed, ordered list — safer than Object.values() on the messages object,
// whose key order isn't something JSON is guaranteed to preserve in every
// tool that might touch the translation files.
const FAQ_IDS = ["q1", "q2", "q3", "q4", "q5"] as const;

/**
 * Long-form "About Casco Viejo" copy + FAQ on the home page. Two jobs at
 * once: gives visitors real answers before they even open a spot, and gives
 * Google substantial, crawlable on-page text about the neighborhood itself
 * (the homepage otherwise being mostly a spots/events app shell) — plus a
 * FAQPage JSON-LD block that's eligible for FAQ rich results.
 */
export async function AboutCascoViejo() {
  const t = await getTranslations("about");

  const sections = ["eat", "see", "stay"] as const;
  const faqItems = FAQ_IDS.map((id) => ({
    q: t(`faq.${id}.q`),
    a: t(`faq.${id}.a`),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLd data={faqSchema(faqItems)} />

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

      <div className="mt-12 max-w-3xl">
        <h2 className="font-heading text-xl font-extrabold sm:text-2xl">{t("faqTitle")}</h2>
        <dl className="mt-6 divide-y divide-border">
          {faqItems.map((item) => (
            <div key={item.q} className="py-4">
              <dt className="font-heading font-bold">{item.q}</dt>
              <dd className="mt-1.5 text-sm text-foreground/65 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
