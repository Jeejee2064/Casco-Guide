// One-off migration: retroactively downscales/re-encodes every photo already
// sitting in the `spot-photos` Supabase Storage bucket — see
// PhotoUploader.tsx's compressImage() for why (uploads made before that fix
// went in went through as-is, some at full phone-camera resolution, several
// MB each). That fix only covers photos uploaded from now on; this is the
// backfill for everything already there.
//
// Each object is re-encoded and overwritten *in place, at the same storage
// path* — nothing that references it (spot.featured_photo, spot.photos[].url,
// inline article images inserted via ArticleBodyEditor/ArticleBlocksEditor)
// needs to change. A `.png` object may end up holding JPEG-encoded bytes
// after this — harmless, since both browsers and Next's image optimizer go
// by the Content-Type header this script sets on upload, not the URL's
// extension.
//
// Dry-run by default — lists what would change and the expected savings
// without touching storage. Pass --apply to actually overwrite objects; this
// permanently discards each original's bytes (no versioning on this bucket),
// so run without it first and read the report before committing.
//
// Run with:
//
//   node scripts/compress-spot-photos.mjs            # dry run — reports only
//   node scripts/compress-spot-photos.mjs --apply    # actually rewrites objects
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from
// .env.local — loaded manually below since this script runs outside Next).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUCKET = "spot-photos";
// Same numbers as PhotoUploader.tsx's compressImage() — this script is that
// function's server-side equivalent, just run once over what's already
// stored instead of at upload time.
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 82;
// Skipped outright — vector art has no pixel dimensions to downscale, and
// re-encoding an animated GIF as a static JPEG would silently keep only its
// first frame.
const SKIP_EXTENSIONS = new Set(["svg", "gif"]);
// Objects at or under this size are assumed already reasonably optimized
// (e.g. anything uploaded since the client-side fix went in) — skipped
// after download to avoid a pointless second JPEG re-encode.
const SKIP_UNDER_BYTES = 400 * 1024;

const apply = process.argv.includes("--apply");

async function listAllObjects() {
  const all = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    // Folder placeholder entries (shouldn't occur in this flat bucket, but
    // just in case) carry no `id` — skip them rather than trying to download one.
    all.push(...data.filter((entry) => entry.id));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

const formatKb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

async function main() {
  console.log(
    apply
      ? "Running in APPLY mode — matching objects will be overwritten in place.\n"
      : "Dry run — no changes will be made (pass --apply to actually rewrite objects).\n",
  );

  const objects = await listAllObjects();
  console.log(`Found ${objects.length} object(s) in "${BUCKET}".\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalBefore = 0;
  let totalAfter = 0;

  for (const obj of objects) {
    const ext = obj.name.split(".").pop()?.toLowerCase() ?? "";
    if (SKIP_EXTENSIONS.has(ext)) {
      skipped++;
      continue;
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(obj.name);
    if (downloadError) {
      console.error(`  ✗ ${obj.name}: download failed — ${downloadError.message}`);
      failed++;
      continue;
    }

    const inputBuffer = Buffer.from(await blob.arrayBuffer());
    if (inputBuffer.length <= SKIP_UNDER_BYTES) {
      skipped++;
      continue;
    }

    let outputBuffer;
    try {
      outputBuffer = await sharp(inputBuffer)
        .rotate() // bakes in the EXIF orientation flag, then strips it
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    } catch (err) {
      console.error(`  ✗ ${obj.name}: couldn't decode/re-encode — ${err.message}`);
      failed++;
      continue;
    }

    if (outputBuffer.length >= inputBuffer.length) {
      skipped++;
      continue;
    }

    totalBefore += inputBuffer.length;
    totalAfter += outputBuffer.length;
    processed++;

    const savings = (100 * (1 - outputBuffer.length / inputBuffer.length)).toFixed(0);
    console.log(
      `  ${apply ? "✓" : "→"} ${obj.name}: ${formatKb(inputBuffer.length)} → ${formatKb(outputBuffer.length)} (-${savings}%)`,
    );

    if (apply) {
      const { error: updateError } = await supabase.storage.from(BUCKET).update(obj.name, outputBuffer, {
        contentType: "image/jpeg",
        cacheControl: "3600",
      });
      if (updateError) {
        console.error(`    ✗ overwrite failed — ${updateError.message}`);
        failed++;
      }
    }
  }

  console.log(
    `\n${processed} object(s) ${apply ? "compressed" : "would be compressed"}, ${skipped} skipped, ${failed} failed.`,
  );
  if (processed > 0) {
    console.log(
      `Total: ${formatKb(totalBefore)} → ${formatKb(totalAfter)} (${formatKb(totalBefore - totalAfter)} saved).`,
    );
  }
  if (!apply && processed > 0) {
    console.log("\nRe-run with --apply to actually rewrite these objects in Supabase Storage.");
  }
}

main();
