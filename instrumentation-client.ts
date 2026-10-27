import { loadPosthog } from "@/lib/analytics/posthog-client";

// Analytics must not compete with first paint: start loading PostHog once the
// browser is idle (with a hard cap so a busy page still gets tracked).
if (typeof window !== "undefined") {
  const start = () => void loadPosthog();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 3000 });
  } else {
    setTimeout(start, 2000);
  }
}

export function onRouterTransitionStart(url: string) {
  const currentUrl = new URL(url, window.location.origin).toString();
  void loadPosthog().then((posthog) => posthog?.capture("$pageview", { $current_url: currentUrl }));
}
