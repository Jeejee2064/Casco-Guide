"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { Eye, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { TagInput } from "./TagInput";
import { FeaturedPhotoUploader } from "./PhotoUploader";
import { ArticleEditor } from "./ArticleEditor";
import { LangTabs } from "./LangTabs";
import { LocationPickerModal } from "./LocationPickerModal";
import { PreviewModeTabs, type PreviewMode } from "./PreviewModeTabs";
import { EventDetailView } from "@/components/site/EventDetailView";
import { EventCard } from "@/components/site/EventCard";
import { slugify } from "@/lib/utils";
import { upsertEvent, type EventFormValues } from "@/lib/actions/events";
import { EVENT_CATEGORIES } from "@/lib/eventCategories";
import type { Locale } from "@/i18n/routing";
import type { EventRecord, EventRow } from "@/lib/types/database";

type Lang = "es" | "en";
type LocalizedField = "title" | "description" | "article";

/** Builds a single-language `EventRow` from the in-progress (unsaved)
 * bilingual form values, so it can be fed straight into `EventDetailModal`
 * for a live "preview before publishing" — same fallback rules as
 * `localizeEvent` in lib/i18n/content.ts, just read from form state instead
 * of a saved Supabase row. */
function toPreviewEvent(values: EventFormValues, lang: Lang, existing?: EventRecord): EventRow {
  const pick = (es: string, en: string) => (lang === "en" ? en || es : es || en);
  const pickNullable = (es: string, en: string) => pick(es, en) || null;

  return {
    id: existing?.id ?? "preview",
    title: pick(values.title_es, values.title_en),
    slug: values.slug,
    description: pickNullable(values.description_es, values.description_en),
    article: pickNullable(values.article_es, values.article_en),
    category: values.category,
    date: values.date,
    time_start: values.time_start,
    time_end: values.time_end || null,
    recurring: values.recurring,
    recurring_until: values.recurring_until || null,
    latitude: values.latitude,
    longitude: values.longitude,
    address: values.address || null,
    spot_id: values.spot_id || null,
    capacity: values.capacity,
    price: values.price,
    booking_url: values.booking_url || null,
    organizer: values.organizer || null,
    organizer_contact: values.organizer_contact || null,
    photo: values.photo || null,
    photos: values.photos,
    tags: values.tags,
    is_featured: values.is_featured,
    is_verified: values.is_verified,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: existing?.updated_at ?? new Date().toISOString(),
    last_verified: existing?.last_verified ?? null,
  };
}

const emptyValues = (): EventFormValues => ({
  title_es: "",
  title_en: "",
  slug: "",
  description_es: "",
  description_en: "",
  article_es: "",
  article_en: "",
  category: "music",
  date: new Date().toISOString().slice(0, 10),
  time_start: "18:00",
  time_end: "",
  recurring: "once",
  recurring_until: "",
  latitude: 8.9528,
  longitude: -79.5347,
  address: "",
  spot_id: "",
  capacity: null,
  price: null,
  booking_url: "",
  organizer: "",
  organizer_contact: "",
  photo: "",
  photos: [],
  tags: [],
  is_featured: false,
  is_verified: false,
});

const fromEvent = (event: EventRecord): EventFormValues => ({
  id: event.id,
  title_es: event.title_es,
  title_en: event.title_en,
  slug: event.slug,
  description_es: event.description_es ?? "",
  description_en: event.description_en ?? "",
  article_es: event.article_es ?? "",
  article_en: event.article_en ?? "",
  category: event.category,
  date: event.date,
  time_start: event.time_start,
  time_end: event.time_end ?? "",
  recurring: event.recurring,
  recurring_until: event.recurring_until ?? "",
  latitude: event.latitude,
  longitude: event.longitude,
  address: event.address ?? "",
  spot_id: event.spot_id ?? "",
  capacity: event.capacity,
  price: event.price,
  booking_url: event.booking_url ?? "",
  organizer: event.organizer ?? "",
  organizer_contact: event.organizer_contact ?? "",
  photo: event.photo ?? "",
  photos: event.photos,
  tags: event.tags,
  is_featured: event.is_featured,
  is_verified: event.is_verified,
});

export function EventForm({ event }: { event?: EventRecord }) {
  const t = useTranslations("admin.eventForm");
  const tPreview = useTranslations("admin.preview");
  const tCat = useTranslations("events.recurring");
  const tEventCat = useTranslations("eventCategory");
  const locale = useLocale() as Locale;
  const [values, setValues] = useState<EventFormValues>(event ? fromEvent(event) : emptyValues());
  const [slugTouched, setSlugTouched] = useState(Boolean(event));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [pending, startTransition] = useTransition();
  const mobileFrameRef = useRef<HTMLIFrameElement>(null);

  const set = <K extends keyof EventFormValues>(key: K, val: EventFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  const previewEvent = useMemo(() => toPreviewEvent(values, lang, event), [values, lang, event]);

  // Mobile mode renders the real detail page inside an <iframe> so it gets
  // its own (narrow) viewport — see admin/preview/events/page.tsx for why.
  useEffect(() => {
    if (!previewOpen || previewMode !== "mobile") return;
    mobileFrameRef.current?.contentWindow?.postMessage(
      { type: "event-preview", event: previewEvent },
      window.location.origin,
    );
  }, [previewOpen, previewMode, previewEvent]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "event-preview-ready") {
        mobileFrameRef.current?.contentWindow?.postMessage(
          { type: "event-preview", event: previewEvent },
          window.location.origin,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewEvent]);

  const localized = (field: LocalizedField) =>
    values[`${field}_${lang}` as keyof EventFormValues] as string;

  const setLocalized = (field: LocalizedField, val: string) =>
    setValues((v) => ({ ...v, [`${field}_${lang}`]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title_es.trim()) {
      toast.error(t("missingTitle", { lang: "ES" }));
      setLang("es");
      return;
    }
    if (!values.title_en.trim()) {
      toast.error(t("missingTitle", { lang: "EN" }));
      setLang("en");
      return;
    }
    startTransition(async () => {
      const res = await upsertEvent(locale, { ...values, id: event?.id });
      if (res?.error) toast.error(res.error);
      else toast.success(t("saved"));
    });
  };

  const titleIncomplete = { es: !values.title_es.trim(), en: !values.title_en.trim() };

  // The preview (EventDetailView/EventCard, public components with plain
  // <button>s that don't set type="button") must render OUTSIDE the <form>
  // below — a bare <button> defaults to type="submit", so any click inside
  // it while still nested in the form would silently save the draft and
  // redirect to the list. Keeping it a sibling of <form>, not a descendant,
  // makes that impossible regardless of what that shared component does
  // internally.
  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-semibold">{t("translationLabel")}</p>
          <p className="text-xs text-foreground/50">{t("translationHint")}</p>
        </div>
        <LangTabs value={lang} onChange={setLang} incomplete={titleIncomplete} />
      </div>

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="title">
              {t("title")} <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
            </Label>
            <Input
              id="title"
              required
              value={localized("title")}
              onChange={(e) => {
                setLocalized("title", e.target.value);
                if (!slugTouched && lang === "es") set("slug", slugify(e.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              required
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
            />
          </div>
        </div>
        <div>
          <Label>
            Description <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
          </Label>
          <Textarea
            rows={2}
            value={localized("description")}
            onChange={(e) => setLocalized("description", e.target.value)}
          />
        </div>
        <div>
          <Label>
            Article <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
          </Label>
          <ArticleEditor
            key={lang}
            value={localized("article")}
            onChange={(v) => setLocalized("article", v)}
          />
        </div>
        <div>
          <Label>Category</Label>
          <Select
            value={values.category}
            onChange={(e) => set("category", e.target.value as EventFormValues["category"])}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tEventCat(c)}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Timing">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="date">{t("date")}</Label>
            <Input
              id="date"
              type="date"
              required
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="start">{t("timeStart")}</Label>
            <Input
              id="start"
              type="time"
              required
              value={values.time_start}
              onChange={(e) => set("time_start", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end">{t("timeEnd")}</Label>
            <Input
              id="end"
              type="time"
              value={values.time_end}
              onChange={(e) => set("time_end", e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("recurring")}</Label>
            <Select
              value={values.recurring ?? "once"}
              onChange={(e) => set("recurring", e.target.value as EventFormValues["recurring"])}
            >
              {(["once", "daily", "weekly", "monthly"] as const).map((r) => (
                <option key={r} value={r}>
                  {tCat(r)}
                </option>
              ))}
            </Select>
          </div>
          {values.recurring !== "once" && (
            <div>
              <Label htmlFor="until">{t("recurringUntil")}</Label>
              <Input
                id="until"
                type="date"
                value={values.recurring_until}
                onChange={(e) => set("recurring_until", e.target.value)}
              />
            </div>
          )}
        </div>
      </Section>

      <Section title="Location">
        <div>
          <Label htmlFor="address">Address</Label>
          <div className="flex gap-2">
            <Input
              id="address"
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
              <MapPin size={15} />
              Locate on map
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              type="number"
              step="0.000001"
              required
              value={values.latitude}
              onChange={(e) => set("latitude", parseFloat(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              type="number"
              step="0.000001"
              required
              value={values.longitude}
              onChange={(e) => set("longitude", parseFloat(e.target.value))}
            />
          </div>
        </div>
      </Section>

      <Section title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="capacity">{t("capacity")}</Label>
            <Input
              id="capacity"
              type="number"
              value={values.capacity ?? ""}
              onChange={(e) => set("capacity", e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <Label htmlFor="price">{t("price")}</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={values.price ?? ""}
              onChange={(e) => set("price", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="booking">{t("bookingUrl")}</Label>
          <Input
            id="booking"
            value={values.booking_url}
            onChange={(e) => set("booking_url", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="organizer">{t("organizer")}</Label>
            <Input
              id="organizer"
              value={values.organizer}
              onChange={(e) => set("organizer", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="organizerContact">{t("organizerContact")}</Label>
            <Input
              id="organizerContact"
              value={values.organizer_contact}
              onChange={(e) => set("organizer_contact", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="Media">
        <FeaturedPhotoUploader value={values.photo} onChange={(url) => set("photo", url)} />
      </Section>

      <Section title="Tags & status">
        <TagInput value={values.tags} onChange={(tags) => set("tags", tags)} />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.is_featured}
              onChange={(e) => set("is_featured", e.target.checked)}
              className="h-4 w-4 accent-magenta"
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.is_verified}
              onChange={(e) => set("is_verified", e.target.checked)}
              className="h-4 w-4 accent-lime"
            />
            Verified
          </label>
        </div>
      </Section>

      <div className="fixed bottom-0 left-60 right-0 flex justify-end gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye size={15} /> {t("preview")}
        </Button>
        <Button type="submit" variant="coral" disabled={pending}>
          {pending ? "…" : t("save")}
        </Button>
      </div>
    </form>

    <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col bg-background"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewOpen(false)}
                  aria-label={tPreview("close")}
                >
                  <X size={18} />
                </Button>
                <span className="rounded-full bg-magenta px-3 py-1 text-xs font-bold text-white">
                  {t("previewBadge", { lang: lang.toUpperCase() })}
                </span>
              </div>
              <PreviewModeTabs value={previewMode} onChange={setPreviewMode} />
            </div>

            <div className="flex-1 overflow-y-auto">
              {previewMode === "desktop" && (
                <EventDetailView
                  event={previewEvent}
                  hostSpot={null}
                  onBack={() => setPreviewOpen(false)}
                />
              )}

              {previewMode === "card" && (
                <div className="flex min-h-full items-center justify-center bg-black/[0.03] p-8 dark:bg-white/[0.03]">
                  <div className="w-full max-w-sm">
                    <EventCard event={previewEvent} />
                  </div>
                </div>
              )}

              {previewMode === "mobile" && (
                <div className="flex min-h-full items-center justify-center bg-black/[0.03] p-8 dark:bg-white/[0.03]">
                  <div className="h-[812px] w-[375px] max-w-full overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-background shadow-2xl">
                    <iframe
                      ref={mobileFrameRef}
                      src={`/${locale}/admin/preview/events`}
                      title="Mobile preview"
                      className="h-full w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pickerOpen && (
          <LocationPickerModal
            lat={values.latitude}
            lng={values.longitude}
            labels={{
              title: "Locate on map",
              hint: "Tap the map or drag the pin — or paste coordinates below.",
              latitude: "Latitude",
              longitude: "Longitude",
              cancel: "Cancel",
              confirm: "Use this location",
              close: "Close",
            }}
            onConfirm={(lat, lng) => {
              set("latitude", lat);
              set("longitude", lng);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <h2 className="font-heading text-base font-bold">{title}</h2>
      {children}
    </div>
  );
}
