-- ═══════════════════════════════════════════════════════════════
-- Bilingual content (ES / EN) for spots and events
--
-- The admin dashboard now collects free-text content in both
-- Spanish and English. Every translatable column is split into
-- a `_es` and `_en` pair; the public site picks whichever matches
-- the visitor's locale and falls back to the other language if
-- that one is blank (see src/lib/i18n/content.ts).
--
-- `name`/`title` stay required in both languages (they were the
-- only `required` fields in the admin forms already). The rest
-- (description, article, cuisine_type, hours_note) stay optional
-- in each language, same as before this migration.
-- ═══════════════════════════════════════════════════════════════

-- ─── Spots ────────────────────────────────────────────────────

alter table spots
  add column if not exists name_es text,
  add column if not exists name_en text,
  add column if not exists description_es text,
  add column if not exists description_en text,
  add column if not exists article_es text,
  add column if not exists article_en text,
  add column if not exists cuisine_type_es text,
  add column if not exists cuisine_type_en text,
  add column if not exists hours_note_es text,
  add column if not exists hours_note_en text;

-- Backfill: the existing single-language content becomes the
-- starting point for both languages. Admins can then go in and
-- correct/translate the `_en` (or `_es`) copy per record.
update spots set
  name_es = coalesce(name_es, name),
  name_en = coalesce(name_en, name),
  description_es = coalesce(description_es, description),
  description_en = coalesce(description_en, description),
  article_es = coalesce(article_es, article),
  article_en = coalesce(article_en, article),
  cuisine_type_es = coalesce(cuisine_type_es, cuisine_type),
  cuisine_type_en = coalesce(cuisine_type_en, cuisine_type),
  hours_note_es = coalesce(hours_note_es, hours_note),
  hours_note_en = coalesce(hours_note_en, hours_note)
where name_es is null or name_en is null;

alter table spots alter column name_es set not null;
alter table spots alter column name_en set not null;

drop index if exists idx_spots_search;

alter table spots
  drop column if exists name,
  drop column if exists description,
  drop column if exists article,
  drop column if exists cuisine_type,
  drop column if exists hours_note;

create index if not exists idx_spots_search on spots using gin ((
  to_tsvector('spanish', coalesce(name_es, '') || ' ' || coalesce(description_es, '') || ' ' || coalesce(article_es, '') || ' ' || coalesce(cuisine_type_es, ''))
  ||
  to_tsvector('english', coalesce(name_en, '') || ' ' || coalesce(description_en, '') || ' ' || coalesce(article_en, '') || ' ' || coalesce(cuisine_type_en, ''))
));

-- ─── Events ───────────────────────────────────────────────────

alter table events
  add column if not exists title_es text,
  add column if not exists title_en text,
  add column if not exists description_es text,
  add column if not exists description_en text,
  add column if not exists article_es text,
  add column if not exists article_en text;

update events set
  title_es = coalesce(title_es, title),
  title_en = coalesce(title_en, title),
  description_es = coalesce(description_es, description),
  description_en = coalesce(description_en, description),
  article_es = coalesce(article_es, article),
  article_en = coalesce(article_en, article)
where title_es is null or title_en is null;

alter table events alter column title_es set not null;
alter table events alter column title_en set not null;

alter table events
  drop column if exists title,
  drop column if exists description,
  drop column if exists article;
