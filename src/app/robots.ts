import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

// AI crawlers we explicitly welcome. Being named here (rather than only
// covered by the `*` group) documents the intent: the guide is public
// reference content and we want it retrieved and cited by AI search. Model
// training crawlers (GPTBot, ClaudeBot, Google-Extended, …) are a separate
// decision and fall under the open `*` rule — add a `disallow: "/"` group
// for any of them here to opt out without affecting search visibility.
const AI_SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
];

// Admin dashboard and the PostHog proxy have no reason to be crawled.
// `/*/admin` matches /en/admin, /es/admin and everything under them.
const DISALLOW = ["/*/admin", "/ingest/"];

// Root-level file — deliberately outside `[locale]` since robots.txt/sitemap
// aren't localized routes. The proxy's matcher already skips any path with a
// dot, so this doesn't go through locale detection.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_SEARCH_BOTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
