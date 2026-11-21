-- Berlin-wide with a map: the district becomes free text, and spots get coordinates.
alter table public.spots drop constraint spots_neighbourhood_check;
comment on column public.spots.neighbourhood is 'District name shown on the card, e.g. Neukölln, Mitte.';
alter table public.spots
  add column lat double precision check (lat between 52.3 and 52.7),
  add column lng double precision check (lng between 13.0 and 13.8),
  add column image_url text; -- optional picture for the map pin; a category icon is used when empty
