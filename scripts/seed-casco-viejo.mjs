// One-off seed script: populates `spots` with ~30 real, well-known Casco
// Viejo venues (landmarks, museums, restaurants, bars, cafés, hotels, a
// gallery and a shop). Run with:
//
//   node scripts/seed-casco-viejo.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from
// .env.local — loaded manually below since this script runs outside Next).
// Upserts on `slug`, so it's safe to re-run.
//
// Data notes: names, categories and locations are real and drawn from
// well-documented sources. Hours, phone numbers, websites and photos were
// NOT individually verified — hours_note flags this, is_verified is false,
// and rating/review_count are left at null/0 rather than invented. Treat
// this as a real starting skeleton to verify and enrich via /admin, not
// finished data.

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
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

// Plain PostgREST call via fetch instead of @supabase/supabase-js: the
// installed supabase-js version always spins up a realtime client on
// createClient(), which needs a native WebSocket global that Node 20
// doesn't provide (Node 22+ does). We don't need realtime here.

const UNVERIFIED_NOTE = "Hours not yet verified — please confirm before visiting.";

const NO_HOURS = {
  hours_monday: null,
  hours_tuesday: null,
  hours_wednesday: null,
  hours_thursday: null,
  hours_friday: null,
  hours_saturday: null,
  hours_sunday: null,
  hours_note: UNVERIFIED_NOTE,
};

const base = {
  neighborhood: "Casco Viejo",
  phone: null,
  website: null,
  email: null,
  ...NO_HOURS,
  price_range: null,
  cuisine_type: null,
  dietary_options: [],
  reservation_required: false,
  accepts_cards: true,
  parking: null,
  photos: [],
  featured_photo: null,
  rating: null,
  review_count: 0,
  is_featured: false,
  is_verified: false,
  last_verified: null,
};

const spots = [
  // ─── Landmarks & plazas ──────────────────────────────────────
  {
    ...base,
    name: "Plaza de la Independencia",
    slug: "plaza-de-la-independencia",
    featured_photo: "https://images.unsplash.com/photo-1762995877049-c03b355f3fbd?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9531,
    longitude: -79.5350,
    address: "Plaza de la Independencia, Casco Viejo",
    description:
      "Casco Viejo's central plaza and the historic heart of the neighborhood, where independence from Colombia was declared in 1903.",
    article:
      "Ringed by the cathedral, the old Palacio Municipal and colonial-era arcades, Plaza de la Independencia (also called Plaza Mayor or Parque Catedral) is the natural starting point for exploring Casco Viejo. It's free to visit and busiest in the late afternoon and evening.",
    tags: ["plaza", "landmark", "free", "history"],
    is_featured: true,
  },
  {
    ...base,
    name: "Catedral Metropolitana de Panamá",
    slug: "catedral-metropolitana-de-panama",
    featured_photo: "https://images.unsplash.com/photo-1744295492364-4c9c04b62a8b?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9530,
    longitude: -79.5349,
    address: "Plaza de la Independencia, Casco Viejo",
    description:
      "18th-century cathedral with twin bell towers inlaid with mother-of-pearl, facing Plaza de la Independencia.",
    article:
      "Built between 1688 and 1796 from stone salvaged from the ruins of old Panama (Panamá Viejo), the Metropolitan Cathedral anchors the main plaza. Its restored interior has a marble altar and stained glass; entry is generally free outside of Mass times.",
    tags: ["church", "landmark", "free", "architecture"],
    is_featured: true,
  },
  {
    ...base,
    name: "Iglesia de San José (Altar de Oro)",
    slug: "iglesia-de-san-jose",
    featured_photo: "https://images.unsplash.com/photo-1504389273929-44baec1307d2?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9520,
    longitude: -79.5361,
    address: "Avenida A, Casco Viejo",
    description:
      "Colonial church famous for its baroque gold-leaf altar, according to local legend saved from Henry Morgan's 1671 raid on the old city.",
    article:
      "Whether or not the pirate legend is literally true, the Altar de Oro is one of Casco Viejo's most photographed sights — an ornate gilded altarpiece inside an otherwise modest parish church. Modest dress is appreciated when visiting.",
    tags: ["church", "landmark", "free", "history"],
    is_featured: true,
  },
  {
    ...base,
    name: "Plaza Bolívar",
    slug: "plaza-bolivar",
    featured_photo: "https://images.unsplash.com/photo-1776787965639-da3c467556e9?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9523,
    longitude: -79.5355,
    address: "Plaza Bolívar, Casco Viejo",
    description:
      "Shaded plaza named for Simón Bolívar, lined with cafés and the Palacio Bolívar where the 1826 Amphictyonic Congress was held.",
    article:
      "A quieter counterpart to Plaza de la Independencia, Plaza Bolívar is framed by the Palacio Bolívar (now Panama's Foreign Ministry) and the San Francisco de Asís church, and makes a good coffee stop between sights.",
    tags: ["plaza", "landmark", "free", "history"],
  },
  {
    ...base,
    name: "Teatro Nacional de Panamá",
    slug: "teatro-nacional-de-panama",
    featured_photo: "https://images.unsplash.com/photo-1607998803461-4e9aef3be418?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9514,
    longitude: -79.5344,
    address: "Avenida B, Casco Viejo",
    description:
      "Ornate 1908 Beaux-Arts national theatre with a painted ceiling by Roberto Lewis, still hosting opera, ballet and concerts.",
    article:
      "Panama's national theatre was built on the site of a colonial convent and remains the country's premier venue for the National Symphony Orchestra, ballet and opera. Check the current season for performance and tour listings.",
    tags: ["theatre", "landmark", "performing-arts"],
  },
  {
    ...base,
    name: "Ruinas del Convento de Santo Domingo (Arco Chato)",
    slug: "ruinas-del-convento-de-santo-domingo",
    featured_photo: "https://images.unsplash.com/photo-1785530545097-96707ba6a796?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9516,
    longitude: -79.5363,
    address: "Calle 3, Casco Viejo",
    description:
      "Ruins of a 17th-century convent, known for the flat stone arch (Arco Chato) that reportedly helped convince US engineers Panama was seismically safe for the canal.",
    article:
      "The original Arco Chato collapsed in 2003 (a reconstruction now stands in its place) but the surrounding ruins — repeatedly gutted by fire since colonial times — remain one of Casco Viejo's most atmospheric free sights.",
    tags: ["ruins", "landmark", "free", "history"],
  },
  {
    ...base,
    name: "Plaza de Francia",
    slug: "plaza-de-francia",
    featured_photo: "https://images.unsplash.com/photo-1778224978538-28bcf26422bf?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9507,
    longitude: -79.5341,
    address: "Plaza de Francia, Casco Viejo",
    description:
      "Waterfront plaza at the peninsula's southern tip honoring the French canal effort, with obelisks, plaques and views over the bay.",
    article:
      "Named for Ferdinand de Lesseps' failed French canal attempt, this plaza sits at the scenic southern tip of Casco Viejo, next to Las Bóvedas, and is a natural finish point for a walking tour at sunset.",
    tags: ["plaza", "landmark", "free", "waterfront"],
    is_featured: true,
  },
  {
    ...base,
    name: "Las Bóvedas",
    slug: "las-bovedas",
    featured_photo: "https://images.unsplash.com/photo-1422748956421-2d6326b6d9d6?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9506,
    longitude: -79.5340,
    address: "Plaza de Francia, Casco Viejo",
    description:
      "Vaulted colonial dungeons built into the sea wall next to Plaza de Francia, now housing an arts space and restaurant terraces.",
    article:
      "Once used as a prison and munitions store as part of the city's fortifications, Las Bóvedas ('the vaults') now hosts a small gallery and cafés built into the old stone arches, with sea views from the terrace above.",
    tags: ["landmark", "history", "free"],
  },
  {
    ...base,
    name: "Paseo Esteban Huertas",
    slug: "paseo-esteban-huertas",
    featured_photo: "https://images.unsplash.com/photo-1785522372775-874e61939f2d?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9511,
    longitude: -79.5338,
    address: "Paseo Esteban Huertas, Casco Viejo",
    description:
      "Tree-lined promenade atop the old city wall connecting Las Bóvedas to Plaza de Francia, popular at sunset.",
    article:
      "This bougainvillea-covered walkway runs along the top of the original sea wall (murallas), giving open views over the bay toward the modern skyline — one of the best free vantage points in Casco Viejo.",
    tags: ["promenade", "views", "free", "sunset"],
  },
  {
    ...base,
    name: "Palacio de las Garzas (Presidential Palace)",
    slug: "palacio-de-las-garzas",
    featured_photo: "https://images.unsplash.com/photo-1705974511794-19cded776600?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9556,
    longitude: -79.5345,
    address: "Avenida Alfaro, Casco Viejo",
    description:
      "Panama's presidential palace on the waterfront, named for the herons (garzas) that live in its central courtyard fountain.",
    article:
      "The seat of Panama's executive branch is closed to the public and guarded, but the exterior — including the small square out front — is a common stop on Casco Viejo walking tours. Photography from the street is generally fine; expect a security presence.",
    tags: ["landmark", "government", "free"],
  },
  {
    ...base,
    name: "Mercado de Mariscos",
    slug: "mercado-de-mariscos",
    featured_photo: "https://images.unsplash.com/photo-1713804708016-e1f61ea2c0ca?q=80&w=1200&auto=format&fit=crop",
    category: "attraction",
    latitude: 8.9559,
    longitude: -79.5370,
    address: "Avenida Balboa, near Casco Viejo",
    description:
      "Bustling seafood market at the edge of Casco Viejo, famous for its ceviche stands upstairs and the day's catch downstairs.",
    article:
      "A short walk from the old town, this working fish market draws both locals restocking their kitchens and visitors after cheap, fresh ceviche at the upstairs food stalls. Mornings are liveliest; cash is safest for the stalls.",
    tags: ["market", "seafood", "ceviche", "local-favorite"],
    is_featured: true,
  },

  // ─── Museums ──────────────────────────────────────────────────
  {
    ...base,
    name: "Museo del Canal Interoceánico",
    slug: "museo-del-canal-interoceanico",
    featured_photo: "https://images.unsplash.com/photo-1696694139314-e0e5962b8dc0?q=80&w=1200&auto=format&fit=crop",
    category: "museum",
    latitude: 8.9529,
    longitude: -79.5348,
    address: "Plaza de la Independencia, Casco Viejo",
    description:
      "The definitive museum on the Panama Canal's French and American construction eras, housed in a former hotel on Plaza de la Independencia.",
    article:
      "Exhibits cover the canal's full story — the disastrous French attempt, the US construction era, and the 1999 handover to Panama — largely in Spanish with English audio guides available. Closed Mondays.",
    tags: ["museum", "canal", "history"],
    is_featured: true,
  },
  {
    ...base,
    name: "Museo de la Mola (MUMO)",
    slug: "museo-de-la-mola",
    featured_photo: "https://images.unsplash.com/photo-1649452843752-663493034117?q=80&w=1200&auto=format&fit=crop",
    category: "museum",
    latitude: 8.9524,
    longitude: -79.5354,
    address: "Casco Viejo",
    description:
      "Small museum dedicated to the mola, the hand-stitched textile art of the Guna people, with rotating exhibits of historic and contemporary pieces.",
    article:
      "MUMO traces the mola from everyday Guna dress to contemporary art object, with a modest but well-curated collection. A good, quick stop for anyone shopping for real molas elsewhere in Casco Viejo.",
    tags: ["museum", "textiles", "indigenous-art", "culture"],
  },
  {
    ...base,
    name: "Museo de Historia de Panamá",
    slug: "museo-de-historia-de-panama",
    featured_photo: "https://images.unsplash.com/photo-1605032421240-3899c6248be3?q=80&w=1200&auto=format&fit=crop",
    category: "museum",
    latitude: 8.9530,
    longitude: -79.5351,
    address: "Plaza de la Independencia, Casco Viejo",
    description:
      "Compact museum inside the old Palacio Municipal tracing Panama's history from conquest through independence and the canal.",
    article:
      "Housed on the upper floor of the historic municipal palace on the main plaza, this small museum gives useful context — in Spanish — before exploring the rest of Casco Viejo's monuments.",
    tags: ["museum", "history"],
  },

  // ─── Restaurants ──────────────────────────────────────────────
  {
    ...base,
    name: "Santa Rita",
    slug: "santa-rita",
    featured_photo: "https://images.unsplash.com/photo-1656423521731-9665583f100c?q=80&w=1200&auto=format&fit=crop",
    category: "restaurant",
    latitude: 8.9539,
    longitude: -79.5358,
    address: "Casco Viejo",
    description:
      "Elegant Spanish restaurant consistently ranked among Panama City's best, known for its tasting menus and extensive wine list.",
    article:
      "Santa Rita brings refined Spanish cooking to an intimate colonial dining room, with a wine list deep enough to match. Reservations are recommended, especially on weekends.",
    price_range: "$$$",
    cuisine_type: "Spanish",
    tags: ["fine-dining", "spanish", "wine"],
    is_featured: true,
  },
  {
    ...base,
    name: "Donde José",
    slug: "donde-jose",
    featured_photo: "https://images.unsplash.com/photo-1572715376701-98568319fd0b?q=80&w=1200&auto=format&fit=crop",
    category: "restaurant",
    latitude: 8.9526,
    longitude: -79.5364,
    address: "Casco Viejo",
    description:
      "Sixteen-seat tasting-menu restaurant built around Panama's biodiversity and native ingredients; reservations essential.",
    article:
      "Chef José Olmedo Carles runs one of the hardest tables to book in Panama City — a single nightly tasting menu that reworks native ingredients with technique honed at some of the world's top kitchens. Book well ahead.",
    price_range: "$$$$",
    cuisine_type: "Panamanian tasting menu",
    reservation_required: true,
    tags: ["tasting-menu", "fine-dining", "panamanian"],
    is_featured: true,
  },
  {
    ...base,
    name: "Fonda Lo Que Hay",
    slug: "fonda-lo-que-hay",
    featured_photo: "https://images.unsplash.com/photo-1584208632869-05fa2b2a5934?q=80&w=1200&auto=format&fit=crop",
    category: "restaurant",
    latitude: 8.9515,
    longitude: -79.5357,
    address: "Casco Viejo",
    description:
      "Casual, design-forward spot reinventing Panamanian comfort food, regularly listed among Latin America's best restaurants.",
    article:
      "\"Lo que hay\" — whatever there is — sums up the kitchen's ingredient-led approach to classic Panamanian dishes, served in a bright, plant-filled dining room that feels more relaxed than its acclaim suggests.",
    price_range: "$$",
    cuisine_type: "Panamanian",
    tags: ["panamanian", "casual", "acclaimed"],
  },
  {
    ...base,
    name: "Manolo Caracol",
    slug: "manolo-caracol",
    featured_photo: "https://images.unsplash.com/photo-1782174177266-0cbab3611789?q=80&w=1200&auto=format&fit=crop",
    category: "restaurant",
    latitude: 8.9509,
    longitude: -79.5344,
    address: "Casco Viejo",
    description:
      "Long-running fixed-menu restaurant serving whatever is freshest that day, one of Casco Viejo's original culinary landmarks.",
    article:
      "One of the neighborhood's pioneering restaurants, Manolo Caracol serves a single multi-course set menu built around the market's best produce and seafood that day — no à la carte, no surprises about what to order.",
    price_range: "$$$",
    cuisine_type: "Panamanian, Spanish-influenced",
    tags: ["set-menu", "seafood", "veteran"],
  },

  // ─── Bars ───────────────────────────────────────────────────
  {
    ...base,
    name: "Tántalo Rooftop Bar",
    slug: "tantalo-rooftop-bar",
    featured_photo: "https://images.unsplash.com/photo-1692261920240-a3c88f29e25f?q=80&w=1200&auto=format&fit=crop",
    category: "bar",
    latitude: 8.9542,
    longitude: -79.5362,
    address: "Calle 8 Este, Casco Viejo",
    description:
      "Rooftop bar atop the Tántalo hotel with panoramic views over Casco Viejo's rooftops and the bay, a longtime sunset spot.",
    article:
      "One of the original Casco Viejo rooftops, Tántalo remains a reliable choice for sunset drinks and skyline views, with a DJ or live act most weekends.",
    price_range: "$$",
    parking: "street",
    tags: ["rooftop", "sunset", "views", "nightlife"],
    is_featured: true,
  },
  {
    ...base,
    name: "Pedro Mandinga Rum Bar",
    slug: "pedro-mandinga-rum-bar",
    featured_photo: "https://images.unsplash.com/photo-1598994392980-53a7fb033bcc?q=80&w=1200&auto=format&fit=crop",
    category: "bar",
    latitude: 8.9536,
    longitude: -79.5359,
    address: "Casco Viejo",
    description:
      "Lively rum bar pouring Panamanian-made Pedro Mandinga rums in tropical cocktails, with live music some nights.",
    article:
      "A tropical, tightly-packed bar built around the house Pedro Mandinga rum line, with a menu of rum-forward cocktails and regular live salsa and Latin music.",
    price_range: "$$",
    parking: "street",
    tags: ["rum", "cocktails", "live-music", "nightlife"],
  },
  {
    ...base,
    name: "Labarbara",
    slug: "labarbara",
    featured_photo: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?q=80&w=1200&auto=format&fit=crop",
    category: "bar",
    latitude: 8.9519,
    longitude: -79.5356,
    address: "Casco Viejo",
    description:
      "Cocktail bar known for creative drinks and a laid-back, art-filled interior, a favorite among Casco Viejo's nightlife spots.",
    article:
      "Labarbara draws a mixed local-and-visitor crowd for well-made cocktails in a relaxed, unpretentious room — a good pick when the rooftop bars are too crowded.",
    price_range: "$$",
    parking: "street",
    tags: ["cocktails", "nightlife"],
  },
  {
    ...base,
    name: "La Rana Dorada Casco Viejo",
    slug: "la-rana-dorada-casco-viejo",
    featured_photo: "https://images.unsplash.com/photo-1784571080367-d214f71ec0f7?q=80&w=1200&auto=format&fit=crop",
    category: "bar",
    latitude: 8.9527,
    longitude: -79.5361,
    address: "Casco Viejo",
    description:
      "Outpost of Panama's own craft brewery, pouring house-made beers on a corner terrace popular with locals and visitors alike.",
    article:
      "La Rana Dorada was one of Panama's first craft breweries, and its Casco Viejo terrace is a dependable spot for a flight of house beers and pub food between sightseeing stops.",
    price_range: "$$",
    parking: "street",
    tags: ["craft-beer", "brewery", "casual"],
  },

  // ─── Cafés ───────────────────────────────────────────────────
  {
    ...base,
    name: "Café Unido",
    slug: "cafe-unido",
    featured_photo: "https://images.unsplash.com/photo-1621275471769-e6aa344546d5?q=80&w=1200&auto=format&fit=crop",
    category: "cafe",
    latitude: 8.9533,
    longitude: -79.5355,
    address: "Casco Viejo",
    description:
      "Panamanian roaster's flagship café serving coffee sourced from farms across the country, including prized Boquete geisha.",
    article:
      "Café Unido roasts and sources from its own and partner farms around Panama, and the Casco Viejo location is a solid stop for a serious cup — including Boquete geisha for those chasing Panama's best-known coffee export.",
    price_range: "$$",
    cuisine_type: "Coffee",
    parking: "street",
    tags: ["coffee", "specialty-coffee", "geisha"],
  },
  {
    ...base,
    name: "Baloo Cafe",
    slug: "baloo-cafe",
    featured_photo: "https://images.unsplash.com/photo-1622758235004-51977c5863f5?q=80&w=1200&auto=format&fit=crop",
    category: "cafe",
    latitude: 8.9522,
    longitude: -79.5360,
    address: "Casco Viejo",
    description:
      "Cozy café known for its hidden rooftop, good for coffee, brunch and dessert away from the main plazas.",
    article:
      "Tucked a block off the main squares, Baloo is worth seeking out for its small rooftop terrace — a quieter alternative to the bigger rooftop bars for coffee, brunch or an afternoon dessert.",
    price_range: "$",
    cuisine_type: "Coffee, brunch",
    parking: "street",
    tags: ["coffee", "brunch", "rooftop"],
  },
  {
    ...base,
    name: "Granclement",
    slug: "granclement",
    featured_photo: "https://images.unsplash.com/photo-1657220644506-77fa47a3487b?q=80&w=1200&auto=format&fit=crop",
    category: "cafe",
    latitude: 8.9529,
    longitude: -79.5352,
    address: "Casco Viejo",
    description:
      "French-style artisanal ice cream and sorbet shop, a popular stop while wandering Casco Viejo's streets.",
    article:
      "This small ice cream and sorbet counter turns out French-style scoops in tropical-fruit flavors, a reliable break from the heat between sights.",
    price_range: "$",
    cuisine_type: "Ice cream",
    parking: "street",
    tags: ["ice-cream", "dessert", "casual"],
  },

  // ─── Hotels ───────────────────────────────────────────────────
  {
    ...base,
    name: "American Trade Hotel",
    slug: "american-trade-hotel",
    featured_photo: "https://images.unsplash.com/photo-1763215733028-02803292649c?q=80&w=1200&auto=format&fit=crop",
    category: "hotel",
    latitude: 8.9548,
    longitude: -79.5364,
    address: "Plaza Herrera, Casco Viejo",
    description:
      "Restored 1917 building turned boutique hotel on Plaza Herrera, part of the Ace Hotel family, with a jazz club and rooftop pool.",
    article:
      "One of the most recognizable names in Casco Viejo hospitality, the American Trade Hotel occupies a restored early-20th-century building on Plaza Herrera and includes the Danilo's Jazz Club and a rooftop pool.",
    price_range: "$$$$",
    tags: ["boutique-hotel", "jazz", "rooftop-pool"],
    is_featured: true,
  },
  {
    ...base,
    name: "Hotel Amarla",
    slug: "hotel-amarla",
    featured_photo: "https://images.unsplash.com/photo-1550504969-937eb02c18b3?q=80&w=1200&auto=format&fit=crop",
    category: "hotel",
    latitude: 8.9531,
    longitude: -79.5347,
    address: "Casco Viejo",
    website: "https://amarla.pa",
    description:
      "Colonial-luxury boutique hotel in the heart of Casco Viejo, steps from Plaza Mayor, known for its rooftop pool and design-forward rooms.",
    article:
      "Amarla blends restored colonial architecture with contemporary interiors, and its rooftop pool and bar are a draw even for non-guests looking for a scenic drink.",
    price_range: "$$$$",
    tags: ["boutique-hotel", "luxury", "rooftop-pool"],
  },
  {
    ...base,
    name: "La Compañía Boutique Hotel",
    slug: "la-compania-boutique-hotel",
    featured_photo: "https://images.unsplash.com/photo-1637730826933-54287f79e1c3?q=80&w=1200&auto=format&fit=crop",
    category: "hotel",
    latitude: 8.9525,
    longitude: -79.5350,
    address: "Casco Viejo",
    description:
      "Restored historic property (Hyatt's Unbound Collection) blending colonial architecture with contemporary design, with an on-site restaurant.",
    article:
      "Part of Hyatt's Unbound Collection, La Compañía occupies a carefully restored historic building near the main plazas, with a well-regarded in-house restaurant and bar.",
    price_range: "$$$",
    tags: ["boutique-hotel", "historic-building"],
  },

  // ─── Gallery & shop ────────────────────────────────────────────
  {
    ...base,
    name: "Diablo Rosso",
    slug: "diablo-rosso",
    featured_photo: "https://images.unsplash.com/photo-1565799515768-2dcfd834625c?q=80&w=1200&auto=format&fit=crop",
    category: "gallery",
    latitude: 8.9530,
    longitude: -79.5353,
    address: "Avenida A, Casco Viejo",
    description:
      "Independent contemporary art gallery and creative space that helped anchor Casco Viejo's arts scene, showing local and regional artists.",
    article:
      "Diablo Rosso has been one of the key independent spaces backing contemporary Panamanian and regional artists, with rotating exhibitions and an attached bar/restaurant that doubles as a social hub.",
    accepts_cards: false,
    parking: "street",
    tags: ["contemporary-art", "gallery", "local-artists"],
  },
  {
    ...base,
    name: "Karavan",
    slug: "karavan",
    featured_photo: "https://images.unsplash.com/photo-1572307480813-ceb0e59d8325?q=80&w=1200&auto=format&fit=crop",
    category: "shop",
    latitude: 8.9528,
    longitude: -79.5354,
    address: "Avenida A, Casco Viejo",
    description:
      "Boutique on Avenida A selling Panama hats, molas and curated local design and crafts.",
    article:
      "A well-curated stop for souvenirs that aren't mass-produced — genuine Panama hats (sombreros pintados), Guna molas and pieces from local designers, priced accordingly.",
    price_range: "$$",
    parking: "street",
    tags: ["souvenirs", "panama-hats", "crafts", "local-design"],
  },
];

console.log(`Seeding ${spots.length} Casco Viejo spots…`);

const res = await fetch(`${SUPABASE_URL}/rest/v1/spots?on_conflict=slug`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(spots),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Seed failed (${res.status}):`, text);
  process.exit(1);
}

const data = await res.json();
console.log(`✔ Upserted ${data.length} spots:`);
for (const row of data) {
  console.log(`  - [${row.category}] ${row.name} (${row.slug})`);
}
