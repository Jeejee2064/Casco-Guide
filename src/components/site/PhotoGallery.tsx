"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { Expand, ImageOff, Images } from "lucide-react";
import { useTranslations } from "next-intl";
import { PhotoLightbox } from "./PhotoLightbox";
import type { Photo } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/**
 * Detail-page photo gallery — up to 5 photos.
 * Desktop: a 1-big + up-to-4-small bento grid, tuned per photo count.
 * Mobile: a swipeable single-photo carousel.
 * Any photo opens `PhotoLightbox`, a fullscreen viewer with its own
 * swipe/arrow/thumbnail navigation.
 */
export function PhotoGallery({
  photos,
  alt,
  placeholder,
}: {
  photos: Photo[];
  /** Base alt text — combined with a photo's own caption or index. */
  alt: string;
  /** Rendered instead of the gallery when there are no photos yet. */
  placeholder?: ReactNode;
}) {
  const t = useTranslations("gallery");
  const shown = photos.slice(0, 5);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: shown.length > 1 });
  const [mobileIndex, setMobileIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setMobileIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  if (shown.length === 0) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-card)] sm:aspect-[21/9]">
        {placeholder ?? (
          <div className="flex h-full items-center justify-center bg-foreground/5">
            <ImageOff size={40} className="text-foreground/25" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Mobile — swipeable single-photo carousel */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-card)] sm:hidden">
        <div className="h-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {shown.map((photo, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setLightboxIndex(i)}
                aria-label={photo.caption ?? `${alt} ${i + 1}`}
                className="relative h-full min-w-0 flex-[0_0_100%]"
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? `${alt} ${i + 1}`}
                  fill
                  sizes="100vw"
                  className="object-cover"
                  preload={i === 0}
                />
              </button>
            ))}
          </div>
        </div>
        {shown.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {shown.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === mobileIndex ? "w-4 bg-white" : "w-1.5 bg-white/50",
                )}
              />
            ))}
          </div>
        )}
        <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          <Images size={12} /> {mobileIndex + 1}/{shown.length}
        </span>
      </div>

      {/* Desktop — bento grid, layout tuned to the photo count */}
      <div
        className={cn(
          "hidden gap-1.5 overflow-hidden rounded-[var(--radius-card)] sm:grid sm:h-[360px] lg:h-[440px]",
          shown.length === 1 && "grid-cols-1",
          shown.length === 2 && "grid-cols-2",
          (shown.length === 3 || shown.length === 4) && "grid-cols-2 grid-rows-2",
          shown.length >= 5 && "grid-cols-4 grid-rows-2",
        )}
      >
        {shown.map((photo, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setLightboxIndex(i)}
            aria-label={photo.caption ?? `${alt} ${i + 1}`}
            className={cn(
              "group relative overflow-hidden",
              shown.length === 3 && i === 0 && "row-span-2",
              shown.length >= 5 && (i === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-1"),
            )}
          >
            <Image
              src={photo.url}
              alt={photo.caption ?? `${alt} ${i + 1}`}
              fill
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              preload={i === 0}
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
          </button>
        ))}
      </div>

      {shown.length > 1 && (
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="mt-3 hidden items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold shadow-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 sm:inline-flex"
        >
          <Expand size={14} /> {t("viewAll", { count: shown.length })}
        </button>
      )}

      <AnimatePresence>
        {lightboxIndex !== null && (
          <PhotoLightbox
            photos={shown}
            startIndex={lightboxIndex}
            altBase={alt}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
