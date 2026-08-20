// One-off seed script: populates `articles` with 4 real, well-researched
// pieces about Casco Viejo, each exercising a different layout and citing
// real spots already seeded by scripts/seed-casco-viejo.mjs. The 4th
// ("a-day-in-casco-viejo") also cross-links to the other 3 articles inline,
// exercising the article-to-article body links added alongside
// PlaceLinkPicker's "article" type. Run with:
//
//   node scripts/seed-articles.mjs
//
// Requires the `articles` table to exist — run
// supabase/migrations/0005_articles.sql against the DB first — plus
// NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env.local).
// Upserts on `slug`, so it's safe to re-run.
//
// Spot ids/slugs/photos below were read live from the `spots` table
// (scripts/seed-casco-viejo.mjs's data) — if that seed is re-run with
// different ids this script's spot_refs/ref_id fields would need updating.
// Same goes for the ARTICLE ids below (read live from a first run of this
// script) — a fresh DB would need those swapped for the real new ids, or
// this article seeded in a second pass once the other 3 exist.

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

// Real spot ids/slugs from the live `spots` table (see file header note).
const SPOT = {
  plazaIndependencia: { id: "7838eff3-49c5-478b-badb-af1af37116a8", slug: "plaza-de-la-independencia", photo: "https://images.unsplash.com/photo-1762995877049-c03b355f3fbd?q=80&w=1200&auto=format&fit=crop" },
  catedral: { id: "f9b6f381-d036-463b-8909-7faec385f2da", slug: "catedral-metropolitana-de-panama", photo: "https://images.unsplash.com/photo-1744295492364-4c9c04b62a8b?q=80&w=1200&auto=format&fit=crop" },
  iglesiaSanJose: { id: "ce047766-59b7-4231-b697-de57e613a7e9", slug: "iglesia-de-san-jose", photo: "https://images.unsplash.com/photo-1504389273929-44baec1307d2?q=80&w=1200&auto=format&fit=crop" },
  lasBovedas: { id: "19bf03ad-4a99-4c5f-a4a7-cb328295712f", slug: "las-bovedas", photo: "https://images.unsplash.com/photo-1422748956421-2d6326b6d9d6?q=80&w=1200&auto=format&fit=crop" },
  palacioGarzas: { id: "c6e68968-00ca-4a0d-b904-b6866bf1d413", slug: "palacio-de-las-garzas", photo: "https://images.unsplash.com/photo-1705974511794-19cded776600?q=80&w=1200&auto=format&fit=crop" },
  balooCafe: { id: "3acdf44c-7acb-41cd-b054-4343adc4f34a", slug: "baloo-cafe", photo: "https://images.unsplash.com/photo-1622758235004-51977c5863f5?q=80&w=1200&auto=format&fit=crop" },
  cafeUnido: { id: "60c6cdf7-6177-411b-873b-bdccf667fd6f", slug: "cafe-unido", photo: "https://images.unsplash.com/photo-1621275471769-e6aa344546d5?q=80&w=1200&auto=format&fit=crop" },
  granclement: { id: "28a054da-7c62-4643-ab07-7d59e45326fb", slug: "granclement", photo: "https://images.unsplash.com/photo-1657220644506-77fa47a3487b?q=80&w=1200&auto=format&fit=crop" },
  ranaDorada: { id: "fc40ede8-175a-4ce4-b648-404083c1bd5a", slug: "la-rana-dorada-casco-viejo", photo: "https://images.unsplash.com/photo-1784571080367-d214f71ec0f7?q=80&w=1200&auto=format&fit=crop" },
  labarbara: { id: "17d84808-7829-4c9d-ad64-fc5d16416eef", slug: "labarbara", photo: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?q=80&w=1200&auto=format&fit=crop" },
  tantalo: { id: "d09e843a-2dac-477d-9bd4-f182106e3577", slug: "tantalo-rooftop-bar", photo: "https://images.unsplash.com/photo-1692261920240-a3c88f29e25f?q=80&w=1200&auto=format&fit=crop" },
  pedroMandinga: { id: "ee143356-bf2b-426b-a159-2dd46f84a042", slug: "pedro-mandinga-rum-bar", photo: "https://images.unsplash.com/photo-1598994392980-53a7fb033bcc?q=80&w=1200&auto=format&fit=crop" },
};

// Real article ids from the live `articles` table (see file header note) —
// used to cross-link the 4th article below to the first 3.
const ARTICLE = {
  historicLandmarks: { id: "7d7334df-7b1a-40c7-a56f-0f23eedd3e57", slug: "top-5-historic-landmarks-casco-viejo" },
  cafeHopping: { id: "d3a429ca-416b-42ce-aebf-337ac0ef56e0", slug: "cafe-hopping-morning-casco-viejo" },
  rooftopBars: { id: "e89f38da-7faf-42f9-8c06-782ca89974e0", slug: "best-rooftop-cocktail-bars-casco-viejo" },
};

// Builds the <a data-ref-type=… data-ref-id=…> markup ArticleBodyEditor
// produces, in a given locale, so the standard-layout body reads exactly
// like content saved from the real admin editor.
function link(locale, spot, label) {
  return `<a href="/${locale}/spots/${spot.slug}" data-ref-type="spot" data-ref-id="${spot.id}">${label}</a>`;
}

// Same, for a link to another article — mirrors the "article" LinkablePlace
// type PlaceLinkPicker/ArticleBodyEditor produce.
function linkArticle(locale, article, label) {
  return `<a href="/${locale}/articles/${article.slug}" data-ref-type="article" data-ref-id="${article.id}">${label}</a>`;
}

function block({ photo, title_es, title_en, text_es, text_en, spot }) {
  return {
    id: crypto.randomUUID(),
    photo,
    title_es,
    title_en,
    text_es,
    text_en,
    ref_type: spot ? "spot" : null,
    ref_id: spot ? spot.id : null,
    ref_slug: spot ? spot.slug : null,
  };
}

const now = new Date().toISOString();

const articles = [
  {
    slug: "top-5-historic-landmarks-casco-viejo",
    title_es: "Top 5 monumentos históricos de Casco Viejo",
    title_en: "Top 5 Historic Landmarks in Casco Viejo",
    excerpt_es: "De la plaza donde se declaró la independencia al altar que sobrevivió a un pirata: cinco paradas imprescindibles para entender la historia del barrio.",
    excerpt_en: "From the plaza where independence was declared to the altar that outlasted a pirate raid — five essential stops for understanding the neighborhood's history.",
    layout: "list",
    body_es: "<p>Casco Viejo se construyó a partir de 1673, tras el ataque de Henry Morgan a la antigua Panamá, y sigue siendo un museo urbano al aire libre. Estas cinco paradas son el mejor punto de partida para conocer su historia a pie.</p>",
    body_en: "<p>Casco Viejo was built starting in 1673, after Henry Morgan's raid destroyed the original city, and it still reads like an open-air history museum. These five stops are the best on-foot introduction to that story.</p>",
    cover_photo: SPOT.plazaIndependencia.photo,
    tags: ["history", "landmarks", "top-list"],
    author: "Casco Guide Team",
    is_published: true,
    is_featured: true,
    blocks: [
      block({
        photo: SPOT.plazaIndependencia.photo,
        title_es: "Plaza de la Independencia", title_en: "Plaza de la Independencia",
        text_es: "El corazón cívico del barrio, donde Panamá declaró su independencia de Colombia en 1903. Hoy la rodean la catedral, el ayuntamiento y cafés con mesas al aire libre.",
        text_en: "The neighborhood's civic heart, where Panama declared independence from Colombia in 1903. Today it's ringed by the cathedral, city hall, and sidewalk cafés.",
        spot: SPOT.plazaIndependencia,
      }),
      block({
        photo: SPOT.catedral.photo,
        title_es: "Catedral Metropolitana de Panamá", title_en: "Catedral Metropolitana de Panamá",
        text_es: "Terminada en 1796, domina la plaza con sus dos torres campanario incrustadas de nácar — un proyecto que tardó más de un siglo en completarse.",
        text_en: "Completed in 1796, it dominates the plaza with twin bell towers inlaid with mother-of-pearl — a project that took over a century to finish.",
        spot: SPOT.catedral,
      }),
      block({
        photo: SPOT.iglesiaSanJose.photo,
        title_es: "Iglesia de San José (Altar de Oro)", title_en: "Iglesia de San José (Altar de Oro)",
        text_es: "Alberga el legendario Altar de Oro, que según la tradición se salvó del saqueo de Henry Morgan porque un sacerdote lo pintó de negro para disimularlo.",
        text_en: "Home to the legendary Golden Altar, said to have survived Henry Morgan's raid because a priest disguised it under a coat of black paint.",
        spot: SPOT.iglesiaSanJose,
      }),
      block({
        photo: SPOT.lasBovedas.photo,
        title_es: "Las Bóvedas", title_en: "Las Bóvedas",
        text_es: "Antiguas mazmorras españolas construidas dentro de la muralla frente al mar. Hoy albergan galerías de arte y una plaza con vistas a la bahía.",
        text_en: "Former Spanish dungeons built into the seawall. They now house art galleries and a small plaza with views out over the bay.",
        spot: SPOT.lasBovedas,
      }),
      block({
        photo: SPOT.palacioGarzas.photo,
        title_es: "Palacio de las Garzas", title_en: "Palacio de las Garzas",
        text_es: "Residencia oficial del presidente de Panamá, llamada así por las garzas que aún pasean por su patio interior de estilo morisco.",
        text_en: "The Panamanian president's official residence, named for the herons that still roam its Moorish-style inner courtyard.",
        spot: SPOT.palacioGarzas,
      }),
    ],
  },
  {
    slug: "cafe-hopping-morning-casco-viejo",
    title_es: "Una mañana perfecta de café en Casco Viejo",
    title_en: "A Perfect Café-Hopping Morning in Casco Viejo",
    excerpt_es: "Tres paradas de café a poca distancia a pie, para una mañana tranquila explorando las calles adoquinadas del barrio.",
    excerpt_en: "Three coffee stops within easy walking distance, for a slow morning exploring the neighborhood's cobblestone streets.",
    layout: "standard",
    cover_photo: SPOT.balooCafe.photo,
    tags: ["coffee", "itinerary", "mornings"],
    author: "Casco Guide Team",
    is_published: true,
    is_featured: false,
    blocks: [],
    body_es: `<p>Casco Viejo se recorre mejor temprano, antes del calor del mediodía — y no hay mejor excusa para caminar sin prisa que encadenar tres cafés.</p>
<p>Empieza en ${link("es", SPOT.balooCafe, "Baloo Cafe")}, una parada pequeña y luminosa ideal para un espresso rápido antes de perderte por las calles adoquinadas.</p>
<p>Sigue hacia ${link("es", SPOT.cafeUnido, "Café Unido")}, que tuesta su propio grano panameño — buen momento para sentarte con un filtrado y ver pasar el barrio.</p>
<p>Termina con algo dulce en ${link("es", SPOT.granclement, "Granclement")}, conocida por sus helados y sorbetes artesanales, perfecta ya con el sol más alto.</p>`,
    body_en: `<p>Casco Viejo is best explored early, before the midday heat sets in — and there's no better excuse to wander slowly than stringing together three coffee stops.</p>
<p>Start at ${link("en", SPOT.balooCafe, "Baloo Cafe")}, a small, bright spot perfect for a quick espresso before losing yourself in the cobblestone streets.</p>
<p>Head next to ${link("en", SPOT.cafeUnido, "Café Unido")}, which roasts its own Panamanian beans — a good spot to sit with a pour-over and watch the neighborhood go by.</p>
<p>Finish with something sweet at ${link("en", SPOT.granclement, "Granclement")}, known for its artisanal ice cream and sorbet — ideal once the sun is higher.</p>`,
  },
  {
    slug: "best-rooftop-cocktail-bars-casco-viejo",
    title_es: "Dónde beber: los mejores bares y rooftops de Casco Viejo",
    title_en: "Where to Drink: Casco Viejo's Best Rooftop & Cocktail Bars",
    excerpt_es: "Cuatro direcciones para la noche, de cervecería artesanal a rooftop con vista al skyline — en fotos.",
    excerpt_en: "Four addresses for the evening, from craft beer to a rooftop with skyline views — in photos.",
    layout: "photo-story",
    cover_photo: SPOT.tantalo.photo,
    tags: ["nightlife", "bars", "cocktails"],
    author: "Casco Guide Team",
    is_published: true,
    is_featured: true,
    body_es: "",
    body_en: "",
    blocks: [
      block({
        photo: SPOT.ranaDorada.photo,
        title_es: "La Rana Dorada Casco Viejo", title_en: "La Rana Dorada Casco Viejo",
        text_es: "Cervecería artesanal panameña con terraza sobre la calle — buena manera de arrancar la noche con algo ligero.",
        text_en: "A Panamanian craft brewery with a street-side terrace — a good, easy way to start the evening.",
        spot: SPOT.ranaDorada,
      }),
      block({
        photo: SPOT.labarbara.photo,
        title_es: "Labarbara", title_en: "Labarbara",
        text_es: "Coctelería de ambiente íntimo, con cartas de autor y buena música — ideal para una parada más tranquila.",
        text_en: "An intimate cocktail bar with a creative menu and good music — ideal for a quieter stop along the way.",
        spot: SPOT.labarbara,
      }),
      block({
        photo: SPOT.tantalo.photo,
        title_es: "Tántalo Rooftop Bar", title_en: "Tántalo Rooftop Bar",
        text_es: "El rooftop más conocido del barrio, con vistas al skyline de Panamá de fondo — llega antes del atardecer para conseguir mesa.",
        text_en: "The neighborhood's best-known rooftop, with the Panama City skyline as a backdrop — arrive before sunset to get a table.",
        spot: SPOT.tantalo,
      }),
      block({
        photo: SPOT.pedroMandinga.photo,
        title_es: "Pedro Mandinga Rum Bar", title_en: "Pedro Mandinga Rum Bar",
        text_es: "Bar de rones panameños con ambiente animado y música en vivo casi todas las noches — buen cierre de noche.",
        text_en: "A Panamanian rum bar with a lively atmosphere and live music most nights — a solid way to close out the evening.",
        spot: SPOT.pedroMandinga,
      }),
    ],
  },
  {
    slug: "a-day-in-casco-viejo",
    title_es: "Un día completo en Casco Viejo, hora por hora",
    title_en: "A Full Day in Casco Viejo, Hour by Hour",
    excerpt_es: "De la plaza al rooftop: un plan de mañana a noche por el barrio, con paradas y guías para profundizar en cada tramo.",
    excerpt_en: "From the plaza to the rooftop: a morning-to-night plan through the neighborhood, with stops and guides to go deeper at each stretch.",
    layout: "standard",
    cover_photo: SPOT.plazaIndependencia.photo,
    tags: ["itinerary", "guide", "one-day"],
    author: "Casco Guide Team",
    is_published: true,
    is_featured: false,
    blocks: [],
    body_es: `<p>Un día completo en Casco Viejo empieza temprano y termina con vistas al skyline. Aquí tienes un plan hora por hora para aprovecharlo entero, con enlaces a guías más a fondo si alguna parada te engancha.</p>
<p>Arranca la mañana en la ${link("es", SPOT.plazaIndependencia, "Plaza de la Independencia")}, el corazón cívico del barrio, y sigue el ritmo con un café. Si quieres alargar la mañana, este ${linkArticle("es", ARTICLE.cafeHopping, "recorrido de café por el barrio")} tiene tres paradas más.</p>
<p>Al mediodía cruza hacia la ${link("es", SPOT.catedral, "Catedral Metropolitana")} y asómate a ${link("es", SPOT.lasBovedas, "Las Bóvedas")} para ver el mar desde la muralla. Y si la historia del barrio te engancha, este ${linkArticle("es", ARTICLE.historicLandmarks, "top 5 de monumentos históricos")} cubre las paradas que no te puedes perder.</p>
<p>Cuando caiga el sol, sube a ${link("es", SPOT.tantalo, "Tántalo Rooftop Bar")} para el atardecer sobre el skyline. Para más opciones de noche, esta ${linkArticle("es", ARTICLE.rooftopBars, "guía de bares y rooftops")} tiene tres direcciones más.</p>`,
    body_en: `<p>A full day in Casco Viejo starts early and ends with skyline views. Here's an hour-by-hour plan to make the most of it, with links to deeper guides in case a stop hooks you.</p>
<p>Start the morning at ${link("en", SPOT.plazaIndependencia, "Plaza de la Independencia")}, the neighborhood's civic heart, and settle into the day with a coffee. If you want to stretch the morning out, this ${linkArticle("en", ARTICLE.cafeHopping, "café-hopping route through the neighborhood")} has three more stops.</p>
<p>At midday, cross over to the ${link("en", SPOT.catedral, "Catedral Metropolitana")} and step into ${link("en", SPOT.lasBovedas, "Las Bóvedas")} for a view of the sea from the seawall. And if the neighborhood's history hooks you, this ${linkArticle("en", ARTICLE.historicLandmarks, "top 5 historic landmarks")} covers the stops you shouldn't miss.</p>
<p>Once the sun starts to drop, head up to ${link("en", SPOT.tantalo, "Tántalo Rooftop Bar")} for sunset over the skyline. For more evening options, this ${linkArticle("en", ARTICLE.rooftopBars, "bars & rooftops guide")} has three more addresses.</p>`,
  },
];

// spot_refs/event_refs are normally computed server-side by
// src/lib/actions/articles.ts on save — replicate that here since this
// script writes straight to Supabase, bypassing the app.
const payload = articles.map((a) => {
  const spotIds = new Set();
  for (const html of [a.body_es, a.body_en]) {
    for (const m of html.matchAll(/data-ref-type="spot"\s+data-ref-id="([^"]+)"/g)) spotIds.add(m[1]);
  }
  for (const b of a.blocks) {
    if (b.ref_type === "spot" && b.ref_id) spotIds.add(b.ref_id);
  }
  return {
    ...a,
    spot_refs: [...spotIds],
    event_refs: [],
    published_at: a.is_published ? now : null,
  };
});

console.log(`Seeding ${payload.length} articles…`);

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
console.log(`✔ Upserted ${data.length} articles:`);
for (const row of data) {
  console.log(`  - [${row.layout}] ${row.title_es} (${row.slug}) — ${row.spot_refs.length} spot refs`);
}
