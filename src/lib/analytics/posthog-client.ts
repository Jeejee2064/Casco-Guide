"use client";

type PostHog = typeof import("posthog-js").default;

let promise: Promise<PostHog | null> | null = null;

/** Loads and initializes PostHog on first use. The SDK is a sizeable chunk,
 * so it is imported dynamically (and kicked off from an idle callback — see
 * instrumentation-client.ts) instead of sitting in the critical bundle;
 * anything that needs it just awaits this promise, so events fired before it
 * is ready are not lost. Resolves to null when no key is configured. */
export function loadPosthog(): Promise<PostHog | null> {
  promise ??= (async () => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          new Error(
            "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured",
          ),
        );
      }
      return null;
    }
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
      defaults: "2026-01-30",
      capture_pageview: true,
      person_profiles: "identified_only",
      capture_exceptions: true,
    });
    return posthog;
  })();
  return promise;
}
