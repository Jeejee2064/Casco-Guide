import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Tag on every cached public read — mutations (admin saves) expire it so
 * edits show up immediately; see lib/actions. */
export const CONTENT_TAG = "content";

/**
 * Cookie-free anon client for public content (spots, published articles —
 * both already world-readable via RLS). Unlike `server.ts`'s client it never
 * touches `cookies()`, so pages using it can be prerendered and served from
 * the cache instead of hitting Supabase on every visit, and its fetches are
 * cached for an hour (or until a save expires CONTENT_TAG).
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, next: { revalidate: 3600, tags: [CONTENT_TAG] } }),
      },
    },
  );
}
