-- ═══════════════════════════════════════════════════════════════
-- Vibes — drop "Local & Authentic" in favour of "Shopping &
-- Boutiques", and make "Arts & Culture" the home of every museum,
-- gallery, monument, church and plaza.
--
--   local_heritage → shopping_boutiques  (enum value renamed)
--   chill_coffee   → arts_culture        (enum value renamed)
--
-- Renaming keeps existing tags attached; the updates below then
-- re-assign them by category. A backup of the previous (category,
-- vibes) pairs is kept in spots_vibes_backup_0012. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

create table if not exists spots_vibes_backup_0012 as
  select id, slug, category, vibes from spots;

do $$ begin
  alter type spot_vibe rename value 'local_heritage' to 'shopping_boutiques';
exception when invalid_parameter_value then null; end $$;

do $$ begin
  alter type spot_vibe rename value 'chill_coffee' to 'arts_culture';
exception when invalid_parameter_value then null; end $$;

-- The old "local" tag no longer means anything outside shops.
update spots set vibes = array_remove(vibes, 'shopping_boutiques');

-- Shops: shopping only (they used to carry arts/gastro/work too)…
update spots set vibes = '{shopping_boutiques}' where category = 'shop';
-- …except the ones that are really art outlets.
update spots set vibes = '{shopping_boutiques,arts_culture}'
  where slug in ('m-saldana-panama-art-gallery', 'manos-con-arte');

-- Museums, galleries, attractions (monuments, churches, plazas): arts & culture.
update spots set vibes = array_append(vibes, 'arts_culture')
  where category in ('museum', 'gallery', 'attraction')
    and not ('arts_culture' = any(vibes));

-- Spots left with no vibe at all.
update spots set vibes = '{gastro_trendy}' where slug = 'matcha-bar' and vibes = '{}';
update spots set vibes = '{nomad_work}' where slug = 'panaderia' and vibes = '{}';
