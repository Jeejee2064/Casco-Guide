"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type LoadingImageProps = Omit<ImageProps, "fill" | "onLoad"> & {
  /** Fires once the real photo has actually painted — on top of the
   * built-in cross-fade, callers that gate further content on the photo
   * (e.g. SpotDetailView's hero) hook into this instead of re-implementing
   * their own `onLoad`. */
  onLoad?: () => void;
  /** Size of the tower mark while the photo loads — the default suits a
   * card-sized photo; pass something smaller (e.g. "h-6 w-6") for a
   * thumbnail-sized slot so the mark doesn't dwarf the frame. */
  iconClassName?: string;
};

/**
 * Drop-in replacement for `next/image` (always `fill`) for every real photo
 * on the public site — a spot/event/article picture, a gallery shot, a map
 * popup thumbnail. Until the photo has actually finished loading, shows the
 * app's tower mark gently breathing over a soft skeleton instead of a blank
 * box or a jarring pop-in; the real photo then cross-fades over it.
 *
 * Requires a sized, `position: relative` parent — same requirement `fill`
 * itself has, since this renders both the skeleton and the image absolutely
 * within it.
 */
export function LoadingImage({
  className,
  iconClassName,
  onLoad,
  onError,
  ...props
}: LoadingImageProps) {
  const [ready, setReady] = useState(false);

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-foreground/5 transition-opacity duration-500",
          ready ? "opacity-0" : "opacity-100",
        )}
      >
        <div className={cn("relative h-9 w-9", iconClassName)}>
          {/* The mark itself holds still (just a slow breathe) — it's this
              ring that reads as "working on it", scanning around the tile
              like a compass or a radar sweep rather than the tile itself
              pulsing in size. */}
          <span aria-hidden="true" className="tower-halo absolute -inset-[28%] rounded-full" />
          <div className="relative h-full w-full overflow-hidden rounded-lg shadow-sm">
            {/* Plain <img>, not next/image — this is a tiny local asset shown
                while next/image's own optimizer is still working on the real
                photo, so routing it through that same pipeline would just add
                another request to wait on. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-tower.svg" alt="" className="tower-breathe block h-full w-full" />
          </div>
        </div>
      </div>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- `alt` is required by
          LoadingImageProps (via ImageProps) and always present in `props`;
          the rule can't see through the spread. */}
      <Image
        {...props}
        fill
        className={cn("opacity-0 transition-opacity duration-500", ready && "opacity-100", className)}
        onLoad={() => {
          setReady(true);
          onLoad?.();
        }}
        onError={(e) => {
          // A broken photo shouldn't leave the loader spinning forever.
          setReady(true);
          onError?.(e);
        }}
      />
    </>
  );
}
