"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { MapPin, Eye, X, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { TagInput } from "./TagInput";
import { HoursEditor } from "./HoursEditor";
import { FeaturedPhotoUploader, GalleryUploader } from "./PhotoUploader";
import { ArticleEditor } from "./ArticleEditor";
import { LangTabs } from "./LangTabs";
import { LocationPickerModal } from "./LocationPickerModal";
import { PlaceLinkPicker, type LinkablePlace } from "./PlaceLinkPicker";
import { TranslationSyncModal } from "./TranslationSyncModal";
import { useTranslationSyncGuard } from "./useTranslationSyncGuard";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";
import { useUnsavedChanges } from "./UnsavedChangesContext";
import { ImportFromScreenshot } from "./ImportFromScreenshot";
import { PreviewModeTabs, type PreviewMode } from "./PreviewModeTabs";
import { SpotDetailView } from "@/components/site/SpotDetailView";
import { SpotCard } from "@/components/site/SpotCard";
import { CategoryBadge } from "@/components/site/CategoryBadge";
import { SPOT_CATEGORIES } from "@/lib/categories";
import { SPOT_VIBES, VIBE_META } from "@/lib/vibes";
import { groupSpotsByParent } from "@/lib/spots/hierarchy";
import { slugify } from "@/lib/utils";
import { upsertSpot, setSpotParent, type SpotFormValues } from "@/lib/actions/spots";
import type { ExtractedSpot } from "@/lib/actions/importSpot";
import type { Locale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { DAY_KEYS, type Spot, type SpotRecord } from "@/lib/types/database";

type Lang = "es" | "en";
type LocalizedField = "name" | "description" | "article" | "cuisine_type" | "hours_note";

/** Builds a single-language `Spot` from the in-progress (unsaved) bilingual
 * form values, so it can be fed straight into the public `SpotDetailModal`
 * for a live "preview before publishing" — same fallback rules as
 * `localizeSpot` in lib/i18n/content.ts, just read from form state instead
 * of a saved Supabase row. */
function toPreviewSpot(values: SpotFormValues, lang: Lang, existing?: SpotRecord): Spot {
  const pick = (es: string, en: string) => (lang === "en" ? en || es : es || en);
  const pickNullable = (es: string, en: string) => pick(es, en) || null;

  return {
    id: existing?.id ?? "preview",
    name: pick(values.name_es, values.name_en),
    slug: values.slug,
    description: pickNullable(values.description_es, values.description_en),
    article: pickNullable(values.article_es, values.article_en),
    category: values.category,
    vibes: values.vibes,
    latitude: values.latitude,
    longitude: values.longitude,
    address: values.address || null,
    neighborhood: values.neighborhood || null,
    phone: values.phone || null,
    website: values.website || null,
    email: values.email || null,
    hours_monday: values.hours_monday,
    hours_tuesday: values.hours_tuesday,
    hours_wednesday: values.hours_wednesday,
    hours_thursday: values.hours_thursday,
    hours_friday: values.hours_friday,
    hours_saturday: values.hours_saturday,
    hours_sunday: values.hours_sunday,
    hours_note: pickNullable(values.hours_note_es, values.hours_note_en),
    price_range: values.price_range,
    cuisine_type: pickNullable(values.cuisine_type_es, values.cuisine_type_en),
    dietary_options: values.dietary_options,
    reservation_required: values.reservation_required,
    accepts_cards: values.accepts_cards,
    parking: values.parking,
    photos: values.photos,
    featured_photo: values.featured_photo || null,
    tags: values.tags,
    rating: values.rating,
    parent_id: values.parent_id,
    review_count: existing?.review_count ?? 0,
    is_featured: values.is_featured,
    is_verified: values.is_verified,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: existing?.updated_at ?? new Date().toISOString(),
    last_verified: existing?.last_verified ?? null,
  };
}

const emptyValues = (): SpotFormValues => ({
  name_es: "",
  name_en: "",
  slug: "",
  description_es: "",
  description_en: "",
  article_es: "",
  article_en: "",
  category: "restaurant",
  vibes: [],
  latitude: 8.9528,
  longitude: -79.5347,
  address: "",
  neighborhood: "Casco Viejo",
  phone: "",
  website: "",
  email: "",
  hours_monday: null,
  hours_tuesday: [{ open: "09:00", close: "18:00" }],
  hours_wednesday: [{ open: "09:00", close: "18:00" }],
  hours_thursday: [{ open: "09:00", close: "18:00" }],
  hours_friday: [{ open: "09:00", close: "18:00" }],
  hours_saturday: [{ open: "09:00", close: "18:00" }],
  hours_sunday: null,
  hours_note_es: "",
  hours_note_en: "",
  price_range: "$$",
  cuisine_type_es: "",
  cuisine_type_en: "",
  dietary_options: [],
  reservation_required: false,
  accepts_cards: true,
  parking: "street",
  photos: [],
  featured_photo: "",
  tags: [],
  rating: null,
  is_featured: false,
  is_verified: false,
  parent_id: null,
});

const fromSpot = (spot: SpotRecord): SpotFormValues => ({
  id: spot.id,
  name_es: spot.name_es,
  name_en: spot.name_en,
  slug: spot.slug,
  description_es: spot.description_es ?? "",
  description_en: spot.description_en ?? "",
  article_es: spot.article_es ?? "",
  article_en: spot.article_en ?? "",
  category: spot.category,
  vibes: spot.vibes,
  latitude: spot.latitude,
  longitude: spot.longitude,
  address: spot.address ?? "",
  neighborhood: spot.neighborhood ?? "Casco Viejo",
  phone: spot.phone ?? "",
  website: spot.website ?? "",
  email: spot.email ?? "",
  hours_monday: spot.hours_monday,
  hours_tuesday: spot.hours_tuesday,
  hours_wednesday: spot.hours_wednesday,
  hours_thursday: spot.hours_thursday,
  hours_friday: spot.hours_friday,
  hours_saturday: spot.hours_saturday,
  hours_sunday: spot.hours_sunday,
  hours_note_es: spot.hours_note_es ?? "",
  hours_note_en: spot.hours_note_en ?? "",
  price_range: spot.price_range,
  cuisine_type_es: spot.cuisine_type_es ?? "",
  cuisine_type_en: spot.cuisine_type_en ?? "",
  dietary_options: spot.dietary_options,
  reservation_required: spot.reservation_required,
  accepts_cards: spot.accepts_cards,
  parking: spot.parking,
  photos: spot.photos,
  featured_photo: spot.featured_photo ?? "",
  tags: spot.tags,
  rating: spot.rating,
  is_featured: spot.is_featured,
  is_verified: spot.is_verified,
  parent_id: spot.parent_id,
});

const DIETARY_OPTIONS = ["vegan", "vegetarian", "gluten-free", "halal", "dairy-free"];

export function SpotForm({
  spot,
  allSpots = [],
  initialParentId,
}: {
  spot?: SpotRecord;
  /** Every other spot, localized — used to build the "parent location" and
   * "children" pickers below. Only ids/names/categories/parent_id are read
   * from it, so the caller can reuse whatever `getSpots(locale)` list it
   * already fetched for the admin list page. */
  allSpots?: Spot[];
  /** Seeded from `/admin/spots/new?parent_id=...` (see the "Créer un lieu
   * enfant" shortcut on a hub's own form) — prefills the new spot's parent
   * plus its address/coordinates from that hub, since a child is almost
   * always at the same physical address. Ignored when editing an existing
   * spot (`spot` set). */
  initialParentId?: string;
}) {
  const t = useTranslations("admin.spotForm");
  const tPreview = useTranslations("admin.preview");
  const tSync = useTranslations("admin.translationSync");
  const tCat = useTranslations("category");
  const tVibe = useTranslations("vibe");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const buildInitialValues = (): SpotFormValues => {
    if (spot) return fromSpot(spot);
    const base = emptyValues();
    const parent = initialParentId ? allSpots.find((s) => s.id === initialParentId) : undefined;
    if (!parent) return base;
    return {
      ...base,
      parent_id: parent.id,
      address: parent.address ?? base.address,
      latitude: parent.latitude,
      longitude: parent.longitude,
      neighborhood: parent.neighborhood ?? base.neighborhood,
    };
  };

  const [values, setValues] = useState<SpotFormValues>(buildInitialValues);
  const [slugTouched, setSlugTouched] = useState(Boolean(spot));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const syncGuard = useTranslationSyncGuard(buildInitialValues());
  const unsavedGuard = useUnsavedChangesGuard(buildInitialValues(), values);
  const { registerSave } = useUnsavedChanges();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [pending, startTransition] = useTransition();
  const mobileFrameRef = useRef<HTMLIFrameElement>(null);

  // The hierarchy pickers below — kept separate from `pending`/startTransition
  // above so attaching/detaching a child doesn't disable the main Save button.
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [childPickerOpen, setChildPickerOpen] = useState(false);
  const [childPending, startChildTransition] = useTransition();
  const [children, setChildren] = useState<Spot[]>(() =>
    spot ? allSpots.filter((s) => s.parent_id === spot.id) : [],
  );

  const { childrenByParent } = useMemo(() => groupSpotsByParent(allSpots), [allSpots]);

  // A spot can offer itself as a parent as long as it isn't itself a child
  // (two-level cap — see parent_id's doc comment in lib/types/database.ts).
  // Whether it already has children doesn't disqualify it — that's just an
  // existing hub taking on one more business.
  const eligibleParents: LinkablePlace[] = useMemo(
    () =>
      allSpots
        .filter((s) => !s.parent_id && s.id !== spot?.id)
        .map((s) => ({ id: s.id, type: "spot" as const, label: s.name, slug: s.slug })),
    [allSpots, spot?.id],
  );

  // A spot can be attached as a child only if it's currently standalone —
  // not already someone's child (detach it first to move it), and not
  // already a hub itself (no grandchildren).
  const eligibleChildren: LinkablePlace[] = useMemo(
    () =>
      allSpots
        .filter((s) => !s.parent_id && s.id !== spot?.id && !childrenByParent.has(s.id))
        .map((s) => ({ id: s.id, type: "spot" as const, label: s.name, slug: s.slug })),
    [allSpots, spot?.id, childrenByParent],
  );

  const selectedParent = values.parent_id
    ? allSpots.find((s) => s.id === values.parent_id)
    : undefined;

  const handleAttachChild = (place: LinkablePlace) => {
    setChildPickerOpen(false);
    const child = allSpots.find((s) => s.id === place.id);
    if (!child || !spot) return;
    setChildren((prev) => [...prev, child]);
    startChildTransition(async () => {
      const res = await setSpotParent(child.id, spot.id);
      if (res.error) {
        toast.error(res.error);
        setChildren((prev) => prev.filter((c) => c.id !== child.id));
      } else {
        toast.success(t("hierarchy.childAttached"));
      }
    });
  };

  const handleDetachChild = (childId: string) => {
    const removed = children.find((c) => c.id === childId);
    setChildren((prev) => prev.filter((c) => c.id !== childId));
    startChildTransition(async () => {
      const res = await setSpotParent(childId, null);
      if (res.error) {
        toast.error(res.error);
        if (removed) setChildren((prev) => [...prev, removed]);
      } else {
        toast.success(t("hierarchy.childDetached"));
      }
    });
  };

  const set = <K extends keyof SpotFormValues>(key: K, val: SpotFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  const previewSpot = useMemo(() => toPreviewSpot(values, lang, spot), [values, lang, spot]);

  // Mobile mode renders the real detail page inside an <iframe> so it gets
  // its own (narrow) viewport — see admin/preview/spots/page.tsx for why.
  // Push the draft to it on open and on every edit; reply to its "ready"
  // ping too, in case it mounts after this effect already ran once.
  useEffect(() => {
    if (!previewOpen || previewMode !== "mobile") return;
    mobileFrameRef.current?.contentWindow?.postMessage(
      { type: "spot-preview", spot: previewSpot },
      window.location.origin,
    );
  }, [previewOpen, previewMode, previewSpot]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "spot-preview-ready") {
        mobileFrameRef.current?.contentWindow?.postMessage(
          { type: "spot-preview", spot: previewSpot },
          window.location.origin,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewSpot]);

  const localized = (field: LocalizedField) =>
    values[`${field}_${lang}` as keyof SpotFormValues] as string;

  const setLocalized = (field: LocalizedField, val: string) =>
    setValues((v) => ({ ...v, [`${field}_${lang}`]: val }));

  // Merges what the screenshot importer could read into the draft. Business
  // names are proper nouns, so the same string seeds both languages —
  // everything else non-null overwrites its field; anything the model
  // couldn't read (null, or an omitted hours day) leaves the current value
  // alone rather than blanking it out. Coordinates only come through when
  // the screenshot shows an explicit decimal pair (e.g. right-click "What's
  // here?" on the pin) — the import prompt is told never to infer them from
  // the pin's pixel position, so this can't silently drop the spot at the
  // wrong address.
  const handleExtract = (data: ExtractedSpot) => {
    if (data.name) {
      set("name_es", data.name);
      set("name_en", data.name);
      if (!slugTouched) set("slug", slugify(data.name));
    }
    if (data.category) set("category", data.category);
    if (data.address) set("address", data.address);
    if (data.neighborhood) set("neighborhood", data.neighborhood);
    if (data.phone) set("phone", data.phone);
    if (data.website) set("website", data.website);
    if (data.price_range) set("price_range", data.price_range);
    if (data.rating !== null) set("rating", data.rating);
    if (data.latitude !== null) set("latitude", data.latitude);
    if (data.longitude !== null) set("longitude", data.longitude);
    if (data.cuisine_type) {
      set("cuisine_type_es", data.cuisine_type);
      set("cuisine_type_en", data.cuisine_type);
    }
    if (data.hours) {
      for (const day of DAY_KEYS) {
        const slots = data.hours[day];
        if (slots !== undefined) set(`hours_${day}` as keyof SpotFormValues, slots as never);
      }
    }
  };

  const saveNow = () => {
    startTransition(async () => {
      const res = await upsertSpot(locale, { ...values, id: spot?.id });
      if (res?.error) toast.error(res.error);
      else {
        toast.success(t("saved"));
        syncGuard.markSaved(values);
        unsavedGuard.markSaved(values);
      }
    });
  };

  // Factored out of handleSubmit so the leave-confirmation modal's "Save
  // and leave" option (see UnsavedChangesContext) can trigger the exact
  // same validate → sync-guard → save flow as the Save button itself,
  // without needing a fake FormEvent to hand it.
  const attemptSave = () => {
    if (!values.name_es.trim()) {
      toast.error(t("missingName", { lang: "ES" }));
      setLang("es");
      return;
    }
    if (!values.name_en.trim()) {
      toast.error(t("missingName", { lang: "EN" }));
      setLang("en");
      return;
    }
    if (syncGuard.check(values)) return;
    saveNow();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    attemptSave();
  };

  // Keeps the shared guard pointed at *this* form's save flow for as long
  // as it's mounted — re-registering every render is cheap (a ref write)
  // and keeps attemptSave's closure over `values`/`lang` always current.
  useEffect(() => {
    registerSave(attemptSave);
    return () => registerSave(null);
  });

  const nameIncomplete = { es: !values.name_es.trim(), en: !values.name_en.trim() };

  // The preview (SpotDetailView/SpotCard, both public components with plain
  // <button>s that don't set type="button") and the location picker must
  // render OUTSIDE the <form> below — a bare <button> defaults to
  // type="submit", so any click inside them while still nested in the form
  // would silently save the draft and redirect to the list. Keeping them as
  // siblings of <form>, not descendants, makes that impossible regardless
  // of what those shared components do internally.
  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-aqua/40 bg-aqua/5 p-4">
        <div>
          <p className="text-sm font-semibold">{t("import.title")}</p>
          <p className="text-xs text-foreground/50">{t("import.description")}</p>
        </div>
        <ImportFromScreenshot onExtract={handleExtract} />
      </div>

      <Section title={t("sections.heroPhoto")}>
        <div>
          <Label>{t("featuredPhoto")}</Label>
          <FeaturedPhotoUploader
            value={values.featured_photo}
            onChange={(url) => set("featured_photo", url)}
          />
          <FieldHint>{t("heroPhotoHint")}</FieldHint>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-semibold">{t("translationLabel")}</p>
          <p className="text-xs text-foreground/50">{t("translationHint")}</p>
        </div>
        <LangTabs value={lang} onChange={setLang} incomplete={nameIncomplete} />
      </div>

      <Section title={t("sections.basics")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">
              {t("name")} <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
            </Label>
            <Input
              id="name"
              required
              value={localized("name")}
              onChange={(e) => {
                setLocalized("name", e.target.value);
                if (!slugTouched && lang === "es") set("slug", slugify(e.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="slug">{t("slug")}</Label>
            <Input
              id="slug"
              required
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
            />
            <FieldHint>{t("slugHint")}</FieldHint>
          </div>
        </div>

        <div>
          <Label htmlFor="description">
            {t("description")}{" "}
            <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
          </Label>
          <Textarea
            id="description"
            rows={2}
            value={localized("description")}
            onChange={(e) => setLocalized("description", e.target.value)}
          />
          <FieldHint>{t("descriptionHint")}</FieldHint>
        </div>

        <div>
          <Label>
            {t("article")} <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
          </Label>
          <ArticleEditor
            key={lang}
            value={localized("article")}
            onChange={(v) => setLocalized("article", v)}
          />
          <FieldHint>{t("articleHint")}</FieldHint>
        </div>

        <div>
          <Label htmlFor="category">{t("category")}</Label>
          <Select
            id="category"
            value={values.category}
            onChange={(e) => set("category", e.target.value as SpotFormValues["category"])}
          >
            {SPOT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCat(c)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>{t("vibes")}</Label>
          <div className="flex flex-wrap gap-2">
            {SPOT_VIBES.map((v) => {
              const meta = VIBE_META[v];
              const Icon = meta.icon;
              const isActive = values.vibes.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    set(
                      "vibes",
                      isActive ? values.vibes.filter((x) => x !== v) : [...values.vibes, v],
                    )
                  }
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: isActive ? meta.color : `${meta.color}1A`,
                    color: isActive ? "white" : meta.color,
                  }}
                >
                  <Icon size={13} strokeWidth={2.5} /> {tVibe(v)}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title={t("sections.location")}>
        <div>
          <Label htmlFor="address">{t("address")}</Label>
          <div className="flex gap-2">
            <Input
              id="address"
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
              <MapPin size={15} />
              {t("geocode")}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lat">{t("latitude")}</Label>
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
            <Label htmlFor="lng">{t("longitude")}</Label>
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="website">{t("website")}</Label>
            <Input
              id="website"
              value={values.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
        </div>
      </Section>

      {/* Hidden once this spot already has children of its own — a hub
          can't also be someone else's child (two-level cap). */}
      {children.length === 0 && (
        <Section title={t("sections.parent")}>
          <p className="text-xs text-foreground/50">{t("hierarchy.parentHint")}</p>
          {selectedParent ? (
            <div className="flex w-fit items-center gap-2 rounded-full bg-aqua/10 px-3 py-1.5 text-sm font-semibold text-aqua-dark">
              <Building2 size={14} />
              {selectedParent.name}
              <button
                type="button"
                onClick={() => set("parent_id", null)}
                className="text-aqua-dark/60 hover:text-aqua-dark"
                aria-label={t("hierarchy.removeParent")}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setParentPickerOpen(true)}>
              <Building2 size={15} /> {t("hierarchy.chooseParent")}
            </Button>
          )}
        </Section>
      )}

      {/* Only for an existing, standalone (non-child) spot — a brand new
          spot has no id yet to attach children to, and a child can't have
          children of its own. */}
      {spot && !values.parent_id && (
        <Section title={t("sections.children")}>
          <p className="text-xs text-foreground/50">{t("hierarchy.childrenHint")}</p>
          {children.length > 0 && (
            <ul className="space-y-1.5">
              {children.map((child) => (
                <li
                  key={child.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-button)] border border-border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <CategoryBadge category={child.category} />
                    {child.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDetachChild(child.id)}
                    disabled={childPending}
                    className="text-coral hover:text-coral-dark disabled:opacity-40"
                    aria-label={t("hierarchy.removeChild")}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setChildPickerOpen(true)}>
              <Plus size={15} /> {t("hierarchy.attachExisting")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push({ pathname: "/admin/spots/new", query: { parent_id: spot.id } })
              }
            >
              <Plus size={15} /> {t("hierarchy.createChild")}
            </Button>
          </div>
        </Section>
      )}

      <Section title={t("sections.hours")}>
        <HoursEditor
          value={{
            monday: values.hours_monday,
            tuesday: values.hours_tuesday,
            wednesday: values.hours_wednesday,
            thursday: values.hours_thursday,
            friday: values.hours_friday,
            saturday: values.hours_saturday,
            sunday: values.hours_sunday,
          }}
          onChange={(week) => {
            set("hours_monday", week.monday);
            set("hours_tuesday", week.tuesday);
            set("hours_wednesday", week.wednesday);
            set("hours_thursday", week.thursday);
            set("hours_friday", week.friday);
            set("hours_saturday", week.saturday);
            set("hours_sunday", week.sunday);
          }}
        />
        <div>
          <Label htmlFor="hoursNote">
            {t("hoursNote")}{" "}
            <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
          </Label>
          <Input
            id="hoursNote"
            value={localized("hours_note")}
            onChange={(e) => setLocalized("hours_note", e.target.value)}
            placeholder={t("hoursNoteHint")}
          />
        </div>
      </Section>

      <Section title={t("sections.details")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="price">{t("priceRange")}</Label>
            <Select
              id="price"
              value={values.price_range ?? ""}
              onChange={(e) => set("price_range", e.target.value as SpotFormValues["price_range"])}
            >
              {["$", "$$", "$$$", "$$$$"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cuisine">
              {t("cuisineType")}{" "}
              <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
            </Label>
            <Input
              id="cuisine"
              value={localized("cuisine_type")}
              onChange={(e) => setLocalized("cuisine_type", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>{t("dietaryOptions")}</Label>
          <div className="flex flex-wrap gap-3">
            {DIETARY_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={values.dietary_options.includes(opt)}
                  onChange={(e) =>
                    set(
                      "dietary_options",
                      e.target.checked
                        ? [...values.dietary_options, opt]
                        : values.dietary_options.filter((o) => o !== opt),
                    )
                  }
                  className="h-4 w-4 accent-lime"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.reservation_required}
              onChange={(e) => set("reservation_required", e.target.checked)}
              className="h-4 w-4 accent-aqua"
            />
            {t("reservationRequired")}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.accepts_cards}
              onChange={(e) => set("accepts_cards", e.target.checked)}
              className="h-4 w-4 accent-aqua"
            />
            {t("acceptsCards")}
          </label>
          <div>
            <Select
              value={values.parking ?? ""}
              onChange={(e) => set("parking", e.target.value as SpotFormValues["parking"])}
            >
              <option value="street">street</option>
              <option value="paid-lot">paid-lot</option>
              <option value="none">none</option>
            </Select>
          </div>
        </div>
      </Section>

      <Section title={t("sections.media")}>
        <div>
          <Label>{t("gallery")}</Label>
          <GalleryUploader value={values.photos} onChange={(p) => set("photos", p)} />
        </div>
      </Section>

      <Section title={t("sections.meta")}>
        <div>
          <Label>{t("tags")}</Label>
          <TagInput value={values.tags} onChange={(tags) => set("tags", tags)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="rating">{t("rating")}</Label>
            <Input
              id="rating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={values.rating ?? ""}
              onChange={(e) => set("rating", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.is_featured}
              onChange={(e) => set("is_featured", e.target.checked)}
              className="h-4 w-4 accent-magenta"
            />
            {t("isFeatured")}
          </label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={values.is_verified}
              onChange={(e) => set("is_verified", e.target.checked)}
              className="h-4 w-4 accent-lime"
            />
            {t("isVerified")}
          </label>
        </div>
      </Section>

      <div className="fixed bottom-0 left-60 right-0 flex justify-end gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye size={15} /> {t("preview")}
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t("saving") : t("save")}
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
                <SpotDetailView spot={previewSpot} onBack={() => setPreviewOpen(false)} />
              )}

              {previewMode === "card" && (
                <div className="flex min-h-full items-center justify-center bg-black/[0.03] p-8 dark:bg-white/[0.03]">
                  <div className="w-full max-w-xs">
                    <SpotCard spot={previewSpot} onClick={() => {}} />
                  </div>
                </div>
              )}

              {previewMode === "mobile" && (
                <div className="flex min-h-full items-center justify-center bg-black/[0.03] p-8 dark:bg-white/[0.03]">
                  <div className="h-[812px] w-[375px] max-w-full overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-background shadow-2xl">
                    <iframe
                      ref={mobileFrameRef}
                      src={`/${locale}/admin/preview/spots`}
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
              title: t("geocode"),
              hint: t("locateHint"),
              latitude: t("latitude"),
              longitude: t("longitude"),
              cancel: t("cancel"),
              confirm: t("useLocation"),
              close: t("close"),
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

      <AnimatePresence>
        {parentPickerOpen && (
          <PlaceLinkPicker
            places={eligibleParents}
            labels={{
              title: t("hierarchy.parentPicker.title"),
              searchPlaceholder: t("hierarchy.parentPicker.search"),
              empty: t("hierarchy.parentPicker.empty"),
              close: t("close"),
              typeFilter: { all: "", spot: "", event: "", article: "" },
            }}
            onSelect={(place) => {
              set("parent_id", place.id);
              setParentPickerOpen(false);
            }}
            onClose={() => setParentPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {childPickerOpen && (
          <PlaceLinkPicker
            places={eligibleChildren}
            labels={{
              title: t("hierarchy.childPicker.title"),
              searchPlaceholder: t("hierarchy.childPicker.search"),
              empty: t("hierarchy.childPicker.empty"),
              close: t("close"),
              typeFilter: { all: "", spot: "", event: "", article: "" },
            }}
            onSelect={handleAttachChild}
            onClose={() => setChildPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {syncGuard.unmodifiedLang && (
          <TranslationSyncModal
            labels={{
              title: tSync("title", { modified: (syncGuard.unmodifiedLang === "en" ? "es" : "en").toUpperCase() }),
              message: tSync("message", { target: syncGuard.unmodifiedLang.toUpperCase() }),
              switchTo: tSync("switchTo", { target: syncGuard.unmodifiedLang.toUpperCase() }),
              saveAnyway: tSync("saveAnyway", { target: syncGuard.unmodifiedLang.toUpperCase() }),
              close: tSync("close"),
            }}
            onSwitch={() => {
              setLang(syncGuard.unmodifiedLang!);
              syncGuard.dismiss();
            }}
            onSaveAnyway={() => {
              syncGuard.dismiss();
              saveNow();
            }}
            onClose={syncGuard.dismiss}
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
