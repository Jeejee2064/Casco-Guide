"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { LoadingImage } from "./LoadingImage";
import { cn } from "@/lib/utils";

export interface DetailPanelAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/** Domain-agnostic content shape — SpotMap normalizes a Spot or an EventRow
 * into this before handing it to the panel, so this component doesn't need
 * to know about either type. */
export interface DetailPanelChild {
  id: string;
  name: string;
  categoryLabel: string;
  categoryIcon: ReactNode;
  onClick: () => void;
}

export interface DetailPanelContent {
  photoUrl: string | null;
  /** Shown in place of the photo when `photoUrl` is null. */
  photoFallback: ReactNode;
  featuredLabel?: string;
  categoryLabel: string;
  categoryIcon: ReactNode;
  title: string;
  subtitle?: string | null;
  metaItems: string[];
  description?: string | null;
  /** The businesses inside this spot, when it's a hub location (e.g. a
   * hotel's on-site restaurant and bar) — rendered directly under the
   * title, on both desktop and mobile (unlike subtitle/meta/description,
   * `compact` doesn't hide this: it's the reason the pin exists). Omitted
   * or empty for a standalone spot. */
  children?: DetailPanelChild[];
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
  compact = false,
}: {
  content: DetailPanelContent | null;
  closeLabel: string;
  onClose: () => void;
  /** Pushes the desktop panel down below whatever floating chrome (e.g.
   * ExploreFilterBar in fullScreen mode) already occupies the map's top
   * edge — defaults to the panel's own `top-4`/16px when omitted. */
  desktopTopOffsetPx?: number;
  /** Trims the panel to photo/badge/title/actions only, no subtitle/meta/
   * description — for ItineraryMap's in-article pins, where the article text
   * around the map already carries that detail. The main SpotMap leaves this
   * off so its pin popup keeps the full info. */
  compact?: boolean;
}) {
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  // The mobile sheet's whole body (photo included — see PanelBody) sits
  // inside a scrollable `overflow-y-auto` div, which on touch devices wins
  // the gesture over Framer Motion's own pointer-based drag detection: a
  // swipe anywhere in that content area gets read as "scroll this", not
  // "drag the sheet", so `drag="y"` alone never actually triggers from a
  // real finger swipe (only from a mouse drag in a desktop browser's
  // touch-emulation devtools, which don't have that conflict). Routing
  // drag start through a dedicated handle — `dragListener={false}` below,
  // paired with this handle's own `onPointerDown` — sidesteps the
  // scrollable area entirely instead of fighting it.
  const sheetDragControls = useDragControls();

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
              // No `safe-top` here (unlike Header/the mobile sheet's
              // `safe-bottom`) — this panel already floats inset from the
              // viewport edge (`top-4`), so the safe-area padding just
              // pushed the photo down, leaving a visible band of card
              // background above it instead of the photo starting flush.
              "map-detail-panel glass absolute left-4 top-4 z-[1250] hidden max-h-[calc(100%-2rem)] w-[380px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border shadow-2xl outline-none md:flex",
              content.featuredLabel && "map-detail-panel--featured",
            )}
          >
            <PanelBody content={content} onClose={onClose} closeLabel={closeLabel} compact={compact} />
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
            dragListener={false}
            dragControls={sheetDragControls}
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
            {/* Dedicated drag handle — not inside PanelBody's scrollable
                content, so a swipe here always reaches Framer Motion's drag
                detection instead of possibly being read as a scroll. */}
            <div
              onPointerDown={(e) => sheetDragControls.start(e)}
              className="flex shrink-0 touch-none justify-center py-2.5"
              aria-hidden="true"
            >
              <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
            </div>
            <PanelBody content={content} onClose={onClose} closeLabel={closeLabel} compact={compact} />
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
  compact,
}: {
  content: DetailPanelContent;
  onClose: () => void;
  closeLabel: string;
  compact: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Shorter on mobile (h-28 vs h-44) — a full-height photo plus the
          subtitle/meta/description block below it could push the actions
          row, or even the close button above it, out of the visible sheet
          on a short phone screen. The gradient at its foot blends the
          photo into `--surface` (the card's own background, mobile only)
          so the badge/title can sit right up against it instead of a hard
          seam, which is what makes the shorter photo read as a deliberate
          crop rather than just "less photo". */}
      <div className="relative h-28 w-full shrink-0 bg-gradient-to-br from-aqua/20 to-coral/20 md:h-44">
        {content.photoUrl ? (
          // Sized/reformatted by the Next Image optimizer (AVIF/WebP, no
          // longer the full-res original) — a raw CSS `background-image`
          // bypasses that entirely, which is what this replaced.
          <LoadingImage
            src={content.photoUrl}
            alt=""
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover"
            iconClassName="h-7 w-7"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-aqua-dark">
            {content.photoFallback}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent md:hidden" />
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
        {/* Neutral, same treatment as CategoryBadge on the grid cards —
            category is identified by icon + label here, not color. */}
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md">
          {content.categoryIcon}
          {content.categoryLabel}
        </span>
        <h3 className="font-heading text-lg font-extrabold leading-tight">{content.title}</h3>
        {/* The hub's businesses, right under its name — shown on mobile too
            (see DetailPanelContent.children's doc comment), unlike every
            other section below which the `compact`/mobile checks trim. */}
        {content.children && content.children.length > 0 && (
          <ul className="-mx-1 flex flex-col gap-0.5">
            {content.children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={child.onClick}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-button)] px-1 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-foreground/5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/70">
                    {child.categoryIcon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{child.name}</span>
                  <span className="shrink-0 text-xs font-medium text-foreground/50">
                    {child.categoryLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Address/date (subtitle) and the fuller description read fine on
            the roomier desktop side panel, but on the mobile sheet they're
            exactly what used to push the close button out of view — mobile
            keeps only the title, the status/rating-style meta line below,
            and the Read more action; the rest is one tap away on the full
            page instead of duplicated here. */}
        {!compact && content.subtitle && (
          <p className="hidden text-sm text-foreground/60 md:block">{content.subtitle}</p>
        )}
        {!compact && content.metaItems.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm font-semibold opacity-80">
            {/* First item is always the "is it open right now" status (see
                SpotMap/ItineraryMap's `metaItems` — hours status first,
                rating/price after) — the one line mobile keeps; anything
                past it is desktop-only. */}
            {content.metaItems.map((item, i) => (
              <span key={item} className={i > 0 ? "hidden md:inline" : undefined}>
                {item}
              </span>
            ))}
          </div>
        )}
        {!compact && content.description && (
          <p className="hidden text-sm leading-relaxed text-foreground/70 md:block">{content.description}</p>
        )}

        <div className={cn("flex gap-2 pt-1", !compact && content.description && "md:pt-3")}>
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
                  ? // `--accent-color` defaults to the brand teal (globals.css)
                    // and gets overridden by SpotMap whenever a single vibe
                    // is selected — so this button tracks whatever's
                    // currently "in focus" instead of always being the same
                    // fixed color.
                    "accent-cta border-transparent text-white"
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
