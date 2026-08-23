-- ═══════════════════════════════════════════════════════════════
-- Articles — trip duration
--
-- Quick at-a-glance total time, rendered near the title on the
-- public article page (see ArticleDetailView) when set. Free text,
-- bilingual like every other article field, optional and
-- independent of `layout`.
-- ═══════════════════════════════════════════════════════════════

alter table articles
  add column if not exists duration_es text,
  add column if not exists duration_en text;
