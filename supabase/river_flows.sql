-- Caudales de ríos chilenos (feature "Caudales" en la pestaña Ríos).
-- Aplicado en kayaklog-dev el 2026-07-05 (migraciones river_flows_schema,
-- seed_flow_stations y sample_flow_generator). Aplicar en PRODUCCIÓN junto
-- con el release de la app que incluye la pantalla de caudales.
--
-- flow_stations: catálogo curado de estaciones DGA en ríos kayakeables.
-- flow_readings: serie horaria de caudal m³/s por estación.
-- Escritura solo server-side (service role / cron); lectura autenticada.

create table public.flow_stations (
  code text primary key,                 -- código BNA de la estación DGA
  name text not null,                    -- nombre oficial de la estación
  river_name text not null,              -- nombre corto del río para la app
  region text not null,
  lat double precision,                  -- aproximadas hasta validar con capa oficial
  lng double precision,
  base_flow numeric not null,            -- caudal típico de referencia
  -- Umbrales de nivel (m³/s), calibrados con conocimiento local. NULL cuando
  -- el río no tiene calibración: la app muestra el caudal sin clasificar.
  thr_medio numeric,                     -- desde este valor el nivel es "medio"
  thr_alto numeric,                      -- desde este valor, "alto"
  thr_crecida numeric,                   -- desde este valor, "crecida"
  sort_order int not null default 0,
  active boolean not null default true,
  constraint flow_thresholds_ordered check (
    (thr_medio is null and thr_alto is null and thr_crecida is null)
    or (thr_medio < thr_alto and thr_alto < thr_crecida)
  )
);

create table public.flow_readings (
  station_code text not null references public.flow_stations(code) on delete cascade,
  ts timestamptz not null,
  flow numeric not null check (flow >= 0),
  is_sample boolean not null default false,  -- true mientras la fuente DGA no esté conectada
  primary key (station_code, ts)
);

create index flow_readings_station_ts_idx on public.flow_readings (station_code, ts desc);

alter table public.flow_stations enable row level security;
alter table public.flow_readings enable row level security;

create policy flow_stations_read on public.flow_stations
  for select to authenticated using (true);

create policy flow_readings_read on public.flow_readings
  for select to authenticated using (true);

-- ── Estaciones (códigos BNA reales; catálogo curado por Kilian 2026-07-05) ───
-- Coordenadas exactas según HIDROlínea DGA. Umbrales calibrados por Kilian
-- (2026-07-05); NULL = sin calibración, la app no clasifica nivel. "crecida"
-- solo fue especificada para Trancura (80+); en el resto de los calibrados se
-- usó 2× el umbral de "alto" como estimación.

insert into public.flow_stations
  (code, name, river_name, region, lat, lng, base_flow, thr_medio, thr_alto, thr_crecida, sort_order) values
  ('05704016-5', 'Río Maipo en el Ingenio',               'Maipo',              'Metropolitana', -33.768055, -70.27389, 60, 30, 50, 100, 10),
  ('05707002-1', 'Río Colorado antes Junta Río Maipo',    'Colorado (Maipo)',   'Metropolitana', -33.593056, -70.37028, 35, null, null, null, 20),
  ('07104002-K', 'Río Teno después de Junta con Claro',   'Teno',               'Maule',         -35.00111, -70.825836, 80, 20, 40, 80, 70),
  ('07321002-K', 'Río Maule en Armerillo',                'Maule',              'Maule',         -35.704445, -71.105, 200, null, null, null, 80),
  ('07354002-K', 'Río Achibueno en la Recova',            'Achibueno',          'Maule',         -36.002224, -71.44334, 60, null, null, null, 90),
  ('08106002-9', 'Río Ñuble en San Fabián N 2',           'Ñuble',              'Ñuble',         -36.585835, -71.52556, 120, 30, 50, 100, 100),
  ('08304001-7', 'Río Lonquimay antes Junta Río Bio Bio', 'Bío Bío (Alto)',     'Bío Bío',       -38.44278, -71.26611, 60, null, null, null, 110),
  ('09412001-2', 'Río Trancura en Curarrehue',            'Trancura (Puesco)',  'Araucanía',     -39.364166, -71.583336, 50, 25, 45, 90, 120),
  ('09414001-3', 'Río Trancura antes Río Llafenco',       'Trancura',           'Araucanía',     -39.332222, -71.81917, 120, 70, 75, 80, 130),
  ('09416001-4', 'Río Liucura en Liucura',                'Liucura',            'Araucanía',     -39.260555, -71.82694, 40, null, null, null, 140),
  ('09417008-7', 'Río Carhuello en Puente Pucón',         'Carhuello (Dirty Toilet)', 'Araucanía', -39.243332, -71.844444, 20, null, null, null, 145),
  ('10100002-8', 'Río Fui en Desagüe Lago Pirihueico',    'Fuy',                'Los Ríos',      -39.874443, -71.89167, 80, 40, 60, 120, 150),
  ('10111001-K', 'Río San Pedro en Desagüe Lago Riñihue', 'San Pedro',          'Los Ríos',      -39.775555, -72.45722, 200, null, null, null, 152),
  ('10322003-3', 'Río Gol Gol en Puente Nº 2',            'Gol Gol',            'Los Lagos',     -40.665554, -72.25445, 45, null, null, null, 160),
  ('10702002-0', 'Río Futaleufú en la Frontera',          'Futaleufú',          'Los Lagos',     -43.17861, -71.7575, 350, null, null, null, 170),
  ('11020005-6', 'Río Palena en la Frontera',             'Palena',             'Los Lagos',     -43.585835, -71.745, 250, null, null, null, 175),
  ('11147001-4', 'Río Cisnes en Puerto Cisnes',           'Cisnes',             'Aysén',         -44.76611, -72.62444, 150, null, null, null, 185),
  ('11530000-8', 'Río Baker en Desagüe Lago Bertrand',    'Baker',              'Aysén',         -47.051666, -72.812775, 500, null, null, null, 190),
  ('11711000-1', 'Río Pascua ante Junta Río Quetru',      'Pascua',             'Aysén',         -48.15917, -73.08833, 600, null, null, null, 195),
  ('11701001-5', 'Río Mayer en Desembocadura',            'Mayer',              'Aysén',         -48.414722, -72.54639, 150, null, null, null, 197);

-- ── Colector real: edge function collect-flows + cron horario ────────────────
-- La función supabase/functions/collect-flows/index.ts recolecta el caudal
-- actual desde HIDROlínea DGA (servicio público oficial, sin login/captcha)
-- y lo upsertea en flow_readings. Desplegarla ANTES de programar el cron:
--   supabase functions deploy collect-flows
--
-- IMPORTANTE al aplicar en producción: reemplazar <PROJECT_REF> y <ANON_KEY>
-- por los del proyecto de producción (la anon key es pública por diseño).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'collect-flows-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/collect-flows',
    headers := '{"Authorization": "Bearer <ANON_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
