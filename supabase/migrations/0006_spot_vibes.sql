-- ═══════════════════════════════════════════════════════════════
-- Spot vibes — a second, cross-cutting classification axis besides
-- `category` (Rooftops & Party / Work & Coffee / Romantic & Sunset /
-- Local & Heritage / Gastro & Trendy / Chill & Cafe). Unlike
-- `category`, a spot can carry zero or more vibes, hence an array
-- column. Additive migration — `spots` has real rows, so (unlike
-- 0002_event_categories.sql's retype of an empty table) this must
-- not touch the existing `category` column.
-- ═══════════════════════════════════════════════════════════════

do $$ begin
  create type spot_vibe as enum (
    'rooftop_party', 'nomad_work', 'romantic_sunset',
    'local_heritage', 'gastro_trendy', 'chill_coffee'
  );
exception when duplicate_object then null; end $$;

alter table spots
  add column if not exists vibes spot_vibe[] not null default '{}';

create index if not exists idx_spots_vibes on spots using gin (vibes);

-- ─── Backfill real Casco Viejo spots (safe to re-run) ─────────
update spots set vibes = '{local_heritage}' where slug = 'plaza-de-la-independencia';
update spots set vibes = '{local_heritage}' where slug = 'catedral-metropolitana-de-panama';
update spots set vibes = '{local_heritage}' where slug = 'iglesia-de-san-jose';
update spots set vibes = '{local_heritage,chill_coffee}' where slug = 'plaza-bolivar';
update spots set vibes = '{local_heritage}' where slug = 'teatro-nacional-de-panama';
update spots set vibes = '{local_heritage}' where slug = 'ruinas-del-convento-de-santo-domingo';
update spots set vibes = '{local_heritage,romantic_sunset}' where slug = 'plaza-de-francia';
update spots set vibes = '{local_heritage,romantic_sunset}' where slug = 'las-bovedas';
update spots set vibes = '{romantic_sunset,local_heritage}' where slug = 'paseo-esteban-huertas';
update spots set vibes = '{local_heritage}' where slug = 'palacio-de-las-garzas';
update spots set vibes = '{local_heritage}' where slug = 'mercado-de-mariscos';
update spots set vibes = '{local_heritage}' where slug = 'museo-del-canal-interoceanico';
update spots set vibes = '{local_heritage}' where slug = 'museo-de-la-mola';
update spots set vibes = '{local_heritage}' where slug = 'museo-de-historia-de-panama';
update spots set vibes = '{gastro_trendy,romantic_sunset}' where slug = 'santa-rita';
update spots set vibes = '{gastro_trendy,romantic_sunset}' where slug = 'donde-jose';
update spots set vibes = '{gastro_trendy}' where slug = 'fonda-lo-que-hay';
update spots set vibes = '{local_heritage,gastro_trendy}' where slug = 'manolo-caracol';
update spots set vibes = '{rooftop_party,romantic_sunset}' where slug = 'tantalo-rooftop-bar';
update spots set vibes = '{rooftop_party}' where slug = 'pedro-mandinga-rum-bar';
update spots set vibes = '{rooftop_party,gastro_trendy}' where slug = 'labarbara';
update spots set vibes = '{gastro_trendy}' where slug = 'la-rana-dorada-casco-viejo';
update spots set vibes = '{nomad_work,chill_coffee}' where slug = 'cafe-unido';
update spots set vibes = '{chill_coffee,nomad_work}' where slug = 'baloo-cafe';
update spots set vibes = '{chill_coffee}' where slug = 'granclement';
update spots set vibes = '{rooftop_party,local_heritage}' where slug = 'american-trade-hotel';
update spots set vibes = '{rooftop_party,romantic_sunset}' where slug = 'hotel-amarla';
update spots set vibes = '{local_heritage,gastro_trendy}' where slug = 'la-compania-boutique-hotel';
update spots set vibes = '{local_heritage,gastro_trendy}' where slug = 'diablo-rosso';
update spots set vibes = '{local_heritage}' where slug = 'karavan';
