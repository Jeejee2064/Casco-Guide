"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode, Ref } from "react";

/** Expo-out — the "premium" reveal curve used across entrance animations. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Snappy, slightly bouncy spring — reserved for tap/press feedback so the
 *  UI reads as touchable, native-app chrome rather than a static webpage. */
export const TAP_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

/**
 * Reveals its children with a subtle upward fade and a light stagger, once
 * they scroll into view. Wrap a grid/list in `Stagger` and each direct
 * visual child in `StaggerItem`.
 *
 * Pass `show` to switch it from scroll-triggered to controlled mode — the
 * stagger plays once `show` turns true instead of on viewport entry. Use
 * this to gate a reveal on an external event (e.g. a hero image finishing
 * `onLoad`) rather than scroll position. `delay` adds to the container's
 * `delayChildren`, e.g. to let a controlled reveal start just after
 * whatever it's chained from (the hero photo's own fade-in) has begun.
 */
export function Stagger({
  children,
  className,
  amount = 0.15,
  as: Component = motion.div,
  show,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  as?: typeof motion.div;
  show?: boolean;
  delay?: number;
}) {
  const As = Component;
  const variants: Variants = delay
    ? { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 + delay } } }
    : staggerContainer;
  const trigger =
    show === undefined
      ? { whileInView: "show", viewport: { once: true, amount } }
      : { animate: show ? "show" : "hidden" };

  return (
    <As className={className} variants={variants} initial="hidden" {...trigger}>
      {children}
    </As>
  );
}

export function StaggerItem({
  children,
  className,
  layout = false,
  ref,
  enter = false,
  delay = 0,
  exitFast = false,
}: {
  children: ReactNode;
  className?: string;
  /** Smoothly animate to a new grid position when siblings are added/removed (e.g. filtering). */
  layout?: boolean | "position";
  /** Forwarded to the root element — AnimatePresence `popLayout` needs it to take leaving items out of the flow. */
  ref?: Ref<HTMLDivElement>;
  /** Play an entrance on mount even though the parent <Stagger> has already revealed (for items added later, e.g. after filtering). */
  enter?: boolean;
  /** Delay (s) for that entrance — use a small per-index value for a light cascade. */
  delay?: number;
  /** Short fade on exit instead of the slow reveal-style one. */
  exitFast?: boolean;
}) {
  return (
    <motion.div
      ref={ref}
      layout={layout}
      className={className}
      variants={fadeUp}
      transition={{ layout: { duration: 0.8, ease: EASE_OUT } }}
      {...(enter
        ? {
            initial: { opacity: 0, y: 22 },
            animate: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE_OUT, delay } },
          }
        : {})}
      exit={exitFast ? { opacity: 0, transition: { duration: 0.3, ease: "easeOut" } } : "hidden"}
    >
      {children}
    </motion.div>
  );
}

/** Adds native-app tap feedback (a light press-down) to any element. */
export function Tappable({
  children,
  className,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
      whileTap={{ scale: 0.96 }}
      transition={TAP_SPRING}
    >
      {children}
    </motion.button>
  );
}
