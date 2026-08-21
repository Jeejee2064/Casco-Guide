"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { Eye, X, FileText, ListOrdered, Images } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/Field";
import { TagInput } from "./TagInput";
import { FeaturedPhotoUploader } from "./PhotoUploader";
import { ArticleBodyEditor } from "./ArticleBodyEditor";
import { ArticleBlocksEditor } from "./ArticleBlocksEditor";
import { LangTabs } from "./LangTabs";
import { TranslationSyncModal } from "./TranslationSyncModal";
import { useTranslationSyncGuard } from "./useTranslationSyncGuard";
import { PreviewModeTabs, type PreviewMode } from "./PreviewModeTabs";
import type { LinkablePlace } from "./PlaceLinkPicker";
import { ArticleDetailView } from "@/components/site/ArticleDetailView";
import { ArticleCard } from "@/components/site/ArticleCard";
import { slugify } from "@/lib/utils";
import { upsertArticle, type ArticleFormValues } from "@/lib/actions/articles";
import type { Locale } from "@/i18n/routing";
import type { Article, ArticleLayout, ArticleRecord, EventRow, Spot } from "@/lib/types/database";

type Lang = "es" | "en";
type LocalizedField = "title" | "excerpt" | "body";

/** Builds a single-language `Article` from the in-progress (unsaved)
 * bilingual form values, for the live preview — same fallback rules as
 * `localizeArticle` in lib/i18n/content.ts, just read from form state. */
function toPreviewArticle(values: ArticleFormValues, lang: Lang, existing?: ArticleRecord): Article {
  const pick = (es: string, en: string) => (lang === "en" ? en || es : es || en);
  const pickNullable = (es: string, en: string) => pick(es, en) || null;

  return {
    id: existing?.id ?? "preview",
    title: pick(values.title_es, values.title_en),
    slug: values.slug,
    excerpt: pickNullable(values.excerpt_es, values.excerpt_en),
    body: pickNullable(values.body_es, values.body_en),
    layout: values.layout,
    blocks: values.blocks.map((b) => ({
      id: b.id,
      photo: b.photo,
      title: pickNullable(b.title_es ?? "", b.title_en ?? ""),
      text: pickNullable(b.text_es ?? "", b.text_en ?? ""),
      ref_type: b.ref_type,
      ref_id: b.ref_id,
      ref_slug: b.ref_slug,
    })),
    cover_photo: values.cover_photo || null,
    tags: values.tags,
    spot_refs: [],
    event_refs: [],
    author: values.author || null,
    is_published: values.is_published,
    is_featured: values.is_featured,
    published_at: existing?.published_at ?? (values.is_published ? new Date().toISOString() : null),
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: existing?.updated_at ?? new Date().toISOString(),
  };
}

const emptyValues = (): ArticleFormValues => ({
  title_es: "",
  title_en: "",
  slug: "",
  excerpt_es: "",
  excerpt_en: "",
  body_es: "",
  body_en: "",
  layout: "standard",
  blocks: [],
  cover_photo: "",
  tags: [],
  author: "",
  is_published: false,
  is_featured: false,
});

const fromArticle = (article: ArticleRecord): ArticleFormValues => ({
  id: article.id,
  title_es: article.title_es,
  title_en: article.title_en,
  slug: article.slug,
  excerpt_es: article.excerpt_es ?? "",
  excerpt_en: article.excerpt_en ?? "",
  body_es: article.body_es ?? "",
  body_en: article.body_en ?? "",
  layout: article.layout,
  blocks: article.blocks,
  cover_photo: article.cover_photo ?? "",
  tags: article.tags,
  author: article.author ?? "",
  is_published: article.is_published,
  is_featured: article.is_featured,
});

const LAYOUTS: { value: ArticleLayout; icon: typeof FileText }[] = [
  { value: "standard", icon: FileText },
  { value: "list", icon: ListOrdered },
  { value: "photo-story", icon: Images },
];

export function ArticleForm({
  article,
  spots,
  events,
  articles = [],
}: {
  article?: ArticleRecord;
  spots: Spot[];
  events: EventRow[];
  /** Other published articles, linkable from the body editor — see `articleLinkPlaces` below. */
  articles?: Article[];
}) {
  const t = useTranslations("admin.articleForm");
  const tPreview = useTranslations("admin.preview");
  const tSync = useTranslations("admin.translationSync");
  const locale = useLocale() as Locale;
  const [values, setValues] = useState<ArticleFormValues>(article ? fromArticle(article) : emptyValues());
  const [slugTouched, setSlugTouched] = useState(Boolean(article));
  const [lang, setLang] = useState<Lang>("es");
  const syncGuard = useTranslationSyncGuard(article ? fromArticle(article) : emptyValues());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [pending, startTransition] = useTransition();
  const mobileFrameRef = useRef<HTMLIFrameElement>(null);

  const set = <K extends keyof ArticleFormValues>(key: K, val: ArticleFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: val }));

  const places: LinkablePlace[] = useMemo(
    () => [
      ...spots.map((s) => ({ id: s.id, type: "spot" as const, label: s.name, slug: s.slug })),
      ...events.map((e) => ({ id: e.id, type: "event" as const, label: e.title, slug: e.slug })),
    ],
    [spots, events],
  );

  // Body editor can additionally link to other (published) articles — a
  // spot/event can't link to an article, so ArticleBlocksEditor keeps using
  // the plain `places` above. Excludes the article being edited itself.
  const articleLinkPlaces: LinkablePlace[] = useMemo(
    () => [
      ...places,
      ...articles.filter((a) => a.id !== article?.id).map((a) => ({ id: a.id, type: "article" as const, label: a.title, slug: a.slug })),
    ],
    [places, articles, article?.id],
  );

  const previewArticle = useMemo(() => toPreviewArticle(values, lang, article), [values, lang, article]);
  const citedSpots = useMemo(
    () => spots.filter((s) => previewArticle.blocks.some((b) => b.ref_id === s.id) || (values.body_es + values.body_en).includes(`data-ref-id="${s.id}"`)),
    [spots, previewArticle.blocks, values.body_es, values.body_en],
  );
  const citedEvents = useMemo(
    () => events.filter((e) => previewArticle.blocks.some((b) => b.ref_id === e.id) || (values.body_es + values.body_en).includes(`data-ref-id="${e.id}"`)),
    [events, previewArticle.blocks, values.body_es, values.body_en],
  );

  useEffect(() => {
    if (!previewOpen || previewMode !== "mobile") return;
    mobileFrameRef.current?.contentWindow?.postMessage(
      { type: "article-preview", article: previewArticle, citedSpots, citedEvents },
      window.location.origin,
    );
  }, [previewOpen, previewMode, previewArticle, citedSpots, citedEvents]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "article-preview-ready") {
        mobileFrameRef.current?.contentWindow?.postMessage(
          { type: "article-preview", article: previewArticle, citedSpots, citedEvents },
          window.location.origin,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewArticle, citedSpots, citedEvents]);

  const localized = (field: LocalizedField) => values[`${field}_${lang}` as keyof ArticleFormValues] as string;
  const setLocalized = (field: LocalizedField, val: string) => setValues((v) => ({ ...v, [`${field}_${lang}`]: val }));

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
    if (syncGuard.check(values)) return;
    saveNow();
  };

  const saveNow = () => {
    startTransition(async () => {
      const res = await upsertArticle(locale, { ...values, id: article?.id });
      if (res?.error) toast.error(res.error);
      else {
        toast.success(t("saved"));
        syncGuard.markSaved(values);
      }
    });
  };

  const titleIncomplete = { es: !values.title_es.trim(), en: !values.title_en.trim() };

  // Preview + mobile iframe must render OUTSIDE the <form> — see the same
  // note in SpotForm.tsx: their bare <button>s default to type="submit".
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

        <Section title={t("sections.layout")}>
          <div className="grid gap-3 sm:grid-cols-3">
            {LAYOUTS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => set("layout", value)}
                className={`flex flex-col items-start gap-2 rounded-[var(--radius-button)] border-2 p-4 text-left transition-colors ${
                  values.layout === value ? "border-aqua bg-aqua/5" : "border-border hover:border-aqua/40"
                }`}
              >
                <Icon size={20} className={values.layout === value ? "text-aqua" : "text-foreground/50"} />
                <span className="text-sm font-bold">{t(`layouts.${value}.name`)}</span>
                <span className="text-xs text-foreground/50">{t(`layouts.${value}.hint`)}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("sections.basics")}>
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
            <Label htmlFor="excerpt">
              {t("excerpt")} <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
            </Label>
            <Textarea id="excerpt" rows={2} value={localized("excerpt")} onChange={(e) => setLocalized("excerpt", e.target.value)} />
            <FieldHint>{t("excerptHint")}</FieldHint>
          </div>

          <div>
            <Label htmlFor="author">{t("author")}</Label>
            <Input id="author" value={values.author} onChange={(e) => set("author", e.target.value)} />
          </div>
        </Section>

        <Section title={t("sections.body")}>
          <div>
            <Label>
              {values.layout === "standard" ? t("body") : t("intro")}{" "}
              <span className="font-normal text-foreground/40">· {lang.toUpperCase()}</span>
            </Label>
            <ArticleBodyEditor
              key={lang}
              value={localized("body")}
              onChange={(v) => setLocalized("body", v)}
              locale={lang}
              places={articleLinkPlaces}
              linkLabels={{
                title: t("linkPlace"),
                searchPlaceholder: t("searchPlaceholder"),
                empty: t("noResults"),
                close: t("close"),
                typeFilter: {
                  all: t("linkTypes.all"),
                  spot: t("linkTypes.spot"),
                  event: t("linkTypes.event"),
                  article: t("linkTypes.article"),
                },
              }}
            />
            <FieldHint>{values.layout === "standard" ? t("bodyHint") : t("introHint")}</FieldHint>
          </div>

          {values.layout !== "standard" && (
            <div>
              <Label>{t(`layouts.${values.layout}.name`)}</Label>
              <ArticleBlocksEditor layout={values.layout} value={values.blocks} onChange={(b) => set("blocks", b)} places={places} lang={lang} />
            </div>
          )}
        </Section>

        <Section title={t("sections.media")}>
          <div>
            <Label>{t("coverPhoto")}</Label>
            <FeaturedPhotoUploader value={values.cover_photo} onChange={(url) => set("cover_photo", url)} />
          </div>
        </Section>

        <Section title={t("sections.meta")}>
          <div>
            <Label>{t("tags")}</Label>
            <TagInput value={values.tags} onChange={(tags) => set("tags", tags)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={values.is_published}
                onChange={(e) => set("is_published", e.target.checked)}
                className="h-4 w-4 accent-lime"
              />
              {t("isPublished")}
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={values.is_featured}
                onChange={(e) => set("is_featured", e.target.checked)}
                className="h-4 w-4 accent-magenta"
              />
              {t("isFeatured")}
            </label>
          </div>
          <FieldHint>{t("publishedHint")}</FieldHint>
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
                <Button type="button" variant="ghost" size="icon" onClick={() => setPreviewOpen(false)} aria-label={tPreview("close")}>
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
                <ArticleDetailView article={previewArticle} citedSpots={citedSpots} citedEvents={citedEvents} onBack={() => setPreviewOpen(false)} />
              )}

              {previewMode === "card" && (
                <div className="flex min-h-full items-center justify-center bg-black/[0.03] p-8 dark:bg-white/[0.03]">
                  <div className="w-full max-w-xs">
                    <ArticleCard article={previewArticle} onClick={() => {}} />
                  </div>
                </div>
              )}

              {previewMode === "mobile" && (
                <div className="flex min-h-full items-center justify-center bg-black/[0.03] p-8 dark:bg-white/[0.03]">
                  <div className="h-[812px] w-[375px] max-w-full overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-background shadow-2xl">
                    <iframe ref={mobileFrameRef} src={`/${locale}/admin/preview/articles`} title="Mobile preview" className="h-full w-full" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
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
