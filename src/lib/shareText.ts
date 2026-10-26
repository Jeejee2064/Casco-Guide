/** First sentence of `text`, if it fits in `max` chars — otherwise null. */
export function firstSentence(text: string | null | undefined, max = 110): string | null {
  const clean = text?.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const sentence = clean.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? clean;
  return sentence.length <= max ? sentence : null;
}

/** Body of a share message: pin + name, then a one-line hook — the spot's
 * own first sentence when it's short enough, else a generic localized line
 * (`fallback`). The link is appended by ShareMenu on its own line. */
export function buildShareText({
  name,
  description,
  fallback,
}: {
  name: string;
  description?: string | null;
  fallback: string;
}): string {
  return `*${name}*\n${firstSentence(description, 110) ?? fallback}`;
}
