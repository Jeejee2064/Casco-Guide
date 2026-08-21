"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

const STORAGE_KEY = "casco-night-mode";
// No native event fires when *this* tab mutates localStorage/classList (the
// "storage" event only reaches other tabs) — dispatched by `commitNight`
// below so useSyncExternalStore's subscription notices same-tab toggles too.
const CHANGE_EVENT = "casco:night-mode-change";

type NightModeContextValue = {
  isNight: boolean;
  toggleNight: () => void;
};

const NightModeContext = createContext<NightModeContextValue | null>(null);

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// `<html class="night">` is the source of truth (the inline init script in
// the root layout stamps it before hydration), not React state — this just
// mirrors it in, which is what useSyncExternalStore is for.
function getSnapshot() {
  return document.documentElement.classList.contains("night");
}

function getServerSnapshot() {
  return false;
}

function commitNight(next: boolean) {
  document.documentElement.classList.toggle("night", next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "night" : "day");
  } catch {
    // Private browsing / storage disabled — the toggle still works for this
    // tab, it just won't be remembered next visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * A deliberate, manually-toggled "going out tonight" theme — distinct from
 * the OS-level `prefers-color-scheme` dark mode already in globals.css (that
 * one is a quiet readability shift; this is a saturated neon mood the user
 * opts into, regardless of their OS setting). Every `.night` rule in
 * globals.css keys off `<html class="night">`, which `commitNight` above
 * owns; this provider just exposes that as reactive state.
 */
export function NightModeProvider({ children }: { children: React.ReactNode }) {
  const isNight = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleNight = useCallback(() => {
    commitNight(!document.documentElement.classList.contains("night"));
  }, []);

  return (
    <NightModeContext.Provider value={{ isNight, toggleNight }}>
      {children}
    </NightModeContext.Provider>
  );
}

export function useNightMode() {
  const ctx = useContext(NightModeContext);
  if (!ctx) throw new Error("useNightMode must be used within NightModeProvider");
  return ctx;
}

/** Read by the root layout's beforeInteractive `<Script>` — kept in one place
 * so the storage key can't drift between the two. */
export const NIGHT_MODE_STORAGE_KEY = STORAGE_KEY;
