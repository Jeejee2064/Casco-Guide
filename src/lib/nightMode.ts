/** Shared between NightModeContext (the client-side toggle/state) and the
 * root layout's `beforeInteractive` init script (see layout.tsx), which
 * reads this same key to stamp `data-night` on `<html>` before hydration —
 * kept in one place so the two can't drift apart.
 *
 * Lives in its own plain module (no `"use client"`) on purpose: the layout
 * is a Server Component, and a Server Component importing a *value* export
 * from a `"use client"` module doesn't get the real string back — only
 * components are proxied across that boundary, so a plain constant resolves
 * to `undefined` server-side. That was silently breaking the init script
 * (`localStorage.getItem(undefined)` never matches `"night"`), so the
 * constant moved out to where both sides can actually read it.
 */
export const NIGHT_MODE_STORAGE_KEY = "casco-night-mode";
