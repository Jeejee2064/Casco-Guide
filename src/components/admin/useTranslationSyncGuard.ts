"use client";

import { useRef, useState } from "react";

type Lang = "es" | "en";

/** True for any top-level key ending in `_es`/`_en` whose value differs from
 * the baseline — e.g. `title_es`, `hours_note_en`. Nested bilingual fields
 * (like the per-block title_es/text_es pairs in ArticleBlocksEditor) aren't
 * walked; the guard only looks at the form's flat fields. */
function changedLanguages<T extends object>(baseline: T, current: T): Record<Lang, boolean> {
  const changed: Record<Lang, boolean> = { es: false, en: false };
  const base = baseline as Record<string, unknown>;
  const curr = current as Record<string, unknown>;
  for (const key in curr) {
    if (curr[key] === base[key]) continue;
    if (key.endsWith("_es")) changed.es = true;
    else if (key.endsWith("_en")) changed.en = true;
  }
  return changed;
}

/**
 * Guards a bilingual admin form's save against lopsided edits: if the draft
 * only touched one language's fields since the last save, `check()` reports
 * which language was left untouched instead of letting the save through, so
 * the caller can prompt "you only edited ES — also update EN?" before
 * writing to the DB. Editing both languages (or neither) passes straight
 * through — this only catches the asymmetric case.
 *
 * Used by SpotForm/EventForm/ArticleForm together with `TranslationSyncModal`.
 */
export function useTranslationSyncGuard<T extends object>(initial: T) {
  const baselineRef = useRef(initial);
  const [unmodifiedLang, setUnmodifiedLang] = useState<Lang | null>(null);

  /** Returns true if the guard fired (caller should stop and let the modal
   * ask the user what to do) — false means it's safe to save. */
  const check = (current: T): boolean => {
    const changed = changedLanguages(baselineRef.current, current);
    if (changed.es !== changed.en) {
      setUnmodifiedLang(changed.es ? "en" : "es");
      return true;
    }
    return false;
  };

  /** Call once a save actually succeeds, so the next check() compares
   * against the just-saved values rather than the form's original load. */
  const markSaved = (values: T) => {
    baselineRef.current = values;
  };

  const dismiss = () => setUnmodifiedLang(null);

  return { unmodifiedLang, check, markSaved, dismiss };
}
