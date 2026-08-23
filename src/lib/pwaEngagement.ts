"use client";

// Session-scoped signal that the visitor has actually looked at real content
// — a spot/article/event detail, page or modal — not just landed on the
// home page. InstallPwaPrompt waits for this before offering the install
// prompt, so it shows up once the app has demonstrated some value instead
// of interrupting on a blind page-load timer.
const ENGAGED_KEY = "casco-pwa-engaged";
export const PWA_ENGAGED_EVENT = "casco-pwa-engaged";

export function markContentEngaged() {
  try {
    if (window.sessionStorage.getItem(ENGAGED_KEY) === "1") return;
    window.sessionStorage.setItem(ENGAGED_KEY, "1");
  } catch {
    // Storage unavailable — fall through and still notify same-tab
    // listeners below, so the prompt can react even without persistence.
  }
  window.dispatchEvent(new Event(PWA_ENGAGED_EVENT));
}

export function hasContentEngagement(): boolean {
  try {
    return window.sessionStorage.getItem(ENGAGED_KEY) === "1";
  } catch {
    return false;
  }
}
