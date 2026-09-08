"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ScanEye, Upload, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  extractSpotFromScreenshot,
  type ExtractedSpot,
  type ExtractSpotError,
} from "@/lib/actions/importSpot";

const KNOWN_ERRORS: ExtractSpotError[] = [
  "unauthorized",
  "missing_api_key",
  "no_image",
  "too_many_images",
  "image_too_large",
  "unsupported_type",
  "network",
  "api",
  "empty_response",
  "parse_failed",
  "invalid_shape",
];

const MAX_IMAGES = 5;

interface Picked {
  file: File;
  preview: string;
}

/**
 * "Import from Google Maps screenshot" — opens a modal, lets the admin drop
 * in up to 5 screenshots of the same place (a single Maps card rarely fits
 * one screenshot: name+category, address+hours, and the right-click
 * coordinates are usually separate captures), sends them together to
 * `extractSpotFromScreenshot` (Claude vision, one combined request), and
 * hands whatever it could read back to the caller via `onExtract`. The
 * caller (SpotForm) merges the result into its draft — nothing is saved
 * here, so the admin always reviews/corrects before hitting the form's own
 * Save button.
 */
export function ImportFromScreenshot({ onExtract }: { onExtract: (data: ExtractedSpot) => void }) {
  const t = useTranslations("admin.spotForm.import");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPicked((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(t("errors.unsupported_type"));
        return false;
      }
      return true;
    });
    if (!incoming.length) return;
    setPicked((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(t("errors.too_many_images"));
        return prev;
      }
      const accepted = incoming.slice(0, room);
      if (incoming.length > accepted.length) toast.error(t("errors.too_many_images"));
      return [...prev, ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) }))];
    });
  };

  const removeAt = (i: number) => {
    setPicked((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  // Ctrl+V a screenshot straight from the clipboard while the modal is open
  // — the whole point of this tool is skipping "save file, then upload it",
  // and a clipboard screenshot is the common case. Listens on `document`
  // rather than a specific element so it fires regardless of what's
  // focused inside the modal (drop zone, a thumbnail, a button).
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
    // addFiles reads/writes state through the functional setPicked updater,
    // so it stays correct even though this effect only re-binds on `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAnalyze = () => {
    if (!picked.length) return;
    const formData = new FormData();
    picked.forEach((p) => formData.append("screenshots", p.file));
    startTransition(async () => {
      const res = await extractSpotFromScreenshot(formData);
      if (res.error || !res.data) {
        const key = res.error && KNOWN_ERRORS.includes(res.error) ? res.error : "unknown";
        toast.error(t(`errors.${key}`));
        return;
      }
      onExtract(res.data);
      toast.success(t("success"));
      close();
    });
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ScanEye size={15} />
        {t("button")}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={pending ? undefined : close}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[var(--radius-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="flex items-center gap-1.5 font-heading text-base font-bold">
                    <Sparkles size={16} className="text-magenta" />
                    {t("modalTitle")}
                  </h2>
                  <p className="text-xs text-foreground/50">{t("hint")}</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  aria-label={t("close")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto p-4">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />

                <div className="grid grid-cols-3 gap-3">
                  {picked.map((p, i) => (
                    <div
                      key={p.preview}
                      className="relative aspect-square overflow-hidden rounded-xl border border-border"
                    >
                      <Image src={p.preview} alt="" fill sizes="200px" className="object-cover" />
                      <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                      {!pending && (
                        <button
                          type="button"
                          onClick={() => removeAt(i)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {picked.length < MAX_IMAGES && (
                    <div
                      onClick={() => !pending && inputRef.current?.click()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-foreground/50 hover:text-aqua"
                    >
                      <Upload size={20} />
                      <span className="text-center text-[10px] font-semibold leading-tight">
                        {picked.length ? t("addAnother") : t("dropHint")}
                      </span>
                    </div>
                  )}
                </div>

                {pending && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-foreground/70">
                    <Loader2 className="animate-spin text-aqua" size={18} />
                    {t("analyzing")}
                  </div>
                )}

                <p className="text-xs text-foreground/50">{t("reviewNotice")}</p>
              </div>

              <div className="flex justify-end gap-3 border-t border-border p-4">
                <Button type="button" variant="outline" onClick={close} disabled={pending}>
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleAnalyze}
                  disabled={!picked.length || pending}
                >
                  {pending ? t("analyzing") : t("apply")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
