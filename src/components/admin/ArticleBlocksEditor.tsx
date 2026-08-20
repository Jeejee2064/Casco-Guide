"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { GripVertical, ChevronUp, ChevronDown, Link2, MapPin, CalendarDays, Trash2, Plus, Upload, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/components/admin/PhotoUploader";
import { PlaceLinkPicker, type LinkablePlace } from "@/components/admin/PlaceLinkPicker";
import type { ArticleBlockRecord, ArticleLayout } from "@/lib/types/database";

type Lang = "es" | "en";

function emptyBlock(): ArticleBlockRecord {
  return {
    id: crypto.randomUUID(),
    photo: null,
    title_es: "",
    title_en: "",
    text_es: "",
    text_en: "",
    ref_type: null,
    ref_id: null,
    ref_slug: null,
  };
}

/**
 * The "fill in the boxes" structured editor behind the "list" (ranked
 * Top-N) and "photo-story" layouts — see ArticleForm.tsx. Each block can
 * optionally be linked to an existing spot/event (via the same
 * PlaceLinkPicker the free-text editor uses), which also feeds
 * Article.spot_refs/event_refs for the "places mentioned" map.
 */
export function ArticleBlocksEditor({
  layout,
  value,
  onChange,
  places,
  lang,
}: {
  layout: Extract<ArticleLayout, "list" | "photo-story">;
  value: ArticleBlockRecord[];
  onChange: (blocks: ArticleBlockRecord[]) => void;
  places: LinkablePlace[];
  lang: Lang;
}) {
  const t = useTranslations("admin.articleForm.blocks");
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<ArticleBlockRecord>) =>
    onChange(value.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...value];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const handlePhoto = async (id: string, file: File) => {
    setUploadingId(id);
    try {
      const url = await uploadFile(file);
      update(id, { photo: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {value.map((block, i) => (
        <div key={block.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/50">
              <GripVertical size={14} />
              {layout === "list" ? t("rank", { n: i + 1 }) : t("item", { n: i + 1 })}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10">
                <ChevronUp size={15} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="rounded p-1 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10">
                <ChevronDown size={15} />
              </button>
              <button type="button" onClick={() => onChange(value.filter((b) => b.id !== block.id))} className="rounded p-1 text-coral hover:bg-coral/10">
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <PhotoSlot
              url={block.photo}
              loading={uploadingId === block.id}
              onPick={(file) => handlePhoto(block.id, file)}
              onClear={() => update(block.id, { photo: null })}
            />

            <div className="space-y-2">
              <input
                value={(block[`title_${lang}`] as string) ?? ""}
                onChange={(e) => update(block.id, { [`title_${lang}`]: e.target.value } as Partial<ArticleBlockRecord>)}
                placeholder={t("titlePlaceholder")}
                className="w-full rounded-[var(--radius-button)] border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-aqua"
              />
              <textarea
                value={(block[`text_${lang}`] as string) ?? ""}
                onChange={(e) => update(block.id, { [`text_${lang}`]: e.target.value } as Partial<ArticleBlockRecord>)}
                placeholder={t("textPlaceholder")}
                rows={2}
                className="w-full resize-none rounded-[var(--radius-button)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-aqua"
              />

              {block.ref_id ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    block.ref_type === "spot" ? "bg-aqua/15 text-aqua" : "bg-coral/15 text-coral",
                  )}
                >
                  {block.ref_type === "spot" ? <MapPin size={12} /> : <CalendarDays size={12} />}
                  {places.find((p) => p.id === block.ref_id)?.label ?? block.ref_slug}
                  <button type="button" onClick={() => update(block.id, { ref_type: null, ref_id: null, ref_slug: null })}>
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerForId(block.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-aqua hover:underline"
                >
                  <Link2 size={13} /> {t("linkPlace")}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, emptyBlock()])}
        className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-button)] border-2 border-dashed border-border py-2.5 text-sm font-semibold text-foreground/50 hover:border-aqua hover:text-aqua"
      >
        <Plus size={15} /> {layout === "list" ? t("addRank") : t("addItem")}
      </button>

      {pickerForId && (
        <PlaceLinkPicker
          places={places}
          labels={{
            title: t("linkPlace"),
            searchPlaceholder: t("searchPlaceholder"),
            empty: t("noResults"),
            close: t("close"),
            // "article" is unused here — this picker's `places` never includes
            // one (see ArticleForm.tsx) — but PlaceLinkLabels needs the key.
            typeFilter: { all: t("linkTypes.all"), spot: t("linkTypes.spot"), event: t("linkTypes.event"), article: "" },
          }}
          onSelect={(place: LinkablePlace) => {
            // Blocks link to a single spot/event only — this picker is never
            // given articles to choose from (see ArticleForm.tsx), but the
            // guard keeps `place.type` narrowed to what ref_type accepts.
            if (place.type === "article") return;
            update(pickerForId, {
              ref_type: place.type,
              ref_id: place.id,
              ref_slug: place.slug,
              ...(!value.find((b) => b.id === pickerForId)?.[`title_${lang}`]
                ? ({ [`title_${lang}`]: place.label } as Partial<ArticleBlockRecord>)
                : {}),
            });
            setPickerForId(null);
          }}
          onClose={() => setPickerForId(null)}
        />
      )}
    </div>
  );
}

function PhotoSlot({
  url,
  loading,
  onPick,
  onClear,
}: {
  url: string | null;
  loading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <label className="relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-button)] border-2 border-dashed border-border bg-black/[0.02] dark:bg-white/[0.02]">
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      {loading ? (
        <Loader2 className="animate-spin text-aqua" size={18} />
      ) : url ? (
        <>
          <Image src={url} alt="" fill sizes="120px" className="object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <Upload size={18} className="text-foreground/40" />
      )}
    </label>
  );
}
