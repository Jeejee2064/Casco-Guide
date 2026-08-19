"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Photo } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/**
 * Fullscreen photo viewer — click any thumbnail in `PhotoGallery` to open here.
 * Swipe/arrow-key/thumbnail-strip navigation, Escape or backdrop click to close.
 */
export function PhotoLightbox({
  photos,
  startIndex,
  altBase,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  altBase: string;
  onClose: () => void;
}) {
  const t = useTranslations("gallery");
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: photos.length > 1, startIndex });
  const [selectedIndex, setSelectedIndex] = useState(startIndex);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") scrollPrev();
      if (e.key === "ArrowRight") scrollNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, scrollPrev, scrollNext]);

  const current = photos[selectedIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-4 p-4 text-white sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-semibold tabular-nums text-white/80">
          {selectedIndex + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
        <div className="h-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {photos.map((photo, i) => (
              <div
                key={i}
                className="relative flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-3 sm:p-10"
              >
                <div className="relative h-full w-full">
                  <Image
                    src={photo.url}
                    alt={photo.caption ?? `${altBase} — ${i + 1}/${photos.length}`}
                    fill
                    sizes="100vw"
                    className="object-contain"
                    priority={i === startIndex}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              aria-label={t("previous")}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label={t("next")}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {current?.caption && (
        <p
          className="px-4 pb-2 text-center text-sm text-white/70"
          onClick={(e) => e.stopPropagation()}
        >
          {current.caption}
        </p>
      )}

      {photos.length > 1 && (
        <div
          className="scrollbar-none flex justify-center gap-2 overflow-x-auto p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((photo, i) => (
            <button
              type="button"
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`${i + 1}/${photos.length}`}
              className={cn(
                "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-opacity",
                i === selectedIndex ? "opacity-100 ring-white" : "opacity-50 ring-transparent hover:opacity-80",
              )}
            >
              <Image src={photo.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
