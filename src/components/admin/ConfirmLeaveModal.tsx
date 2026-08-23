"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ConfirmLeaveLabels {
  title: string;
  message: string;
  saveAndLeave: string;
  leaveWithoutSaving: string;
  stay: string;
  close: string;
}

/**
 * Confirmation modal shown when the admin tries to navigate away from a
 * dirty Spot/Article editor — sidebar link, or any other in-page link (see
 * UnsavedChangesContext, which owns the click interception this responds
 * to). Three explicit choices rather than a plain `confirm()`: saving
 * before leaving is one click away instead of forcing a "go back, hit
 * Save, come back and click the link again" round trip.
 */
export function ConfirmLeaveModal({
  labels,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onStay,
}: {
  labels: ConfirmLeaveLabels;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onStay: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onStay();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onStay}
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral/10 text-coral">
              <AlertTriangle size={17} />
            </span>
            <h2 className="font-heading text-base font-bold">{labels.title}</h2>
          </div>
          <button
            type="button"
            onClick={onStay}
            aria-label={labels.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <p className="p-4 text-sm text-foreground/70">{labels.message}</p>

        <div className="flex flex-col gap-2 border-t border-border p-4">
          <Button type="button" variant="primary" onClick={onSaveAndLeave}>
            {labels.saveAndLeave}
          </Button>
          <Button type="button" variant="coral" onClick={onLeaveWithoutSaving}>
            {labels.leaveWithoutSaving}
          </Button>
          <Button type="button" variant="outline" onClick={onStay}>
            {labels.stay}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
