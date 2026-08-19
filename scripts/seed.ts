/**
 * Seed script — ingests real Casco Viejo data into Supabase.
 *
 * Usage:
 *   npm run seed -- data/casco-data.json
 *
 * Expects the JSON shape documented in README.md ("Data import format",
 * Option A): { "spots": [...], "events": [...] }
 *
 * For each spot/event:
 *   - Geocodes the address via Mapbox if latitude/longitude are missing
 *     (requires NEXT_PUBLIC_MAPBOX_TOKEN in .env.local)
 *   - Warns if coordinates fall outside the Casco Viejo bounding box
 *   - Upserts by slug (safe to re-run)
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Generous bounding box around Casco Viejo, Panama City.
const CASCO_BOUNDS = { latMin: 8.945, latMax: 8.972, lngMin: -79.548, lngMax: -79.518 };

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface RawSpot {
  slug: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  [key: string]: unknown;
}
interface RawEvent {
  slug: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  [key: string]: unknown;
}

async function geocode(address: string): Promise<[number, number] | null> {
  if (!MAPBOX_TOKEN) return null;
  const query = encodeURIComponent(`${address}, Casco Viejo, Panama`);
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1`,
  );
  const data = await res.json();
  const center = data.features?.[0]?.center;
  return center ? [center[1], center[0]] : null; // [lat, lng]
}

function checkBounds(name: string, lat: number, lng: number) {
  const { latMin, latMax, lngMin, lngMax } = CASCO_BOUNDS;
  if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
    console.warn(`  ⚠️  "${name}" coords (${lat}, ${lng}) look outside Casco Viejo — double check.`);
  }
}

async function seedSpots(spots: RawSpot[]) {
  let ok = 0;
  for (const spot of spots) {
    if (!spot.latitude || !spot.longitude) {
      if (spot.address) {
        const geo = await geocode(spot.address);
        if (geo) {
          [spot.latitude, spot.longitude] = geo;
          console.log(`  📍 Geocoded "${spot.name}" → ${geo[0]}, ${geo[1]}`);
        } else {
          console.warn(`  ⚠️  Could not geocode "${spot.name}" (${spot.address}), skipping.`);
          continue;
        }
      } else {
        console.warn(`  ⚠️  "${spot.name}" has no coords or address, skipping.`);
        continue;
      }
    }
    checkBounds(String(spot.name), spot.latitude!, spot.longitude!);

    const { error } = await supabase.from("spots").upsert(spot, { onConflict: "slug" });
    if (error) {
      console.error(`  ❌ ${spot.slug}: ${error.message}`);
    } else {
      ok++;
    }
  }
  return ok;
}

async function seedEvents(events: RawEvent[]) {
  let ok = 0;
  for (const event of events) {
    if (!event.latitude || !event.longitude) {
      if (event.address) {
        const geo = await geocode(event.address);
        if (geo) [event.latitude, event.longitude] = geo;
      }
    }
    if (event.latitude && event.longitude) {
      checkBounds(String(event.title), event.latitude, event.longitude);
    }

    const { error } = await supabase.from("events").upsert(event, { onConflict: "slug" });
    if (error) {
      console.error(`  ❌ ${event.slug}: ${error.message}`);
    } else {
      ok++;
    }
  }
  return ok;
}

async function main() {
  const file = process.argv[2] ?? "data/casco-data.json";
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf-8"));

  console.log(`\n🌴 Seeding from ${file}\n`);

  const spotsOk = raw.spots ? await seedSpots(raw.spots) : 0;
  const eventsOk = raw.events ? await seedEvents(raw.events) : 0;

  console.log(`\n✅ Seeded ${spotsOk} spots, ${eventsOk} events.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
