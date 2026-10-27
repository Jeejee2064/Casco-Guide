// Pre-generates (and stores in Supabase Storage) the share card of every spot
// and published guide, in both languages, by requesting the app's og route.
// Run after a deploy, or whenever you want to warm everything:
//   node --env-file=.env.local scripts/generate-share-images.mjs https://cascoviejo.guide
// Idempotent: cards that already exist for the current updated_at are just
// re-read from storage.
// Keep in sync with SHARE_DESIGN_VERSION in src/lib/seo/site.ts (cache-busting only here).
const DESIGN = 2;
const base = (process.argv[2] ?? "").replace(/\/+$/, "");
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = process.env;
if (!base || !url || !key) {
  console.error("usage: node --env-file=.env.local scripts/generate-share-images.mjs <site-url>");
  process.exit(1);
}

const rest = async (table, filter = "") => {
  const res = await fetch(`${url}/rest/v1/${table}?select=slug,updated_at${filter}`, {
    headers: { apikey: key },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status}`);
  return res.json();
};

const jobs = [
  ...(await rest("spots")).map((r) => ["spots", r]),
  ...(await rest("articles", "&is_published=eq.true")).map((r) => ["guides", r]),
];

let ok = 0;
for (const [type, { slug, updated_at }] of jobs) {
  for (const locale of ["es", "en"]) {
    const v = Date.parse(updated_at) || 0;
    const res = await fetch(`${base}/api/og/${type}/${slug}?locale=${locale}&v=${v}&d=${DESIGN}`);
    const kb = Math.round((await res.arrayBuffer()).byteLength / 1024);
    console.log(`${res.ok ? "ok  " : "FAIL"} ${type}/${slug} ${locale} ${kb} KB`);
    if (res.ok) ok++;
  }
}
console.log(`\n${ok}/${jobs.length * 2} cards ready`);
