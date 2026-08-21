"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/spots";
import { SPOT_CATEGORIES } from "@/lib/categories";
import type { SpotCategory } from "@/lib/types/database";

// Screenshot(s) → structured data for the spot form's "Import from Google
// Maps screenshot" tool (see components/admin/ImportFromScreenshot.tsx). A
// single Google Maps place card rarely fits one screenshot — name+rating,
// address+hours, and the right-click coordinates are usually three separate
// captures — so this takes 1-5 images of the *same place* in one request and
// asks Claude to combine what each one shows. Runs them through Claude's
// vision API with a strict extraction prompt, then validates the response
// before it ever reaches the form — the model output is untrusted input, not
// a trusted server payload.

const hourSlotSchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

// One key per DAY_KEYS entry, spelled out (rather than built from the array)
// so the zod shape stays a plain object literal — easiest to read back
// against lib/types/database.ts's DayHours.
const hoursSchema = z
  .object({
    monday: z.array(hourSlotSchema).nullable().optional(),
    tuesday: z.array(hourSlotSchema).nullable().optional(),
    wednesday: z.array(hourSlotSchema).nullable().optional(),
    thursday: z.array(hourSlotSchema).nullable().optional(),
    friday: z.array(hourSlotSchema).nullable().optional(),
    saturday: z.array(hourSlotSchema).nullable().optional(),
    sunday: z.array(hourSlotSchema).nullable().optional(),
  })
  .nullable();

const extractionSchema = z.object({
  name: z.string().trim().min(1).nullable().default(null),
  category: z
    .enum(SPOT_CATEGORIES as [SpotCategory, ...SpotCategory[]])
    .nullable()
    .default(null),
  address: z.string().trim().min(1).nullable().default(null),
  neighborhood: z.string().trim().min(1).nullable().default(null),
  phone: z.string().trim().min(1).nullable().default(null),
  website: z.string().trim().min(1).nullable().default(null),
  price_range: z.enum(["$", "$$", "$$$", "$$$$"]).nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  cuisine_type: z.string().trim().min(1).nullable().default(null),
  hours: hoursSchema.default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
});

export type ExtractedSpot = z.infer<typeof extractionSchema>;

export type ExtractSpotError =
  | "unauthorized"
  | "missing_api_key"
  | "no_image"
  | "too_many_images"
  | "image_too_large"
  | "unsupported_type"
  | "network"
  | "api"
  | "empty_response"
  | "parse_failed"
  | "invalid_shape";

export interface ExtractSpotResult {
  data: ExtractedSpot | null;
  error: ExtractSpotError | null;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const EXTRACTION_PROMPT = `You are reading 1-5 screenshots of Google Maps, all of the same place (most likely a business in Panama City). A single place card rarely fits one screenshot, so different images may show different panels — e.g. one with the name/category/rating, another with the address/hours, another with the right-click coordinates. Combine what every image shows into ONE set of facts about this one place, and reply with ONLY a single raw JSON object — no prose, no markdown code fences — matching exactly this shape:

{
  "name": string | null,
  "category": one of "restaurant" | "bar" | "cafe" | "attraction" | "museum" | "shop" | "gallery" | "hotel" | null,
  "address": string | null,
  "neighborhood": string | null,
  "phone": string | null,
  "website": string | null,
  "price_range": one of "$" | "$$" | "$$$" | "$$$$" | null,
  "rating": number between 0 and 5 | null,
  "cuisine_type": string | null,
  "hours": {
    "monday": [{"open":"HH:MM","close":"HH:MM"}] or null,
    "tuesday": ..., "wednesday": ..., "thursday": ..., "friday": ..., "saturday": ..., "sunday": ...
  } | null,
  "latitude": number | null,
  "longitude": number | null
}

Rules:
- "category" is your best mapping of Google's place type onto that exact list — always pick the closest one, never invent a new value.
- "cuisine_type" only applies to restaurants/bars/cafes (e.g. "Italiana", "Mariscos") — a short label, in whatever language the screenshot is in.
- "hours": only include a day key if that day's opening hours are explicitly visible (e.g. an expanded weekly-hours panel). Times are 24-hour "HH:MM". A day visibly marked closed maps to null for that key. Omit any day you can't read. If no hours at all are visible, "hours" itself is null.
- "latitude"/"longitude": only fill these in if explicit decimal coordinates are printed somewhere in the screenshot — e.g. the pair Google Maps shows after right-clicking a point ("What's here?"), or in a visible URL/share link containing "@8.952781,-79.534071" or "q=8.952781,-79.534071". Read the two numbers exactly as printed (first is latitude, second longitude). Never infer coordinates from the pin's pixel position, the address, or the neighborhood — if no explicit decimal pair is visible, both are null.
- If two screenshots disagree on a field, trust the one where it's shown more explicitly/completely rather than averaging or picking arbitrarily.
- Any field you can't read with confidence from any of the images: use null rather than guessing.
- Reply with the raw JSON object only, nothing before or after it.`;

export async function extractSpotFromScreenshot(formData: FormData): Promise<ExtractSpotResult> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "unauthorized" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { data: null, error: "missing_api_key" };

  const files = formData.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { data: null, error: "no_image" };
  if (files.length > MAX_IMAGES) return { data: null, error: "too_many_images" };
  if (files.some((f) => f.size > MAX_FILE_BYTES)) return { data: null, error: "image_too_large" };

  const mediaTypes = files.map((f) => f.type || "image/png");
  if (mediaTypes.some((type) => !SUPPORTED_TYPES.includes(type))) {
    return { data: null, error: "unsupported_type" };
  }

  const imageBlocks = await Promise.all(
    files.map(async (file, i) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: mediaTypes[i],
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
      },
    })),
  );

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [...imageBlocks, { type: "text", text: EXTRACTION_PROMPT }],
          },
        ],
      }),
    });
  } catch {
    return { data: null, error: "network" };
  }

  if (!res.ok) return { data: null, error: "api" };

  const body = await res.json();
  const text: unknown = body?.content?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) return { data: null, error: "empty_response" };

  // Strip an accidental ```json fence — the prompt says not to, models add one anyway sometimes.
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { data: null, error: "parse_failed" };
  }

  const result = extractionSchema.safeParse(parsed);
  if (!result.success) return { data: null, error: "invalid_shape" };

  return { data: result.data, error: null };
}
