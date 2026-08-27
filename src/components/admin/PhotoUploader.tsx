"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Photo } from "@/lib/types/database";
import { cn } from "@/lib/utils";

// Longest edge any uploaded photo is downscaled to before it ever leaves the
// browser, and the JPEG quality it's re-encoded at. Phone camera photos
// routinely land at 3000x4000px and several MB — uploaded as-is, that's the
// "original" Next's image optimizer has to download from Supabase and
// decode on every cache miss (see getSpotImage/next.config.ts's
// remotePatterns), which is the actual source of a photo taking forever to
// load, not anything in the optimizer's own config. 1920px covers every slot
// a photo renders in site-wide with room to spare (SpotDetailView's hero is
// the widest, at 100vw) — mirrors the `w=1600&q=80` cap already put on the
// category-fallback Unsplash photos in categoryImages.ts, just applied at
// upload time instead of via URL params since these are our own files.
const MAX_UPLOAD_DIMENSION = 1920;
const UPLOAD_JPEG_QUALITY = 0.82;

// Passed straight through, uncompressed — vector art has no pixel dimensions
// to downscale, and re-encoding an animated GIF as a static JPEG would
// silently keep only its first frame.
const SKIP_COMPRESSION_TYPES = new Set(["image/svg+xml", "image/gif"]);

/** Downscales/re-encodes a photo client-side before upload — see
 * MAX_UPLOAD_DIMENSION above for why. Falls back to the original file
 * whenever compression isn't possible or doesn't actually help (a decode
 * failure, an unsupported format, or a source already smaller than what it
 * would re-encode to), so a browser quirk can never block an upload
 * outright. */
async function compressImage(file: File): Promise<File> {
  if (SKIP_COMPRESSION_TYPES.has(file.type)) return file;

  try {
    // `imageOrientation: "from-image"` bakes the EXIF rotation flag into the
    // decoded pixels — without it, a canvas-redrawn photo taken in portrait
    // routinely came out sideways, since canvas itself ignores EXIF.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Flattened onto white first — JPEG carries no alpha channel, so any
    // transparency (e.g. a PNG screenshot) would otherwise turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Uploads to the shared `spot-photos` bucket and returns its public URL.
 * Exported for reuse outside this file (e.g. inline images inserted from
 * ArticleBodyEditor) — the bucket isn't spot-specific despite its name. */
export async function uploadFile(file: File): Promise<string> {
  const supabase = createClient();
  const upload = await compressImage(file);
  const ext = upload.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("spot-photos").upload(path, upload, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("spot-photos").getPublicUrl(path);
  return data.publicUrl;
}

export function FeaturedPhotoUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("admin.spotForm");

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed border-border bg-black/[0.02] dark:bg-white/[0.02]",
        value && "border-solid",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {loading ? (
        <Loader2 className="animate-spin text-aqua" />
      ) : value ? (
        <>
          <Image src={value} alt="" fill sizes="400px" className="object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1.5 text-foreground/50">
          <Upload size={22} />
          <span className="text-xs font-semibold">{t("uploadHint")}</span>
        </div>
      )}
    </div>
  );
}

export function GalleryUploader({
  value,
  onChange,
  max = 5,
}: {
  value: Photo[];
  onChange: (photos: Photo[]) => void;
  max?: number;
}) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("admin.spotForm");

  const handleFiles = async (files: FileList) => {
    setLoading(true);
    try {
      const uploads = await Promise.all(
        Array.from(files)
          .slice(0, max - value.length)
          .map(async (file) => ({ url: await uploadFile(file), caption: "" })),
      );
      onChange([...value, ...uploads]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {value.map((photo, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
            <Image src={photo.url} alt={photo.caption ?? ""} fill sizes="150px" className="object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-foreground/40 hover:text-aqua"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            <span className="text-[10px] font-semibold">{t("gallery")}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
