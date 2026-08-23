import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, static assets, and PostHog's ingest
  // proxy (next.config.ts's rewrites) — /ingest/* isn't a page and needs no
  // locale prefix; without this exclusion every request to it (any path
  // without a file extension, e.g. /ingest/decide, /ingest/e) got redirected
  // to /es/ingest/... here before the rewrite ever got a chance to run,
  // silently dropping every analytics event.
  matcher: ["/((?!api|_next|_vercel|ingest|.*\\..*).*)"],
};
