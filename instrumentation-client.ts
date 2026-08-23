import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
    defaults: "2026-01-30",
    capture_pageview: true,
    person_profiles: "identified_only",
    capture_exceptions: true,
  });
} else if (process.env.NODE_ENV === "development") {
  console.error(
    new Error(
      "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured",
    ),
  );
}

export function onRouterTransitionStart(url: string) {
  if (!posthogKey) return;

  const currentUrl = new URL(url, window.location.origin).toString();
  posthog.capture("$pageview", { $current_url: currentUrl });
}
