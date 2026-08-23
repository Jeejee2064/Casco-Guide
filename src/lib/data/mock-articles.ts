import type { ArticleRecord } from "@/lib/types/database";

/**
 * ⚠️ PLACEHOLDER DEV DATA — not a real write-up.
 *
 * Used only as a local fallback so the UI renders before Supabase env vars
 * are configured. Links a couple of the placeholder spots/events from
 * mock-spots.ts / mock-events.ts so the "places mentioned" map has
 * something to show.
 */
export const MOCK_ARTICLES: ArticleRecord[] = [
  {
    id: "mock-article-1",
    title_es: "Top 5 lugares para probar en Casco Viejo",
    title_en: "Top 5 spots to try in Casco Viejo",
    slug: "top-5-casco-viejo",
    excerpt_es: "Placeholder — una selección de lugares destacados del barrio.",
    excerpt_en: "Placeholder — a curated pick of standout spots in the neighborhood.",
    body_es:
      '<p>Este es un artículo de ejemplo. Empieza por <a href="/spots/sample-rooftop-bar" data-ref-type="spot" data-ref-id="mock-1">Sample Rooftop Bar</a> al atardecer, y de camino no te pierdas <a href="/spots/sample-cafe" data-ref-type="spot" data-ref-id="mock-2">Sample Café</a>.</p>',
    body_en:
      '<p>This is a placeholder article. Start at <a href="/spots/sample-rooftop-bar" data-ref-type="spot" data-ref-id="mock-1">Sample Rooftop Bar</a> at sunset, and on the way don\'t miss <a href="/spots/sample-cafe" data-ref-type="spot" data-ref-id="mock-2">Sample Café</a>.</p>',
    duration_es: null,
    duration_en: null,
    layout: "standard",
    blocks: [],
    cover_photo: null,
    tags: ["top-list", "placeholder"],
    spot_refs: ["mock-1", "mock-2"],
    event_refs: [],
    author: "Panama City Guide",
    is_published: true,
    is_featured: true,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-article-2",
    title_es: "Guía de un fin de semana en el casco antiguo",
    title_en: "A weekend guide to the old quarter",
    slug: "weekend-guide-casco-viejo",
    excerpt_es: "Placeholder — un itinerario de fin de semana.",
    excerpt_en: "Placeholder — a weekend itinerary draft.",
    body_es: "<p>Borrador — todavía no publicado.</p>",
    body_en: "<p>Draft — not published yet.</p>",
    duration_es: null,
    duration_en: null,
    layout: "standard",
    blocks: [],
    cover_photo: null,
    tags: ["guide", "placeholder"],
    spot_refs: [],
    event_refs: [],
    author: "Panama City Guide",
    is_published: false,
    is_featured: false,
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
