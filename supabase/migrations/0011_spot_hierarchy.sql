-- ─── Spot hierarchy (parent hubs with multiple businesses inside) ──────
--
-- Some real-world locations (a boutique hotel with its own restaurant and
-- bar, a food hall with several stalls, ...) are really several distinct
-- businesses sharing one physical address. Each business stays a normal,
-- full `spots` row (own category, hours, photos, slug, detail page) — this
-- just adds an optional self-reference so a "child" business can point back
-- at the "parent" hub location it lives inside.
--
-- Capped at two levels (parent → children, no grandchildren) — enforced in
-- the app/admin layer, not here: at Casco Viejo's scale a recursive SQL
-- constraint would be overkill for what a picker filter already prevents.

alter table spots
  add column if not exists parent_id uuid references spots(id) on delete set null;

create index if not exists idx_spots_parent_id on spots (parent_id)
  where parent_id is not null;
