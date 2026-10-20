import { getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import { JsonLd } from "./JsonLd";
import { faqSchema } from "@/lib/seo/schema";

// Fixed, ordered list — safer than Object.values() on the messages object,
// whose key order isn't something JSON is guaranteed to preserve in every
// tool that might touch the translation files.
const FAQ_IDS = ["q1", "q2", "q3", "q4", "q5"] as const;

/**
 * Casco Viejo FAQ, at the bottom of the homepage — real answers to the
 * questions visitors actually have, plus a FAQPage JSON-LD block that's
 * eligible for FAQ rich results. Native <details> accordions: no JS, and the
 * answers stay in the HTML (crawlable, and readable by AI agents) even while
 * collapsed. The first one starts open.
 */
export async function AboutFaq() {
  const t = await getTranslations("about");
  const faqItems = FAQ_IDS.map((id) => ({
    q: t(`faq.${id}.q`),
    a: t(`faq.${id}.a`),
  }));

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[5fr_7fr] lg:gap-16">
      <JsonLd data={faqSchema(faqItems)} />

      <h2 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">
        {t("faqTitle")}
      </h2>

      <div className="divide-y divide-border border-y border-border">
        {faqItems.map((item, i) => (
          <details key={item.q} open={i === 0} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-heading font-bold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                size={18}
                className="shrink-0 text-foreground/40 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="pb-4 pr-8 text-sm leading-relaxed text-foreground/65">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
