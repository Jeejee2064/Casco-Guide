-- ═══════════════════════════════════════════════════════════════
-- Articles — 4th layout: "itinerary"
--
-- A chronological day plan (e.g. "48h in Casco Viejo", "A perfect
-- morning in Casco Viejo") — same `blocks` shape as "list"/
-- "photo-story" (see 0005_articles.sql), but each block's
-- title_es/title_en doubles as its time-of-day label (e.g.
-- "9:00 AM" or "Mañana") instead of a rank/caption title.
-- ═══════════════════════════════════════════════════════════════

alter type article_layout add value if not exists 'itinerary';
