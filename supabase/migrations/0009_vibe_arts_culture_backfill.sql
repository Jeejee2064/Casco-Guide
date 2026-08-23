-- ═══════════════════════════════════════════════════════════════
-- Vibes — re-scope `chill_coffee` from "cafe hangout" to "Arts &
-- Culture" (label/descriptor/icon change in messages/*.json and
-- src/lib/vibes.ts). It was functionally a duplicate of nomad_work's
-- "WiFi • Coworking • Good coffee" — every spot qualifying for one
-- qualified for the other, so the chip/pin never actually
-- distinguished anything on the map. Galleries, museums, theatre and
-- live-music venues give this slot its own ground instead.
--
-- The enum value itself (`chill_coffee`) is unchanged — only what it
-- means and which spots carry it. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- Drop it from the cafes/plaza it no longer describes — they're
-- already covered by nomad_work (cafes) / local_heritage (the plaza).
update spots set vibes = array_remove(vibes, 'chill_coffee') where slug = 'baloo-cafe';
update spots set vibes = array_remove(vibes, 'chill_coffee') where slug = 'cafe-unido';
update spots set vibes = array_remove(vibes, 'chill_coffee') where slug = 'granclement';
update spots set vibes = array_remove(vibes, 'chill_coffee') where slug = 'plaza-bolivar';

-- Add it to the spots that actually fit "Arts & Culture".
update spots set vibes = array_append(vibes, 'chill_coffee')
  where slug = 'diablo-rosso' and not ('chill_coffee' = any(vibes)); -- contemporary art gallery
update spots set vibes = array_append(vibes, 'chill_coffee')
  where slug = 'museo-de-la-mola' and not ('chill_coffee' = any(vibes)); -- Guna textile art museum
update spots set vibes = array_append(vibes, 'chill_coffee')
  where slug = 'teatro-nacional-de-panama' and not ('chill_coffee' = any(vibes)); -- opera/ballet/concerts
update spots set vibes = array_append(vibes, 'chill_coffee')
  where slug = 'american-trade-hotel' and not ('chill_coffee' = any(vibes)); -- jazz club
