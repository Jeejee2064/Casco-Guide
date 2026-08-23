import { getTranslations } from "next-intl/server";
import { JsonLd } from "./JsonLd";
import { faqSchema } from "@/lib/seo/schema";

// Fixed, ordered list — safer than Object.values() on the messages object,
// whose key order isn't something JSON is guaranteed to preserve in every
// tool that might touch the translation files.
const FAQ_IDS = ["q1", "q2", "q3", "q4", "q5"] as const;

/**
 * Casco Viejo FAQ, near the bottom of the homepage — real answers to the
 * questions visitors actually have, plus a FAQPage JSON-LD block that's
 * eligible for FAQ rich results. Split out of the old AboutCascoViejo — see
 * AboutIntro for its other half (history/eat/see/stay, right under the
 * Hero).
 */
export async function AboutFaq() {
  const t = await getTranslations("about");
  const faqItems = FAQ_IDS.map((id) => ({
    q: t(`faq.${id}.q`),
    a: t(`faq.${id}.a`),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLd data={faqSchema(faqItems)} />

      <div className="max-w-3xl">
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
