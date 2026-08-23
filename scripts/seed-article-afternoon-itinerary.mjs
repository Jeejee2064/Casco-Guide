// One-off seed script: adds a 5th real article, "A Perfect Afternoon in
// Casco Viejo, Step by Step" — the first to exercise the new "itinerary"
// layout (see 0007_article_itinerary_layout.sql and
// src/lib/types/database.ts). Cites 6 real spots already seeded by
// scripts/seed-casco-viejo.mjs, one per hour block, and cross-links back to
// the existing café-hopping morning article. Run with:
//
//   node scripts/seed-article-afternoon-itinerary.mjs
//
// Requires:
//   1. supabase/migrations/0007_article_itinerary_layout.sql applied
//      against the DB first (adds 'itinerary' to the article_layout enum —
//      run it via `supabase db push` or paste it into the Supabase SQL
//      editor; this script can't run DDL itself over the REST API).
//   2. NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env.local).
//
// Upserts on `slug`, so it's safe to re-run.
//
// Spot ids/slugs/photos below were read live from the `spots` table
// (scripts/seed-casco-viejo.mjs's data) — if that seed is re-run with
// different ids this script's spot_refs/ref_id fields would need updating.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const path = join(__dirname, "..", ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Real spot ids/slugs, read live from the `spots` table.
const SPOT = {
  fondaLoQueHay: { id: "1a4fc4c5-7c35-495a-b910-54882501345c", slug: "fonda-lo-que-hay", photo: "https://images.unsplash.com/photo-1584208632869-05fa2b2a5934?q=80&w=1200&auto=format&fit=crop" },
  museoMola: { id: "c1098d5e-8f03-4ff1-87f0-f4034efabc16", slug: "museo-de-la-mola", photo: "https://images.unsplash.com/photo-1649452843752-663493034117?q=80&w=1200&auto=format&fit=crop" },
  karavan: { id: "a4b1ac1f-3b64-40fb-9d8d-24fb8b3d8bc0", slug: "karavan", photo: "https://images.unsplash.com/photo-1572307480813-ceb0e59d8325?q=80&w=1200&auto=format&fit=crop" },
  plazaFrancia: { id: "77974fd1-8e32-46a4-a795-03c53bf2f2ef", slug: "plaza-de-francia", photo: "https://images.unsplash.com/photo-1778224978538-28bcf26422bf?q=80&w=1200&auto=format&fit=crop" },
  granclement: { id: "28a054da-7c62-4643-ab07-7d59e45326fb", slug: "granclement", photo: "https://images.unsplash.com/photo-1657220644506-77fa47a3487b?q=80&w=1200&auto=format&fit=crop" },
  tantalo: { id: "d09e843a-2dac-477d-9bd4-f182106e3577", slug: "tantalo-rooftop-bar", photo: "https://images.unsplash.com/photo-1692261920240-a3c88f29e25f?q=80&w=1200&auto=format&fit=crop" },
};

// Real article id/slug, read live from the `articles` table — used to
// cross-link the intro back to the existing morning coffee guide.
const ARTICLE_CAFE_HOPPING = { id: "d3a429ca-416b-42ce-aebf-337ac0ef56e0", slug: "cafe-hopping-morning-casco-viejo" };

function linkSpot(locale, spot, label) {
  return `<a href="/${locale}/spots/${spot.slug}" data-ref-type="spot" data-ref-id="${spot.id}">${label}</a>`;
}

function linkArticle(locale, article, label) {
  return `<a href="/${locale}/articles/${article.slug}" data-ref-type="article" data-ref-id="${article.id}">${label}</a>`;
}

function block({ photo, time, time_es, time_en, text_es, text_en, spot }) {
  return {
    id: crypto.randomUUID(),
    photo,
    title_es: time_es,
    title_en: time_en,
    text_es,
    text_en,
    // 24h "HH:MM" — the raw value ArticleBlocksEditor's <input type="time">
    // repopulates from when this article is reopened in the admin.
    time,
    ref_type: "spot",
    ref_id: spot.id,
    ref_slug: spot.slug,
  };
}

const now = new Date().toISOString();

const article = {
  slug: "afternoon-in-casco-viejo",
  title_es: "Una tarde perfecta en Casco Viejo, paso a paso",
  title_en: "A Perfect Afternoon in Casco Viejo, Step by Step",
  excerpt_es: "De un almuerzo panameño a un rooftop al atardecer: un plan hora por hora para la tarde en el barrio, con un enlace a cada parada.",
  excerpt_en: "From a Panamanian lunch to a rooftop at sunset: an hour-by-hour plan for the afternoon in the neighborhood, with a link to each stop.",
  layout: "itinerary",
  cover_photo: SPOT.plazaFrancia.photo,
  tags: ["itinerary", "afternoon", "one-day"],
  author: "Casco Guide Team",
  is_published: true,
  is_featured: true,
  body_es: `<p>Casco Viejo cambia de ritmo después del mediodía: el calor empuja a buscar sombra e interiores frescos, y las calles se llenan de nuevo poco a poco de cara al atardecer. Este es un plan hora por hora para aprovechar la tarde entera, de un almuerzo panameño a un rooftop con vista al skyline. Si quieres alargarlo a un día completo, combínalo con esta ${linkArticle("es", ARTICLE_CAFE_HOPPING, "mañana de café por el barrio")} antes de almorzar.</p>`,
  body_en: `<p>Casco Viejo shifts pace after midday — the heat pushes you toward shade and cool interiors, and the streets slowly fill back up as the light turns golden. Here's an hour-by-hour plan for the whole afternoon, from a Panamanian lunch to a rooftop with skyline views. To stretch it into a full day, pair it with this ${linkArticle("en", ARTICLE_CAFE_HOPPING, "café-hopping morning through the neighborhood")} beforehand.</p>`,
  blocks: [
    block({
      photo: SPOT.fondaLoQueHay.photo,
      time: "12:30", time_es: "12:30 p.m.", time_en: "12:30 PM",
      text_es: "Empieza con comida panameña de verdad en Fonda Lo Que Hay: el menú cambia cada día según lo que haya en el mercado esa mañana, así que pregunta qué recomiendan antes de sentarte.",
      text_en: "Start with real Panamanian home cooking at Fonda Lo Que Hay: the menu changes daily depending on what came in from the market that morning, so ask what they recommend before sitting down.",
      spot: SPOT.fondaLoQueHay,
    }),
    block({
      photo: SPOT.museoMola.photo,
      time: "13:30", time_es: "1:30 p.m.", time_en: "1:30 PM",
      text_es: "A dos cuadras, el Museo de la Mola (MUMO) dedica sus salas a la mola, el textil tradicional de la comarca Guna Yala — media hora perfecta de digestión con aire acondicionado.",
      text_en: "Two blocks over, the Museo de la Mola (MUMO) is dedicated to the mola, the traditional textile art of the Guna Yala comarca — a perfect half hour of air-conditioned digestion time.",
      spot: SPOT.museoMola,
    }),
    block({
      photo: SPOT.karavan.photo,
      time: "14:30", time_es: "2:30 p.m.", time_en: "2:30 PM",
      text_es: "Karavan reúne ropa, joyería y objetos de diseñadores y artesanos panameños — buena parada para encontrar un recuerdo que no sea un imán de nevera.",
      text_en: "Karavan gathers clothing, jewelry, and objects from Panamanian designers and artisans — a good stop for a souvenir that isn't a fridge magnet.",
      spot: SPOT.karavan,
    }),
    block({
      photo: SPOT.plazaFrancia.photo,
      time: "15:30", time_es: "3:30 p.m.", time_en: "3:30 PM",
      text_es: "Camina hasta la punta del barrio para ver la Plaza de Francia y su paseo sobre la muralla frente al mar, con placas que recuerdan a los miles de trabajadores franceses que murieron durante el primer intento de construir el canal.",
      text_en: "Walk to the tip of the peninsula for Plaza de Francia and its seawall promenade, lined with plaques honoring the thousands of French workers who died during the first attempt to build the canal.",
      spot: SPOT.plazaFrancia,
    }),
    block({
      photo: SPOT.granclement.photo,
      time: "16:30", time_es: "4:30 p.m.", time_en: "4:30 PM",
      text_es: "El calor de media tarde pide un helado o sorbete artesanal en Granclement — los sabores rotan y suelen incluir frutas locales como maracuyá o guanábana.",
      text_en: "The mid-afternoon heat calls for an artisanal ice cream or sorbet at Granclement — flavors rotate and often include local fruit like passionfruit or soursop.",
      spot: SPOT.granclement,
    }),
    block({
      photo: SPOT.tantalo.photo,
      time: "17:30", time_es: "5:30 p.m.", time_en: "5:30 PM",
      text_es: "Cierra la tarde subiendo a la terraza de Tántalo justo antes del atardecer, con el skyline de Panamá de fondo — llega temprano, se llena rápido.",
      text_en: "Close out the afternoon by heading up to Tántalo's rooftop just before sunset, with the Panama City skyline as a backdrop — arrive early, it fills up fast.",
      spot: SPOT.tantalo,
    }),
  ],
};

// spot_refs/event_refs are normally computed server-side by
// src/lib/actions/articles.ts on save — replicate that here since this
// script writes straight to Supabase, bypassing the app.
const spotIds = new Set();
for (const html of [article.body_es, article.body_en]) {
  for (const m of html.matchAll(/data-ref-type="spot"\s+data-ref-id="([^"]+)"/g)) spotIds.add(m[1]);
}
for (const b of article.blocks) {
  if (b.ref_type === "spot" && b.ref_id) spotIds.add(b.ref_id);
}

const payload = [
  {
    ...article,
    spot_refs: [...spotIds],
    event_refs: [],
    published_at: article.is_published ? now : null,
  },
];

console.log(`Seeding "${article.slug}"…`);

const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?on_conflict=slug`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Seed failed (${res.status}):`, text);
  process.exit(1);
}

const data = await res.json();
console.log(`✔ Upserted ${data.length} article:`);
for (const row of data) {
  console.log(`  - [${row.layout}] ${row.title_es} (${row.slug}) — ${row.spot_refs.length} spot refs`);
}
