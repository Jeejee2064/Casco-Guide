"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/spots";
import { SPOT_CATEGORIES } from "@/lib/categories";
import type { SpotCategory } from "@/lib/types/database";

// Screenshot(s) → structured data for the spot form's "Import from Google
// Maps screenshot" tool (see components/admin/ImportFromScreenshot.tsx). A
// single Google Maps place card rarely fits one screenshot — name+category,
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
const MAX_ATTEMPTS = 2;
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface ImageBlock {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
}

const EXTRACTION_PROMPT = `You are reading 1-5 screenshots of Google Maps, all of the same place (most likely a business in Panama City). A single place card rarely fits one screenshot, so different images may show different panels — e.g. one with the name/category, another with the address/hours, another with the right-click coordinates. Combine what every image shows into ONE set of facts about this one place, and reply with ONLY a single raw JSON object — no prose, no markdown code fences — matching exactly this shape:

{
  "name": string | null,
  "category": one of "restaurant" | "bar" | "cafe" | "attraction" | "museum" | "shop" | "gallery" | "hotel" | null,
  "address": string | null,
  "neighborhood": string | null,
  "phone": string | null,
  "website": string | null,
  "price_range": one of "$" | "$$" | "$$$" | "$$$$" | null,
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
- "phone"/"website": look for the row of small icon buttons under the place's name (phone handset icon, globe/website icon, directions icon) and any "About"/"Overview" panel — read the digits or domain next to them exactly as printed. Keep the phone number's punctuation/formatting as shown. Include the website's scheme if printed (e.g. "https://..."), otherwise just the domain/path as printed.
- "hours": only include a day key if that day's opening hours are explicitly visible (e.g. an expanded weekly-hours panel). Times are 24-hour "HH:MM". A day visibly marked closed maps to null for that key. Omit any day you can't read. If no hours at all are visible, "hours" itself is null.
- "latitude"/"longitude": only fill these in if explicit decimal coordinates are printed somewhere in the screenshot — e.g. the pair Google Maps shows after right-clicking a point ("What's here?"), or in a visible URL/share link containing "@8.952781,-79.534071" or "q=8.952781,-79.534071". Read the two numbers exactly as printed (first is latitude, second longitude). Never infer coordinates from the pin's pixel position, the address, or the neighborhood — if no explicit decimal pair is visible, both are null.
- If two screenshots disagree on a field, trust the one where it's shown more explicitly/completely rather than averaging or picking arbitrarily.
- Any field you can't read with confidence from any of the images: use null rather than guessing.
- Reply with the raw JSON object only, nothing before or after it.`;

/** Parses the model's reply into an object, tolerating the odd stray
 * sentence or ```json fence around the JSON despite the prompt saying not
 * to — falls back to the first `{...}` span before giving up. Returns null
 * rather than throwing so callers can treat it as just another failure mode
 * to retry. */
function extractJsonObject(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

interface AttemptOutcome {
  result: ExtractSpotResult;
  /** Worth a second try — a transient network/rate-limit hiccup or the
   * model just not following the JSON-only instruction that one time, both
   * of which are common enough with vision extraction to not surface to the
   * admin as a hard failure on the first miss. */
  retryable: boolean;
}

async function attemptExtraction(apiKey: string, imageBlocks: ImageBlock[]): Promise<AttemptOutcome> {
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
        // Explicitly off: this is a one-shot structured extraction, not a
        // reasoning task, and Sonnet 5 runs adaptive thinking by default —
        // left on, content[0] is a "thinking" block instead of the JSON
        // reply, which used to slip past the block-shape check below.
        thinking: { type: "disabled" },
        messages: [
          {
            role: "user",
            content: [...imageBlocks, { type: "text", text: EXTRACTION_PROMPT }],
          },
        ],
      }),
    });
  } catch {
    return { result: { data: null, error: "network" }, retryable: true };
  }

  if (!res.ok) {
    console.error("extractSpotFromScreenshot: Anthropic API error", res.status, await res.text());
    // 429 (rate limited) and 5xx (transient) are worth a second try; other
    // 4xx (bad key, malformed request) will just fail identically again.
    return { result: { data: null, error: "api" }, retryable: res.status === 429 || res.status >= 500 };
  }

  const body = await res.json();
  // `content` is a discriminated-union array (thinking/text/…), not
  // guaranteed to have the reply at index 0 — find the text block instead
  // of assuming shape.
  const textBlock = Array.isArray(body?.content)
    ? body.content.find(
        (block: unknown): block is { type: "text"; text: string } =>
          typeof block === "object" && block !== null && (block as { type?: unknown }).type === "text",
      )
    : undefined;
  const text = textBlock?.text;
  if (typeof text !== "string" || !text.trim()) {
    console.error("extractSpotFromScreenshot: no text block in response", JSON.stringify(body));
    return { result: { data: null, error: "empty_response" }, retryable: true };
  }

  const parsed = extractJsonObject(text);
  if (parsed === null) {
    console.error("extractSpotFromScreenshot: could not parse JSON from model output:", text);
    return { result: { data: null, error: "parse_failed" }, retryable: true };
  }

  const validated = extractionSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(
      "extractSpotFromScreenshot: response failed schema validation",
      validated.error.issues,
      parsed,
    );
    return { result: { data: null, error: "invalid_shape" }, retryable: true };
  }

  return { result: { data: validated.data, error: null }, retryable: false };
}

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

  const imageBlocks: ImageBlock[] = await Promise.all(
    files.map(async (file, i) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: mediaTypes[i],
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
      },
    })),
  );

  // Vision extraction is flaky enough (transient 429/5xx, or the model
  // occasionally not following the JSON-only instruction) that the same
  // screenshot can succeed on one click and fail on the next — worth one
  // automatic retry before making the admin re-click themselves.
  let outcome: AttemptOutcome = { result: { data: null, error: "network" }, retryable: true };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    outcome = await attemptExtraction(apiKey, imageBlocks);
    if (!outcome.retryable) break;
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 400));
  }
  return outcome.result;
}
