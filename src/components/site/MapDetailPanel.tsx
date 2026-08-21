"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { cn } from "@/lib/utils";

export interface DetailPanelAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/** Domain-agnostic content shape — SpotMap normalizes a Spot or an EventRow
 * into this before handing it to the panel, so this component doesn't need
 * to know about either type. */
export interface DetailPanelContent {
  photoUrl: string | null;
  /** Shown in place of the photo when `photoUrl` is null. */
  photoFallback: ReactNode;
  featuredLabel?: string;
  categoryLabel: string;
  categoryColor: string;
  categoryIcon: ReactNode;
  title: string;
  subtitle?: string | null;
  metaItems: string[];
  description?: string | null;
  actions: DetailPanelAction[];
}

// How far (px) or how fast (px/s) a downward drag on the mobile sheet has to
// go before it counts as "let go of this", not just a rubber-band bounce.
const SHEET_DISMISS_DISTANCE = 120;
const SHEET_DISMISS_VELOCITY = 500;

/**
 * Renders the selected pin's info as a Google-Maps-style side panel on
 * desktop (floats over the map's left edge, doesn't resize it) and as a
 * bottom sheet on mobile (viewport-anchored, swipe-down to dismiss) — one
 * content shape, two chrome treatments picked with a `md:` breakpoint
 * rather than JS, so there's no layout flash while that's determined.
 */
export function MapDetailPanel({
  content,
  closeLabel,
  onClose,
  desktopTopOffsetPx,
}: {
  content: DetailPanelContent | null;
  closeLabel: string;
  onClose: () => void;
  /** Pushes the desktop panel down below whatever floating chrome (e.g.
   * ExploreFilterBar in fullScreen mode) already occupies the map's top
   * edge — defaults to the panel's own `top-4`/16px when omitted. */
  desktopTopOffsetPx?: number;
}) {
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!content) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [content, onClose]);

  // Move focus into whichever chrome is actually visible, for a11y.
  useEffect(() => {
    if (!content) return;
    const isDesktop = window.matchMedia?.("(min-width: 768px)").matches;
    (isDesktop ? desktopRef.current : sheetRef.current)?.focus();
  }, [content]);

  return (
    <>
      {/* Desktop — side panel, floats over the map's left edge. */}
      <AnimatePresence>
        {content && (
          <motion.div
            key="map-panel-desktop"
            ref={desktopRef}
            role="dialog"
            aria-modal="true"
            aria-label={content.title}
            tabIndex={-1}
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            style={desktopTopOffsetPx != null ? { top: desktopTopOffsetPx } : undefined}
            className={cn(
              // Sized to content (capped, not stretched) — a short
              // description shouldn't leave a card full of empty space the
              // way `top-4 bottom-4` would.
              "map-detail-panel glass safe-top absolute left-4 top-4 z-[1250] hidden max-h-[calc(100%-2rem)] w-[380px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border shadow-2xl outline-none md:flex",
              content.featuredLabel && "map-detail-panel--featured",
            )}
          >
            <PanelBody content={content} onClose={onClose} closeLabel={closeLabel} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile — dimmed backdrop behind the sheet, tap to dismiss. */}
      <AnimatePresence>
        {content && (
          <motion.div
            key="map-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[1240] bg-black/30 backdrop-blur-[2px] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile — bottom sheet, viewport-anchored (not scoped to the map
          box) so it comes up from the true bottom of the screen. */}
      <AnimatePresence>
        {content && (
          <motion.div
            key="map-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={content.title}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info: PanInfo) => {
              if (info.offset.y > SHEET_DISMISS_DISTANCE || info.velocity.y > SHEET_DISMISS_VELOCITY) {
                onClose();
              }
            }}
            className={cn(
              "map-detail-panel safe-bottom fixed inset-x-0 bottom-0 z-[1250] flex max-h-[75vh] flex-col overflow-hidden rounded-t-[var(--radius-card)] border-t border-border bg-surface shadow-2xl outline-none md:hidden",
              content.featuredLabel && "map-detail-panel--featured",
            )}
          >
            {/* Drag handle — purely visual, the whole sheet is draggable. */}
            <div className="flex shrink-0 justify-center pb-1 pt-2.5">
              <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
            </div>
            <PanelBody content={content} onClose={onClose} closeLabel={closeLabel} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PanelBody({
  content,
  onClose,
  closeLabel,
}: {
  content: DetailPanelContent;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className="relative h-44 w-full shrink-0 bg-gradient-to-br from-aqua/20 to-coral/20 bg-cover bg-center"
        style={content.photoUrl ? { backgroundImage: `url('${content.photoUrl}')` } : undefined}
      >
        {!content.photoUrl && (
          <div className="flex h-full w-full items-center justify-center text-aqua-dark">
            {content.photoFallback}
          </div>
        )}
        <motion.button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          whileTap={{ scale: 0.9 }}
          transition={TAP_SPRING}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          <X size={16} />
        </motion.button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {content.featuredLabel && (
          <span className="map-detail-panel__featured-badge inline-flex w-fit items-center gap-1 rounded-full bg-magenta/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-magenta">
            ★ {content.featuredLabel}
          </span>
        )}
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
          style={{ background: content.categoryColor }}
        >
          {content.categoryIcon}
          {content.categoryLabel}
        </span>
        <h3 className="font-heading text-lg font-extrabold leading-tight">{content.title}</h3>
        {content.subtitle && <p className="text-sm text-foreground/60">{content.subtitle}</p>}
        {content.metaItems.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm font-semibold opacity-80">
            {content.metaItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
        {content.description && (
          <p className="text-sm leading-relaxed text-foreground/70">{content.description}</p>
        )}

        <div className={cn("flex gap-2", content.description ? "pt-3" : "pt-1")}>
          {content.actions.map((action) => (
            <motion.button
              key={action.label}
              type="button"
              onClick={action.onClick}
              whileTap={{ scale: 0.97 }}
              transition={TAP_SPRING}
              className={cn(
                "flex-1 rounded-[var(--radius-button)] border px-3 py-2.5 text-sm font-bold transition-colors",
                action.primary
                  ? "border-transparent bg-aqua text-white hover:bg-aqua-dark"
                  : "border-border bg-transparent hover:bg-foreground/5",
              )}
            >
              {action.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
