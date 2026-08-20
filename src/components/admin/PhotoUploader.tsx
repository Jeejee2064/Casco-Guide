"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Photo } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/** Uploads to the shared `spot-photos` bucket and returns its public URL.
 * Exported for reuse outside this file (e.g. inline images inserted from
 * ArticleBodyEditor) — the bucket isn't spot-specific despite its name. */
export async function uploadFile(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("spot-photos").upload(path, file, {
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
