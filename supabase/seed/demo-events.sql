-- Demo/test events — one per event_category, for visually testing the
-- map pins and icons. Not real, verified listings (is_verified = false).
-- Safe to delete once real event data is ready to be seeded instead.
--
-- title/description/article are bilingual (see migration 0003);
-- this seed only ever had Spanish titles + English copy, so the
-- English title is left equal to the Spanish one — feel free to
-- translate it properly when replacing this with real data.

insert into events (
  title_es, title_en, slug, description_es, description_en, article_es, article_en, category,
  date, time_start, time_end, recurring,
  latitude, longitude, address,
  capacity, price, booking_url, organizer,
  tags, is_featured, is_verified, photo
) values
  (
    'Cine al Aire Libre: Clásicos de Panamá', 'Cine al Aire Libre: Clásicos de Panamá', 'cine-al-aire-libre-clasicos',
    'Outdoor movie night on a plaza screen, local classics under the stars.',
    'Outdoor movie night on a plaza screen, local classics under the stars.',
    'A rotating selection of Panamanian and Latin American films, projected outdoors on a plaza wall once the sun goes down. Bring a blanket — seating is on the stone steps. Concessions are cash-only from a small local cart.',
    'A rotating selection of Panamanian and Latin American films, projected outdoors on a plaza wall once the sun goes down. Bring a blanket — seating is on the stone steps. Concessions are cash-only from a small local cart.',
    'cinema', current_date + 3, '19:30', '21:30', 'weekly',
    8.9531, -79.5352, 'Plaza Bolívar, Casco Viejo',
    150, 0, null, 'Casco Viejo Community Events',
    array['outdoor','film','free'], true, false,
    'https://images.unsplash.com/photo-1527979809431-ea3d5c0c01c9?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    'Salsa Night Under the Stars', 'Salsa Night Under the Stars', 'salsa-night-under-the-stars',
    'Open-air salsa social with a live band and a beginner-friendly warm-up.',
    'Open-air salsa social with a live band and a beginner-friendly warm-up.',
    'Locals and visitors take over a plaza for an evening of salsa, starting with a free 30-minute lesson before the live band takes over. No partner needed — rotate freely. Casco''s dance community shows up in force for this one.',
    'Locals and visitors take over a plaza for an evening of salsa, starting with a free 30-minute lesson before the live band takes over. No partner needed — rotate freely. Casco''s dance community shows up in force for this one.',
    'dance', current_date + 5, '20:00', '23:30', 'weekly',
    8.9536, -79.5338, 'Plaza de Francia, Casco Viejo',
    200, 5, null, 'Casco Viejo Community Events',
    array['salsa','live-music','social'], true, false,
    'https://images.unsplash.com/photo-1632054553195-bfd7034fee25?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    'Casco Viejo Art & Design Expo', 'Casco Viejo Art & Design Expo', 'casco-art-design-expo',
    'Two-day showcase of local designers, illustrators, and independent galleries.',
    'Two-day showcase of local designers, illustrators, and independent galleries.',
    'A weekend expo bringing together independent Panamanian artists and designers in one converted colonial courtyard. Expect prints, ceramics, small-batch clothing, and a few pop-up galleries showing new work. Good spot to meet the local creative scene.',
    'A weekend expo bringing together independent Panamanian artists and designers in one converted colonial courtyard. Expect prints, ceramics, small-batch clothing, and a few pop-up galleries showing new work. Good spot to meet the local creative scene.',
    'expo', current_date + 10, '10:00', '18:00', 'once',
    8.9519, -79.5344, 'Calle 3ra Este, Casco Viejo',
    null, 3, null, null,
    array['art','design','local-artists'], false, false,
    'https://images.unsplash.com/photo-1569783721854-33a99b4c0bae?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    'Títeres en el Parque', 'Títeres en el Parque', 'titeres-en-el-parque',
    'Free puppet show for kids on Saturday mornings.',
    'Free puppet show for kids on Saturday mornings.',
    'A short, colorful puppet show aimed at younger kids, performed in a shaded corner of the park on Saturday mornings. Arrive a little early for face painting. Runs about 40 minutes, followed by a Q&A with the puppeteers.',
    'A short, colorful puppet show aimed at younger kids, performed in a shaded corner of the park on Saturday mornings. Arrive a little early for face painting. Runs about 40 minutes, followed by a Q&A with the puppeteers.',
    'kids', current_date + 6, '10:30', '11:15', 'weekly',
    8.9524, -79.5360, 'Parque Bolívar, Casco Viejo',
    80, 0, null, null,
    array['kids','free','family'], false, false,
    'https://images.unsplash.com/photo-1595239094789-4e00e532528a?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    'Jazz al Atardecer', 'Jazz al Atardecer', 'jazz-al-atardecer',
    'A small jazz trio plays a rooftop courtyard as the sun sets.',
    'A small jazz trio plays a rooftop courtyard as the sun sets.',
    'An intimate rooftop set — trio format, mostly standards with a few Panamanian jazz arrangements mixed in. Seating is limited, so it fills up fast once the light starts turning gold over the bay.',
    'An intimate rooftop set — trio format, mostly standards with a few Panamanian jazz arrangements mixed in. Seating is limited, so it fills up fast once the light starts turning gold over the bay.',
    'music', current_date + 8, '18:30', '21:00', 'monthly',
    8.9527, -79.5349, 'Avenida A, Casco Viejo',
    90, 15, null, null,
    array['jazz','live-music','sunset'], true, false,
    'https://images.unsplash.com/photo-1693938770487-63d587ceebe9?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    'Casco Viejo 5K Sunrise Run', 'Casco Viejo 5K Sunrise Run', 'casco-viejo-5k-sunrise-run',
    'Community fun run through the old quarter, finishing before the heat hits.',
    'Community fun run through the old quarter, finishing before the heat hits.',
    'A casual, community-organized 5K loop through Casco Viejo''s cobblestone streets, starting just after sunrise to beat the heat. Not chip-timed — it''s more about the group run and the coffee afterward than the clock.',
    'A casual, community-organized 5K loop through Casco Viejo''s cobblestone streets, starting just after sunrise to beat the heat. Not chip-timed — it''s more about the group run and the coffee afterward than the clock.',
    'sports', current_date + 12, '06:00', '07:30', 'monthly',
    8.9518, -79.5335, 'Plaza de la Independencia, Casco Viejo',
    120, 0, null, null,
    array['running','community','morning'], false, false,
    'https://images.unsplash.com/photo-1613936360976-8f35cf0e5461?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    'Teatro Callejero: Historias del Casco', 'Teatro Callejero: Historias del Casco', 'teatro-callejero-historias-del-casco',
    'Street theatre troupe performs short historical vignettes around the plazas.',
    'Street theatre troupe performs short historical vignettes around the plazas.',
    'A traveling troupe stages short, playful vignettes based on Casco Viejo''s history, moving between three plazas over the course of the evening. Performed mostly in Spanish, but very visual and easy to follow either way.',
    'A traveling troupe stages short, playful vignettes based on Casco Viejo''s history, moving between three plazas over the course of the evening. Performed mostly in Spanish, but very visual and easy to follow either way.',
    'theatre', current_date + 15, '17:00', '19:00', 'once',
    8.9533, -79.5343, 'Plaza Herrera, Casco Viejo',
    null, 0, null, null,
    array['theatre','history','free'], false, false,
    'https://images.unsplash.com/photo-1588671815815-b0cd3b2a9189?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    'Taller de Fotografía Callejera', 'Taller de Fotografía Callejera', 'taller-fotografia-callejera',
    'Half-day street photography workshop through Casco''s streets and markets.',
    'Half-day street photography workshop through Casco''s streets and markets.',
    'A hands-on workshop for photographers of any level — an hour of guidance on light and composition, followed by a guided walk through Casco''s streets and the fish market to shoot. Bring your own camera or phone.',
    'A hands-on workshop for photographers of any level — an hour of guidance on light and composition, followed by a guided walk through Casco''s streets and the fish market to shoot. Bring your own camera or phone.',
    'workshop', current_date + 18, '09:00', '13:00', 'once',
    8.9522, -79.5356, 'Mercado de Mariscos, Casco Viejo',
    15, 25, null, null,
    array['photography','workshop','hands-on'], false, false,
    'https://images.unsplash.com/photo-1606913855359-e2425f14f50e?q=80&w=1200&auto=format&fit=crop'
  )
on conflict (slug) do update set photo = excluded.photo;
