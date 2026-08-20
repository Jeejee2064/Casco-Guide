// Resolves the bilingual (ES/EN) columns stored in Supabase down to
// the single-language shape (`Spot`, `EventRow`) the public site and
// the admin tables render. Picks the visitor's locale and falls back
// to the other language if that field was never translated.

import type { Locale } from "@/i18n/routing";
import type { Article, ArticleRecord, EventRecord, EventRow, Spot, SpotRecord } from "@/lib/types/database";

function pick(es: string, en: string, locale: Locale): string {
  return locale === "en" ? en || es : es || en;
}

function pickNullable(es: string | null, en: string | null, locale: Locale): string | null {
  const primary = locale === "en" ? en : es;
  const fallback = locale === "en" ? es : en;
  return primary || fallback;
}

export function localizeSpot(record: SpotRecord, locale: Locale): Spot {
  const {
    name_es,
    name_en,
    description_es,
    description_en,
    article_es,
    article_en,
    cuisine_type_es,
    cuisine_type_en,
    hours_note_es,
    hours_note_en,
    ...rest
  } = record;

  return {
    ...rest,
    name: pick(name_es, name_en, locale),
    description: pickNullable(description_es, description_en, locale),
    article: pickNullable(article_es, article_en, locale),
    cuisine_type: pickNullable(cuisine_type_es, cuisine_type_en, locale),
    hours_note: pickNullable(hours_note_es, hours_note_en, locale),
  };
}

export function localizeEvent(record: EventRecord, locale: Locale): EventRow {
  const { title_es, title_en, description_es, description_en, article_es, article_en, ...rest } = record;

  return {
    ...rest,
    title: pick(title_es, title_en, locale),
    description: pickNullable(description_es, description_en, locale),
    article: pickNullable(article_es, article_en, locale),
  };
}

export function localizeArticle(record: ArticleRecord, locale: Locale): Article {
  const { title_es, title_en, excerpt_es, excerpt_en, body_es, body_en, blocks, ...rest } = record;

  return {
    ...rest,
    title: pick(title_es, title_en, locale),
    excerpt: pickNullable(excerpt_es, excerpt_en, locale),
    body: pickNullable(body_es, body_en, locale),
    blocks: blocks.map(({ title_es, title_en, text_es, text_en, ...block }) => ({
      ...block,
      title: pickNullable(title_es, title_en, locale),
      text: pickNullable(text_es, text_en, locale),
    })),
  };
}
