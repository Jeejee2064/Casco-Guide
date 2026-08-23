"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Stagger, StaggerItem, EASE_OUT } from "./motion";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";
import type { SpotVibe } from "@/lib/types/database";

/**
 * The flashy, discoverable entry point into vibes mode — replaces what used
 * to be an immediate chip-row swap (see ExploreFilterBar). Picking a card
 * hands the vibe back to the caller, which filters the spot list down to
 * that vibe, highest-relevance first (see SpotsExplorerSection/SpotExplorer).
 *
 * Layout is centered/scaled on desktop and a bottom sheet on mobile — one
 * component, two presentations via Tailwind breakpoints, rather than
 * branching on a media query, so it never has to guess before hydration.
 */
export function VibesModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (vibe: SpotVibe) => void;
}) {
  const t = useTranslations("filters");
  const tVibe = useTranslations("vibe");
  const tDescriptor = useTranslations("vibeDescriptors");

  // Which card is mid pulse-and-close — reset whenever the modal is closed
  // (not on unmount: this component stays mounted across opens, only its
  // AnimatePresence children come and go) so a stale pulse never replays on
  // the next open.
  const [pulsing, setPulsing] = useState<SpotVibe | null>(null);
  useEffect(() => {
    const resetPulse = () => {
      if (!open) setPulsing(null);
    };
    resetPulse();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("vibesModalTitle")}
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="safe-bottom fixed inset-x-0 bottom-0 z-[71] max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 text-foreground shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-none sm:w-[calc(100%-2rem)] sm:max-w-[600px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-bold leading-snug sm:text-xl">
                {t("vibesModalTitle")}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3" show={open}>
              {SPOT_VIBES.map((v) => {
                const meta = VIBE_META[v];
                const Icon = meta.icon;
                const isPulsing = pulsing === v;
                return (
                  <StaggerItem key={v}>
                    <motion.button
                      type="button"
                      onClick={() => setPulsing(v)}
                      whileHover={{
                        y: -2,
                        boxShadow: `0 12px 28px -10px ${meta.color}66`,
                      }}
                      animate={
                        isPulsing ? { scale: [1, 1.08, 0.97, 1.03, 1] } : { scale: 1, boxShadow: "0 0 0 0 transparent" }
                      }
                      transition={isPulsing ? { duration: 0.4 } : { duration: 0.2 }}
                      onAnimationComplete={() => {
                        if (isPulsing) onSelect(v);
                      }}
                      className="group flex h-[168px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-foreground/[0.04] px-3 py-5 text-center transition-colors hover:bg-foreground/[0.07]"
                    >
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                        style={{ background: `${meta.color}26`, color: meta.color }}
                      >
                        <Icon size={22} strokeWidth={2.25} />
                      </span>
                      <span className="font-heading text-sm font-bold">{tVibe(v)}</span>
                      {/* Clamped, not just wrapped — descriptor length varies
                          per vibe/locale, and a fixed card height (all 6
                          need to match) can't flex to fit the longest one. */}
                      <span className="line-clamp-2 text-[11px] leading-snug text-foreground/50">
                        {tDescriptor(v)}
                      </span>
                    </motion.button>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
