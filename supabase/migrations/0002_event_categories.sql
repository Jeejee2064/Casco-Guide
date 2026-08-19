-- ═══════════════════════════════════════════════════════════════
-- Realign event_category with the icon set in /public/icons
-- (cinema, dance, expo, kids, music, sports, theatre, workshop)
-- ═══════════════════════════════════════════════════════════════

-- The events table is empty at this point in Phase 1, so a
-- straight retype is safe. If real events exist when this runs,
-- map old → new values in the USING clause below first.

alter table events alter column category type text;
drop type if exists event_category;
create type event_category as enum (
  'cinema', 'dance', 'expo', 'kids', 'music', 'sports', 'theatre', 'workshop'
);
alter table events
  alter column category type event_category using category::event_category;
alter table events alter column category set not null;
