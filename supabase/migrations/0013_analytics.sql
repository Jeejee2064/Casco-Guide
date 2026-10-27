-- First-party analytics (replaces PostHog): one row per tracked event, written
-- by /api/track with the service role, read by the admin dashboard through
-- the aggregate functions below. No personal data: visitor_id is a random
-- id kept in the visitor's own localStorage, IPs are never stored.

create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  event       text not null,                      -- 'pageview', 'spot_view', 'share_click', …
  props       jsonb not null default '{}'::jsonb, -- event-specific fields (spot_slug, channel, …)
  path        text,                               -- '/es/spots/vista-corona'
  locale      text,                               -- 'es' | 'en'
  device      text,                               -- 'mobile' | 'tablet' | 'desktop'
  referrer    text,                               -- external referring domain, pageviews only
  visitor_id  text                                -- anonymous random id
);

create index if not exists analytics_events_event_created_idx
  on analytics_events (event, created_at desc);
create index if not exists analytics_events_created_idx
  on analytics_events (created_at desc);

-- RLS on with no policies: the anon/authenticated roles can't read or write
-- anything. Only the service role (which bypasses RLS) touches this table.
alter table analytics_events enable row level security;

-- Explicit grants: on some projects tables created from the SQL editor don't
-- inherit service_role privileges, and the collector/dashboard would get
-- "permission denied". anon/authenticated deliberately get nothing.
grant all on table analytics_events to service_role;
grant usage, select, update on sequence analytics_events_id_seq to service_role;

-- ─── Aggregates used by the admin dashboard ──────────────────────────────

create or replace function analytics_summary(days int)
returns table (visitors bigint, pageviews bigint, searches bigint, pwa_installs bigint)
language sql stable as $$
  select
    count(distinct visitor_id) filter (where event = 'pageview'),
    count(*) filter (where event = 'pageview'),
    count(*) filter (where event = 'search_performed'),
    count(*) filter (where event = 'pwa_install_accepted')
  from analytics_events
  where created_at >= now() - make_interval(days => days);
$$;

-- Per UTC day (matches the zero-filling done in analytics-server.ts).
create or replace function analytics_daily(days int)
returns table (day text, pageviews bigint, visitors bigint)
language sql stable as $$
  select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD'),
         count(*), count(distinct visitor_id)
  from analytics_events
  where event = 'pageview' and created_at >= now() - make_interval(days => days)
  group by 1 order by 1;
$$;

-- Per UTC hour of the current UTC day: 'YYYY-MM-DDTHH'.
create or replace function analytics_hourly_today()
returns table (hour text, pageviews bigint, visitors bigint)
language sql stable as $$
  select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24'),
         count(*), count(distinct visitor_id)
  from analytics_events
  where event = 'pageview'
    and (created_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date
  group by 1 order by 1;
$$;

-- Top values of one props key for one event, optionally filtered on another
-- key (e.g. filter_applied.value where kind = 'vibe').
create or replace function analytics_top(
  ev text, prop text, days int, lim int, fkey text default null, fval text default null
)
returns table (label text, n bigint)
language sql stable as $$
  select props ->> prop, count(*)
  from analytics_events
  where event = ev
    and created_at >= now() - make_interval(days => days)
    and props ->> prop is not null
    and (fkey is null or props ->> fkey = fval)
  group by 1 order by 2 desc limit lim;
$$;

create or replace function analytics_event_counts(evs text[], days int)
returns table (event text, n bigint)
language sql stable as $$
  select e.event, count(*)
  from analytics_events e
  where e.event = any (evs) and e.created_at >= now() - make_interval(days => days)
  group by 1;
$$;

create or replace function analytics_search_stats(days int)
returns table (total bigint, zero bigint)
language sql stable as $$
  select count(*), count(*) filter (where props ->> 'result_count' = '0')
  from analytics_events
  where event = 'search_performed' and created_at >= now() - make_interval(days => days);
$$;

-- Pageview breakdown by 'device' | 'locale' | 'referrer'.
create or replace function analytics_pageview_dim(dim text, days int, lim int)
returns table (label text, n bigint)
language sql stable as $$
  select label, count(*) as n
  from (
    select case dim
             when 'device' then device
             when 'locale' then case when locale in ('en', 'es') then locale end
             when 'referrer' then coalesce(nullif(referrer, ''), 'direct')
           end as label
    from analytics_events
    where event = 'pageview' and created_at >= now() - make_interval(days => days)
  ) t
  where label is not null
  group by label order by n desc limit lim;
$$;

create or replace function analytics_night_mode(days int)
returns table (toggles bigint, people bigint)
language sql stable as $$
  select count(*), count(distinct visitor_id)
  from analytics_events
  where event = 'night_mode_toggle' and props ->> 'to' = 'night'
    and created_at >= now() - make_interval(days => days);
$$;

-- Housekeeping: raw rows older than `keep_days` are dropped. Run it by hand,
-- or schedule it (Supabase → Database → Cron), e.g. weekly:
--   select cron.schedule('analytics-prune', '0 4 * * 0', 'select analytics_prune(365)');
create or replace function analytics_prune(keep_days int)
returns bigint language plpgsql as $$
declare n bigint;
begin
  delete from analytics_events where created_at < now() - make_interval(days => keep_days);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only the service role may call these (the dashboard runs server-side).
revoke execute on function
  analytics_summary(int), analytics_daily(int), analytics_hourly_today(),
  analytics_top(text, text, int, int, text, text), analytics_event_counts(text[], int),
  analytics_search_stats(int), analytics_pageview_dim(text, int, int),
  analytics_night_mode(int), analytics_prune(int)
from public, anon, authenticated;
grant execute on function
  analytics_summary(int), analytics_daily(int), analytics_hourly_today(),
  analytics_top(text, text, int, int, text, text), analytics_event_counts(text[], int),
  analytics_search_stats(int), analytics_pageview_dim(text, int, int),
  analytics_night_mode(int), analytics_prune(int)
to service_role;
