"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Languages, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface TranslationSyncLabels {
  title: string;
  /** `{modified}`/`{target}` placeholders already interpolated by the caller. */
  message: string;
  switchTo: string;
  saveAnyway: string;
  close: string;
}

/**
 * Confirmation modal shown when a bilingual admin form (Spot/Event/Article)
 * is about to be saved but only one of ES/EN was actually edited since the
 * last save — see `useTranslationSyncGuard`. Lets the editor jump straight
 * to the untouched language tab instead of accidentally shipping content
 * that's now out of sync between languages.
 */
export function TranslationSyncModal({
  labels,
  onSwitch,
  onSaveAnyway,
  onClose,
}: {
  labels: TranslationSyncLabels;
  onSwitch: () => void;
  onSaveAnyway: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: "100%", opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="relative w-full max-w-sm overflow-hidden bg-surface shadow-2xl sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-magenta/10 text-magenta">
              <Languages size={17} />
            </span>
            <h2 className="font-heading text-base font-bold">{labels.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <p className="p-4 text-sm text-foreground/70">{labels.message}</p>

        <div className="flex flex-col gap-2 border-t border-border p-4">
          <Button type="button" variant="primary" onClick={onSwitch}>
            {labels.switchTo}
          </Button>
          <Button type="button" variant="outline" onClick={onSaveAnyway}>
            {labels.saveAnyway}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
