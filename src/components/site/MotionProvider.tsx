"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * App-wide Framer Motion config. `reducedMotion="user"` makes every
 * `motion.*` component automatically honor the OS-level "reduce motion"
 * setting (transforms are stripped, opacity fades remain) without every
 * component having to check `prefers-reduced-motion` itself.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
