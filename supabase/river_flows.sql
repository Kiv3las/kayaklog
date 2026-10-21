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

-- ── RPC del tablero: todo en una llamada compacta ────────────────────────────
-- La app llama flow_board() en vez de dos consultas en serie: estaciones
-- activas + serie de 26 h por estación como [epoch, caudal]. ~15 KB total.
-- (Aplicada en PROD el 2026-07-07.)

create or replace function public.flow_board()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', s.code,
    'name', s.name,
    'river_name', s.river_name,
    'region', s.region,
    'lat', s.lat,
    'lng', s.lng,
    'thr_medio', s.thr_medio,
    'thr_alto', s.thr_alto,
    'thr_crecida', s.thr_crecida,
    'is_sample', coalesce(r.latest_is_sample, false),
    'series', coalesce(r.series, '[]'::jsonb)
  ) order by s.sort_order), '[]'::jsonb)
  from public.flow_stations s
  left join lateral (
    select
      jsonb_agg(jsonb_build_array(extract(epoch from x.ts)::bigint, x.flow) order by x.ts) as series,
      -- flag de la ÚLTIMA lectura (lo que ve el usuario), no de la ventana
      (array_agg(x.is_sample order by x.ts desc))[1] as latest_is_sample
    from (
      select ts, flow, is_sample
      from public.flow_readings
      where station_code = s.code
        and ts >= now() - interval '26 hours'
    ) x
  ) r on true
  where s.active
$$;

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

-- ══ Caudales v2 (2026-10-20): estaciones nuevas, detalle y pronóstico ════════

-- ── Estaciones nuevas (elegidas por Kilian 2026-10-20) ──────────────────────
-- Las cuatro reportaron caudal en vivo en HIDROlínea al momento de agregarlas,
-- salvo Bravo (sin dato ese día; la app muestra "Sin datos" hasta que vuelva a
-- transmitir). "Desagüe" es la salida del Lago Caburgua (Ojos del Caburgua),
-- a metros de la estación del Carhuello. Sin umbrales: aún sin calibrar.

insert into public.flow_stations
  (code, name, river_name, region, lat, lng, base_flow, thr_medio, thr_alto, thr_crecida, sort_order) values
  ('05704017-3', 'Río Yeso en Puente El Yeso',  'Yeso',                         'Metropolitana', -33.78611, -70.22972, 6, null, null, null, 15),
  ('08380006-2', 'Río Laja en Tucapel 2',       'Laja',                         'Bío Bío',       -37.283054, -71.986946, 150, null, null, null, 105),
  ('09417002-8', 'Ojos del Caburgua',           'Desagüe (Ojos del Caburgua)',  'Araucanía',     -39.24389, -71.84417, 80, null, null, null, 146),
  ('11614001-2', 'Río Bravo',                   'Bravo',                        'Aysén',         -48.032776, -73.0225, 100, null, null, null, 192);

-- ── Celda GloFAS por estación (pronóstico de caudal) ────────────────────────
-- GloFAS (Copernicus, vía Open-Meteo Flood API) modela el caudal en una grilla
-- de 0,05°. La celda más cercana a la estación muchas veces cae en un afluente
-- chico (Ñuble: 2,5 m³/s modelado vs 195 medido), así que cada estación se
-- calibró buscando, en una vecindad de 7×7 celdas, la que mejor sigue la serie
-- DGA de los últimos 60 días (correlación de log-caudal diario, penalizando
-- diferencia de magnitud y distancia). Entre paréntesis, la correlación r.
-- NULL = sin pronóstico de caudal (la app muestra solo lluvia/temperatura):
--   - r < 0,6: Maipo (0,48), Colorado (0,40), Futaleufú (0,38, regulado por la
--     represa Amutui Quimey) y Pascua (0,05) — GloFAS no sigue a esos ríos.
--   - estaciones nuevas sin historia: recalibrar con ~60 días de lecturas.

alter table public.flow_stations
  add column glofas_lat double precision,
  add column glofas_lng double precision;

update public.flow_stations s set glofas_lat = v.lat, glofas_lng = v.lng
from (values
  ('07104002-K', -35.025, -70.875),  -- Teno (0,61)
  ('07321002-K', -35.775, -71.125),  -- Maule (0,73)
  ('07354002-K', -36.125, -71.425),  -- Achibueno (0,75)
  ('08106002-9', -36.575, -71.575),  -- Ñuble (0,85)
  ('08304001-7', -38.425, -71.325),  -- Bío Bío Alto (0,75)
  ('09412001-2', -39.375, -71.625),  -- Trancura Puesco (0,89)
  ('09414001-3', -39.325, -71.825),  -- Trancura (0,89)
  ('09416001-4', -39.225, -71.875),  -- Liucura (0,84)
  ('09417008-7', -39.275, -71.775),  -- Carhuello (0,88)
  ('10100002-8', -39.875, -71.875),  -- Fuy (0,66)
  ('10111001-K', -39.775, -72.475),  -- San Pedro (0,72)
  ('10322003-3', -40.625, -72.125),  -- Gol Gol (0,91)
  ('11020005-6', -43.575, -71.725),  -- Palena (0,81)
  ('11147001-4', -44.775, -72.725),  -- Cisnes (0,83)
  ('11530000-8', -47.125, -72.675),  -- Baker (0,77)
  ('11701001-5', -48.425, -72.575)   -- Mayer (0,92)
) as v(code, lat, lng)
where s.code = v.code;

-- ── Pronóstico diario (16 días) ─────────────────────────────────────────────
-- Lo llena la edge function collect-forecasts dos veces al día. Una fila por
-- estación y día (fecha de Chile); cada corrida sobrescribe los días que
-- vuelve a pronosticar.

create table public.flow_forecasts (
  station_code text not null references public.flow_stations(code) on delete cascade,
  day date not null,
  flow numeric,          -- caudal estimado m³/s (GloFAS corregido con la DGA); NULL sin celda calibrada
  flow_raw numeric,      -- caudal GloFAS sin corregir, para auditar la corrección
  precip_mm numeric,     -- lluvia del día (Open-Meteo)
  temp_max numeric,      -- temperatura máxima °C (Open-Meteo)
  issued_at timestamptz not null default now(),
  primary key (station_code, day)
);

alter table public.flow_forecasts enable row level security;

create policy flow_forecasts_read on public.flow_forecasts
  for select to authenticated using (true);

-- ── RPC del detalle: todo lo de una estación en una llamada ─────────────────
-- hourly: últimos 7 días [epoch, caudal]; daily: promedio/mín/máx por fecha de
-- Chile, hasta 400 días [fecha, prom, mín, máx] (gráfico de 30 días y caudal
-- de los días que remaste); forecast: hoy en adelante [fecha, caudal, lluvia,
-- t. máx]. NULL si la estación no existe o RLS no la deja ver.

create or replace function public.flow_station_detail(p_code text)
returns jsonb
language sql
stable
as $$
  with today as (select (now() at time zone 'America/Santiago')::date as d)
  select jsonb_build_object(
    'code', s.code,
    'name', s.name,
    'river_name', s.river_name,
    'region', s.region,
    'lat', s.lat,
    'lng', s.lng,
    'thr_medio', s.thr_medio,
    'thr_alto', s.thr_alto,
    'thr_crecida', s.thr_crecida,
    'has_flow_forecast', s.glofas_lat is not null,
    'hourly', coalesce((
      select jsonb_agg(jsonb_build_array(extract(epoch from r.ts)::bigint, r.flow) order by r.ts)
      from public.flow_readings r
      where r.station_code = s.code and r.ts >= now() - interval '7 days'
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_array(d.day, round(d.avg, 2), d.min, d.max) order by d.day)
      from (
        select (r.ts at time zone 'America/Santiago')::date as day,
               avg(r.flow) as avg, min(r.flow) as min, max(r.flow) as max
        from public.flow_readings r
        where r.station_code = s.code and r.ts >= now() - interval '400 days'
        group by 1
      ) d
    ), '[]'::jsonb),
    'forecast', coalesce((
      select jsonb_agg(jsonb_build_array(f.day, f.flow, f.precip_mm, f.temp_max) order by f.day)
      from public.flow_forecasts f, today
      where f.station_code = s.code and f.day >= today.d
    ), '[]'::jsonb),
    'forecast_issued_at', (
      select max(f.issued_at)
      from public.flow_forecasts f, today
      where f.station_code = s.code and f.day >= today.d
    )
  )
  from public.flow_stations s
  where s.code = p_code
$$;

-- ── Cron del pronóstico ─────────────────────────────────────────────────────
-- Desplegar antes: supabase functions deploy collect-forecasts
-- Mismo reemplazo de <PROJECT_REF>/<ANON_KEY> que collect-flows-hourly.

select cron.schedule(
  'collect-forecasts',
  '20 9,21 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/collect-forecasts',
    headers := '{"Authorization": "Bearer <ANON_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
