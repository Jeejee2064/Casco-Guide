/** Renders one JSON-LD `<script>` block. `data` should be plain,
 * JSON-serializable structured data built from our own trusted fields (never
 * raw user HTML) — the `<` escape below only guards against a stray
 * `</script>` inside a free-text field (a spot name, an excerpt, …) breaking
 * out of the script tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
