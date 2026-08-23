"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { ConfirmLeaveModal } from "./ConfirmLeaveModal";

type UnsavedChangesContextValue = {
  setDirty: (dirty: boolean) => void;
  /** The current editor's own save flow (validate → translation-sync-guard
   * → save) — the exact one its Save button triggers. Registered by
   * whichever SpotForm/ArticleForm is mounted, so the leave-confirmation
   * modal's "Save and leave" option can reuse it as-is (redirect-on-
   * success included) instead of reimplementing a second save path here. */
  registerSave: (fn: (() => void) | null) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

/**
 * Site-wide "unsaved changes" guard for the admin editors — wraps the
 * whole `(protected)` admin layout, not just the editor pages, so it can
 * catch every way off a dirty form, not only the ones the form itself
 * renders:
 *
 *  - In-app navigation — clicking "Spots" in the sidebar while the spot
 *    editor has unsaved changes, or any other link on the page. The App
 *    Router has no built-in "block this client-side transition" hook (no
 *    router events, no useBlocker like React Router), so this intercepts
 *    anchor clicks itself: a capture-phase, native `document` listener
 *    fires before Next's own <Link> click handler (a bubble-phase React
 *    handler) ever runs, so preventDefault()+stopPropagation() here
 *    reliably stops the transition before Next's handler sees it. The
 *    blocked navigation's target is held in `pendingHref` and offered to
 *    ConfirmLeaveModal's three choices below.
 *  - Refresh / close tab / typed URL / a link to an external site — native
 *    `beforeunload`. This one can't show the custom modal (the browser
 *    dialog is synchronous and un-themeable — it ignores any custom
 *    message text in every modern browser), so it stays the classic
 *    browser-owned prompt.
 */
export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin.unsavedChanges");
  const router = useRouter();
  // Refs, not state: the listeners below are attached once (empty dep
  // arrays) and need the *current* values on every click, not the ones
  // captured at listener-registration time.
  const dirtyRef = useRef(false);
  const saveFnRef = useRef<(() => void) | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const registerSave = useCallback((fn: (() => void) | null) => {
    saveFnRef.current = fn;
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dirtyRef.current) return;
      // Only a plain left-click on a link is a same-tab navigation away
      // from here — a modified click (ctrl/cmd/shift/middle-click) opens a
      // new tab instead, leaving this one untouched.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // A different origin ends up as a full page unload — beforeunload
      // above already covers that case.
      if (url.origin !== window.location.origin) return;
      // Same path (e.g. an in-page "#section" anchor, or a link back to
      // this exact URL) isn't really "leaving" — nothing to guard.
      if (`${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setPendingHref(anchor.href);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const leaveWithoutSaving = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    if (!href) return;
    dirtyRef.current = false;
    router.push(href);
  }, [pendingHref, router]);

  const saveAndLeave = useCallback(() => {
    setPendingHref(null);
    // The editor's own save flow takes it from here: success redirects to
    // its list page (upsertSpot/upsertArticle both `redirect()` on save),
    // failure toasts an error and leaves the form — and its dirty state —
    // exactly as it was, so nothing is silently lost either way.
    saveFnRef.current?.();
  }, []);

  const stay = useCallback(() => setPendingHref(null), []);

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, registerSave }}>
      {children}
      <AnimatePresence>
        {pendingHref && (
          <ConfirmLeaveModal
            labels={{
              title: t("title"),
              message: t("message"),
              saveAndLeave: t("saveAndLeave"),
              leaveWithoutSaving: t("leaveWithoutSaving"),
              stay: t("stay"),
              close: t("close"),
            }}
            onSaveAndLeave={saveAndLeave}
            onLeaveWithoutSaving={leaveWithoutSaving}
            onStay={stay}
          />
        )}
      </AnimatePresence>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  return ctx;
}
