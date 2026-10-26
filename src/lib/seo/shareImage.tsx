import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

// WhatsApp silently drops link previews above ~300 KB. Aim well under that
// and step the JPEG quality down until the file fits.
const TARGET_BYTES = 250 * 1024;
const QUALITIES = [78, 72, 66, 60, 54, 48, 42];
const BRAND_TEAL = "#1fa6da";
const CHIP_FALLBACK = BRAND_TEAL;

// Read once at module scope — none of these depend on request data.
const publicFile = (...parts: string[]) => path.join(process.cwd(), "public", ...parts);
const fontFile = (name: string) => path.join(process.cwd(), "src", "assets", "fonts", name);
const fontsPromise = Promise.all([
  readFile(fontFile("Poppins-ExtraBold.woff")),
  readFile(fontFile("Poppins-SemiBold.woff")),
]);
const logoPromise = readFile(publicFile("logoletters.png")).then(
  (buf) => `data:image/png;base64,${buf.toString("base64")}`,
);

export interface ShareImageInput {
  photoUrl: string | null;
  name: string;
  /** Plain text shown before the chip (category, date/time…). */
  meta: string;
  /** Optional colored chip after `meta` (a spot's main vibe). */
  chip?: { label: string; color: string } | null;
}

/** Supabase public-bucket URLs can be served through its image transformer;
 * ask for a ~1200px version instead of the original upload. Anything else is
 * returned untouched. */
function transformedUrl(url: string): string | null {
  if (!url.includes("/storage/v1/object/public/")) return null;
  const u = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return `${u}${u.includes("?") ? "&" : "?"}width=1200&quality=75&resize=cover`;
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function fetchPhoto(url: string): Promise<Buffer | null> {
  const resized = transformedUrl(url);
  // Transformations are a paid Supabase feature — on a non-OK response (or
  // for external photos) fall back to the original; sharp downsizes it next.
  return (resized && (await fetchBuffer(resized))) || fetchBuffer(url);
}

/** Transparent overlay — gradient on the bottom 45%, logo, name, chip. Kept
 * separate from the photo so Satori never embeds a large image. Content sits
 * in the central ~70% horizontally (15% margins) because some apps crop the
 * preview toward a square. */
async function renderOverlay({ name, meta, chip }: ShareImageInput) {
  const { width, height } = SHARE_IMAGE_SIZE;
  const [[extraBold, semiBold], logo] = await Promise.all([fontsPromise, logoPromise]);
  const fontSize = name.length > 40 ? 52 : name.length > 26 ? 62 : 74;
  const sideMargin = Math.round(width * 0.15);

  const res = new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: `44px ${sideMargin}px 52px`,
          color: "white",
          fontFamily: "Poppins",
          backgroundImage:
            "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.62) 24%, rgba(0,0,0,0) 45%), linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 30%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={230} height={55} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -1,
              display: "flex",
              textShadow: "0 2px 18px rgba(0,0,0,0.5)",
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
            <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.92, display: "flex" }}>
              {meta}
            </div>
            {chip && (
              <div
                style={{
                  marginLeft: 18,
                  padding: "6px 20px",
                  borderRadius: 999,
                  background: chip.color || CHIP_FALLBACK,
                  fontSize: 24,
                  fontWeight: 600,
                  display: "flex",
                }}
              >
                {chip.label}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [
        { name: "Poppins", data: extraBold, style: "normal", weight: 800 },
        { name: "Poppins", data: semiBold, style: "normal", weight: 600 },
      ],
    },
  );
  return Buffer.from(await res.arrayBuffer());
}

/** Branded share card as a JPEG under ~250 KB: the photo cropped to
 * 1200x630 under the overlay, or a brand-teal background without one. */
export async function renderShareImage(input: ShareImageInput): Promise<Buffer> {
  const { width, height } = SHARE_IMAGE_SIZE;
  const [overlay, photo] = await Promise.all([
    renderOverlay(input),
    input.photoUrl ? fetchPhoto(input.photoUrl) : Promise.resolve(null),
  ]);

  let base: ReturnType<typeof sharp>;
  try {
    if (!photo) throw new Error("no photo");
    base = sharp(photo).rotate().resize(width, height, { fit: "cover", position: "centre" });
  } catch {
    base = sharp({ create: { width, height, channels: 3, background: BRAND_TEAL } });
  }
  // Composite once; the common case fits at the first quality, so no
  // intermediate PNG is encoded unless a retry is needed.
  const composite = base.composite([{ input: overlay }]);
  let out = await composite.clone().jpeg({ quality: QUALITIES[0], mozjpeg: true }).toBuffer();
  if (out.length > TARGET_BYTES) {
    const composed = await composite.png().toBuffer();
    for (const quality of QUALITIES.slice(1)) {
      out = await sharp(composed).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (out.length <= TARGET_BYTES) break;
    }
  }
  if (out.length > TARGET_BYTES) {
    console.warn(
      `share image for "${input.name}" is ${Math.round(out.length / 1024)} KB even at the lowest quality`,
    );
  }

  return out;
}
