// One-off data-migration script: splits the existing "La Compañía Boutique
// Hotel" spot into a parent hub + two child businesses (its on-site
// restaurant and bar), using the new parent_id hierarchy (see
// supabase/migrations/0011_spot_hierarchy.sql). The hotel row itself is
// left untouched — this only inserts the two new child rows, upserting on
// slug so it's safe to re-run.
//
// Run with:
//
//   node scripts/split-la-compania.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from
// .env.local — loaded manually below since this script runs outside Next).
//
// Data notes: same convention as scripts/seed-casco-viejo.mjs — the
// restaurant and bar's own names, category and location are real (the
// hotel's description mentions both), but hours/contact/cuisine weren't
// individually verified, so those are left null/empty with is_verified:
// false and hours_note flagging it, rather than invented. Treat this as a
// skeleton to verify and enrich via /admin, not finished data.

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

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const PARENT_SLUG = "la-compania-boutique-hotel";

const parentRes = await fetch(
  `${SUPABASE_URL}/rest/v1/spots?slug=eq.${PARENT_SLUG}&select=*`,
  { headers },
);
if (!parentRes.ok) {
  console.error(`Failed to fetch parent (${parentRes.status}):`, await parentRes.text());
  process.exit(1);
}
const [parent] = await parentRes.json();
if (!parent) {
  console.error(`No spot found with slug "${PARENT_SLUG}" — nothing to split.`);
  process.exit(1);
}
if (parent.parent_id) {
  console.error(`"${PARENT_SLUG}" already has a parent of its own — refusing to give it children.`);
  process.exit(1);
}

const UNVERIFIED_NOTE_ES = "Horario aún no verificado — confirma antes de visitar.";
const UNVERIFIED_NOTE_EN = "Hours not yet verified — please confirm before visiting.";

// Shared with the parent — same building, same physical location.
const shared = {
  parent_id: parent.id,
  latitude: parent.latitude,
  longitude: parent.longitude,
  address: parent.address,
  neighborhood: parent.neighborhood,
  parking: parent.parking,
  accepts_cards: parent.accepts_cards,
  phone: null,
  website: null,
  email: null,
  hours_monday: null,
  hours_tuesday: null,
  hours_wednesday: null,
  hours_thursday: null,
  hours_friday: null,
  hours_saturday: null,
  hours_sunday: null,
  hours_note_es: UNVERIFIED_NOTE_ES,
  hours_note_en: UNVERIFIED_NOTE_EN,
  price_range: null,
  cuisine_type_es: null,
  cuisine_type_en: null,
  dietary_options: [],
  reservation_required: false,
  photos: [],
  featured_photo: null,
  rating: null,
  review_count: 0,
  is_featured: false,
  is_verified: false,
  last_verified: null,
};

const children = [
  {
    ...shared,
    name_es: "La Compañía Restaurant",
    name_en: "La Compañía Restaurant",
    slug: "la-compania-restaurant",
    category: "restaurant",
    vibes: [],
    description_es: "Restaurante del hotel La Compañía Boutique Hotel.",
    description_en: "The restaurant at La Compañía Boutique Hotel.",
    article_es: null,
    article_en: null,
    tags: ["on-site-restaurant"],
  },
  {
    ...shared,
    name_es: "La Compañía Bar",
    name_en: "La Compañía Bar",
    slug: "la-compania-bar",
    category: "bar",
    vibes: [],
    description_es: "Bar del hotel La Compañía Boutique Hotel.",
    description_en: "The bar at La Compañía Boutique Hotel.",
    article_es: null,
    article_en: null,
    tags: ["on-site-bar"],
  },
];

console.log(`Splitting "${parent.name_es}" (${parent.id}) into ${children.length} child spots…`);

const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?on_conflict=slug`, {
  method: "POST",
  headers: {
    ...headers,
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(children),
});

if (!res.ok) {
  console.error(`Split failed (${res.status}):`, await res.text());
  process.exit(1);
}

const data = await res.json();
console.log(`✔ Upserted ${data.length} child spots:`);
for (const row of data) {
  console.log(`  - [${row.category}] ${row.name_es} (${row.slug}) → parent_id ${row.parent_id}`);
}
