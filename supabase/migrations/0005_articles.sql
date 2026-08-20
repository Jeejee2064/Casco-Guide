-- ═══════════════════════════════════════════════════════════════
-- Articles — 3rd content type
--
-- Editorial content ("Top 5 vegan spots in Casco Viejo"...) that
-- can embed links to existing spots/events inside its rich-text
-- body. `spot_refs`/`event_refs` are derived server-side from
-- those embedded links (see src/lib/actions/articles.ts) and
-- power the "places mentioned" map on the public article page —
-- they are not edited directly by the admin.
--
-- Same bilingual column-pair convention as spots/events (see
-- 0003_i18n_content.sql), tags as a plain array (no join table,
-- no fixed category — free tags only), draft/published state via
-- `is_published` (spots/events have no such state).
-- ═══════════════════════════════════════════════════════════════

-- Three proven presentation formats — deliberately not an open-ended
-- template system. "standard" is a freeform write-up; "list" and
-- "photo-story" additionally render `blocks` (see below) as, respectively,
-- a numbered ranking (e.g. "Top 5 vegan spots") or a full-bleed photo
-- sequence with captions.
do $$ begin
  create type article_layout as enum ('standard', 'list', 'photo-story');
exception when duplicate_object then null; end $$;

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title_es text not null,
  title_en text not null,
  slug text not null unique,
  excerpt_es text,
  excerpt_en text,
  -- HTML produced by the admin's rich-text editor, same as
  -- spots.article_es/en and events.article_es/en. Optional intro copy above
  -- `blocks` for the "list"/"photo-story" layouts; the whole article body
  -- for "standard".
  body_es text,
  body_en text,

  layout article_layout not null default 'standard',
  -- Structured items for the "list"/"photo-story" layouts: array of
  -- { id, photo, title_es, title_en, text_es, text_en, ref_type, ref_id,
  -- ref_slug }. Ignored for "standard". See src/lib/types/database.ts
  -- (ArticleBlockRecord) for the exact shape.
  blocks jsonb not null default '[]',

  cover_photo text,

  tags text[] not null default '{}',
  -- Distinct spot/event ids referenced by links inside body_es/body_en,
  -- recomputed on every save.
  spot_refs uuid[] not null default '{}',
  event_refs uuid[] not null default '{}',

  author text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_is_published on articles (is_published);
create index if not exists idx_articles_tags on articles using gin (tags);
create index if not exists idx_articles_spot_refs on articles using gin (spot_refs);
create index if not exists idx_articles_event_refs on articles using gin (event_refs);
create index if not exists idx_articles_search on articles using gin ((
  to_tsvector('spanish', coalesce(title_es, '') || ' ' || coalesce(excerpt_es, '') || ' ' || coalesce(body_es, ''))
  ||
  to_tsvector('english', coalesce(title_en, '') || ' ' || coalesce(excerpt_en, '') || ' ' || coalesce(body_en, ''))
));

drop trigger if exists trg_articles_updated_at on articles;
create trigger trg_articles_updated_at
  before update on articles
  for each row execute function set_updated_at();

-- ─── Table grants ─────────────────────────────────────────────

grant select on articles to anon, authenticated;
grant insert, update, delete on articles to authenticated;
grant select, insert, update, delete on articles to service_role;

-- ─── Row Level Security ───────────────────────────────────────
-- Public (anon) only ever sees published articles. Authenticated
-- (the admin) sees everything, including drafts, so they show up
-- in the admin list/edit screens.

alter table articles enable row level security;

drop policy if exists "Public read published articles" on articles;
create policy "Public read published articles" on articles
  for select to anon
  using (is_published = true);

drop policy if exists "Authenticated read all articles" on articles;
create policy "Authenticated read all articles" on articles
  for select to authenticated
  using (true);

drop policy if exists "Authenticated write articles" on articles;
create policy "Authenticated write articles" on articles
  for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Article cover/inline photos reuse the existing `spot-photos`
-- bucket and its policies (already public-read / authenticated-write).
