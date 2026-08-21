// JSON-LD builders. Kept separate from the `<JsonLd>` component so page code
// can stay focused on "what data" rather than "how to serialize it".
import { DAY_KEYS, type DayKey, type Spot, type SpotCategory, type Article } from "@/lib/types/database";
import { SITE_NAME, SITE_URL, absoluteUrl } from "./site";

// schema.org has no single "restaurant/bar/museum/..." vocabulary entry —
// each spot category maps to the closest concrete type so rich results
// (star ratings, price range, opening hours) render correctly per category.
const CATEGORY_SCHEMA_TYPE: Record<SpotCategory, string> = {
  restaurant: "Restaurant",
  bar: "BarOrPub",
  cafe: "CafeOrCoffeeShop",
  attraction: "TouristAttraction",
  museum: "Museum",
  shop: "Store",
  gallery: "ArtGallery",
  hotel: "Hotel",
};

const DAY_SCHEMA: Record<DayKey, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

const PRICE_RANGE_SYMBOL: Record<string, string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
  $$$$: "$$$$",
};

/** Site-wide `Organization` node — referenced as `publisher` from article
 * schema so every page shares one identity instead of repeating inline. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
  };
}

/** Site-wide `WebSite` node, emitted once in the root layout. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    about: {
      "@type": "Place",
      name: "Casco Viejo, Panama City",
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

function openingHoursSpecification(spot: Spot) {
  const specs: Array<{ "@type": string; dayOfWeek: string; opens: string; closes: string }> = [];
  for (const day of DAY_KEYS) {
    const slots = spot[`hours_${day}` as const];
    if (!slots) continue;
    for (const slot of slots) {
      specs.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: DAY_SCHEMA[day],
        opens: slot.open,
        closes: slot.close,
      });
    }
  }
  return specs;
}

/** One place page's structured data — typed by category (Restaurant,
 * Museum, Hotel, …) with address, geo, hours, price and rating filled in
 * from whatever the spot record has. */
export function spotSchema(spot: Spot, url: string) {
  const images = spot.photos.map((p) => absoluteUrl(p.url));
  const image = spot.featured_photo ? absoluteUrl(spot.featured_photo) : images[0];

  return {
    "@context": "https://schema.org",
    "@type": CATEGORY_SCHEMA_TYPE[spot.category],
    "@id": `${url}#place`,
    name: spot.name,
    url,
    ...(image && { image: [image, ...images.filter((i) => i !== image)] }),
    ...(spot.description && { description: spot.description }),
    address: {
      "@type": "PostalAddress",
      streetAddress: spot.address ?? undefined,
      addressLocality: spot.neighborhood ?? "Casco Viejo",
      addressRegion: "Panamá",
      addressCountry: "PA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: spot.latitude,
      longitude: spot.longitude,
    },
    ...(spot.phone && { telephone: spot.phone }),
    // Website is stored as entered in the admin form, sometimes without a
    // scheme (e.g. "fondaloquehay.com") — `sameAs` requires a real URL.
    ...(spot.website && {
      sameAs: [/^https?:\/\//.test(spot.website) ? spot.website : `https://${spot.website}`],
    }),
    ...(spot.price_range && { priceRange: PRICE_RANGE_SYMBOL[spot.price_range] }),
    ...(spot.cuisine_type && spot.category === "restaurant" && { servesCuisine: spot.cuisine_type }),
    ...(openingHoursSpecification(spot).length > 0 && {
      openingHoursSpecification: openingHoursSpecification(spot),
    }),
    ...(spot.rating != null &&
      spot.review_count > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: spot.rating,
          reviewCount: spot.review_count,
        },
      }),
  };
}

/** One guide/story page's structured data. */
export function articleSchema(article: Article, url: string) {
  const image = article.cover_photo ? absoluteUrl(article.cover_photo) : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    ...(article.excerpt && { description: article.excerpt }),
    ...(image && { image: [image] }),
    ...(article.published_at && { datePublished: article.published_at }),
    dateModified: article.updated_at,
    ...(article.author && { author: { "@type": "Person", name: article.author } }),
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function faqSchema(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
