-- The `spots` table has always been writable by `service_role` (used by
-- scripts/seed-casco-viejo.mjs and any server-side admin action running
-- with the service key), but `events` and `categories` never got the
-- equivalent grant — service_role currently gets a bare
-- "permission denied for table events" from PostgREST for any
-- select/insert/update/delete, even though RLS would otherwise allow it.
--
-- Bring events/categories in line with spots so service-role scripts
-- (e.g. a seed-event-photos.mjs) can read and write them too.
grant select, insert, update, delete on events, categories to service_role;
