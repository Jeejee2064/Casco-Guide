// Builders for /llms.txt and /llms-full.txt — plain-markdown summaries of the
// site for AI assistants and agents (see llmstxt.org). Generated from the
// same data as the pages, so they never drift from what's published.
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getArticles } from "@/lib/data/articles";
import { getSpots } from "@/lib/data/spots";
import type { Spot } from "@/lib/types/database";
import { SITE_NAME, SITE_URL, absoluteUrl } from "./site";

const LOCALE_LABEL: Record<Locale, string> = { en: "English", es: "Español" };

const INTRO =
  "Casco Viejo (also Casco Antiguo, San Felipe) is the restored colonial old town of Panama City, a UNESCO World Heritage Site since 1997. " +
  `${SITE_NAME} is an independent, locally curated guide to its restaurants, bars, cafés, museums, shops, hotels and walking routes, available in English and Spanish.`;

const spotUrl = (slug: string, locale: Locale) =>
  absoluteUrl(getPathname({ href: { pathname: "/spots/[slug]", params: { slug } }, locale }));
const articleUrl = (slug: string, locale: Locale) =>
  absoluteUrl(getPathname({ href: { pathname: "/articles/[slug]", params: { slug } }, locale }));
const pageUrl = (href: "/" | "/spots" | "/map" | "/articles", locale: Locale) =>
  absoluteUrl(getPathname({ href, locale }));

const oneLine = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

function groupByCategory(spots: Spot[]) {
  const groups = new Map<string, Spot[]>();
  for (const spot of spots) groups.set(spot.category, [...(groups.get(spot.category) ?? []), spot]);
  return groups;
}

/** Short index: what the site is, where the main pages are, every spot and
 * guide as a link. */
export async function buildLlmsTxt(): Promise<string> {
  const lines = [`# ${SITE_NAME}`, "", `> ${INTRO}`, ""];

  for (const locale of routing.locales) {
    const [spots, articles] = await Promise.all([getSpots(locale), getArticles(locale)]);
    lines.push(`## ${LOCALE_LABEL[locale]}`, "");
    lines.push(
      `- [Home](${pageUrl("/", locale)}): overview of Casco Viejo and FAQ`,
      `- [All places](${pageUrl("/spots", locale)}): every restaurant, bar, café, museum, shop and hotel`,
      `- [Map](${pageUrl("/map", locale)}): interactive map of every place`,
      `- [Guides](${pageUrl("/articles", locale)}): in-depth guides and recommendations`,
      "",
    );
    for (const [category, items] of groupByCategory(spots)) {
      lines.push(`### ${category}`, "");
      for (const spot of items) {
        const desc = oneLine(spot.description);
        lines.push(`- [${spot.name}](${spotUrl(spot.slug, locale)})${desc ? `: ${desc.slice(0, 140)}` : ""}`);
      }
      lines.push("");
    }
    if (articles.length > 0) {
      lines.push("### Guides", "");
      for (const article of articles) {
        const desc = oneLine(article.excerpt);
        lines.push(`- [${article.title}](${articleUrl(article.slug, locale)})${desc ? `: ${desc.slice(0, 140)}` : ""}`);
      }
      lines.push("");
    }
  }

  lines.push("## Optional", "", `- [Sitemap](${SITE_URL}/sitemap.xml)`, `- [Full content](${SITE_URL}/llms-full.txt)`, "");
  return lines.join("\n");
}

/** Everything in one file: full descriptions with address and hours-free
 * facts, so an assistant can answer without fetching each page. */
export async function buildLlmsFullTxt(): Promise<string> {
  const lines = [`# ${SITE_NAME} — full content`, "", `> ${INTRO}`, ""];

  for (const locale of routing.locales) {
    const [spots, articles] = await Promise.all([getSpots(locale), getArticles(locale)]);
    lines.push(`## ${LOCALE_LABEL[locale]}: places`, "");
    for (const spot of spots) {
      lines.push(`### ${spot.name}`, "", `URL: ${spotUrl(spot.slug, locale)}`, `Category: ${spot.category}`);
      if (spot.address) lines.push(`Address: ${spot.address}`);
      if (spot.price_range) lines.push(`Price range: ${spot.price_range}`);
      if (spot.cuisine_type) lines.push(`Cuisine: ${spot.cuisine_type}`);
      if (spot.website) lines.push(`Website: ${spot.website}`);
      if (spot.description) lines.push("", oneLine(spot.description));
      lines.push("");
    }
    lines.push(`## ${LOCALE_LABEL[locale]}: guides`, "");
    for (const article of articles) {
      lines.push(`### ${article.title}`, "", `URL: ${articleUrl(article.slug, locale)}`);
      if (article.updated_at) lines.push(`Updated: ${article.updated_at.slice(0, 10)}`);
      if (article.excerpt) lines.push("", oneLine(article.excerpt));
      lines.push("");
    }
  }
  return lines.join("\n");
}
