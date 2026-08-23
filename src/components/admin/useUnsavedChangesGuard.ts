"use client";

import { useEffect, useRef } from "react";
import { useUnsavedChanges } from "./UnsavedChangesContext";

/**
 * Reports "this form differs from what's saved" into the shared
 * UnsavedChangesContext (see Sidebar/(protected)/layout.tsx) so navigating
 * away — via the sidebar, a hard refresh, or closing the tab — asks for
 * confirmation instead of silently discarding the draft.
 *
 * `current` is compared against `initial` (or whatever was last passed to
 * `markSaved`) by JSON equality — cheap and correct here since every Spot/
 * Article form's values are a plain, fully-serializable object (no
 * functions, no `Date` instances, just strings/numbers/booleans/arrays).
 *
 * Same shape/call-site pattern as useTranslationSyncGuard — `initial` is
 * only ever read on the first render (captured into a ref), so recomputing
 * it every render at the call site (`article ? fromArticle(article) :
 * emptyValues()`) is fine.
 */
export function useUnsavedChangesGuard<T>(initial: T, current: T) {
  const baselineRef = useRef(initial);
  const { setDirty } = useUnsavedChanges();

  useEffect(() => {
    setDirty(JSON.stringify(current) !== JSON.stringify(baselineRef.current));
  }, [current, setDirty]);

  // Unmounting — a confirmed navigation away, or a save that redirected —
  // clears the flag so it can't leak into whatever page mounts next (the
  // context/provider outlives any single editor instance).
  useEffect(() => () => setDirty(false), [setDirty]);

  /** Call once a save actually succeeds, so the next comparison is against
   * the just-saved values rather than the form's original load. */
  const markSaved = (values: T) => {
    baselineRef.current = values;
    setDirty(false);
  };

  return { markSaved };
}
