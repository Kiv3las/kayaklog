-- Esquema base de KayakLog (tablas days y settings + RLS + validaciones).
-- Réplica exacta de producción (2026-07-05). Permite reconstruir un entorno
-- (p. ej. kayaklog-dev) desde cero:
--   1. Este archivo (tablas base)
--   2. supabase/river_flows.sql (caudales; reemplazar <PROJECT_REF>/<ANON_KEY>)
--   3. supabase functions deploy delete-account && supabase functions deploy collect-flows
--   4. supabase config push --project-ref <ref> (auth: site_url + redirects)

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Validación server-side del payload rivers (ver check_constraints.sql para
-- el racional). Versión con chequeos de waterLevel y flow.
create or replace function public.days_rivers_valid(rivers jsonb)
  returns boolean
  language sql
  immutable
as $$
  select case
    when rivers is null then true
    when jsonb_typeof(rivers) <> 'array' then false
    else not exists (
      select 1
      from jsonb_array_elements(rivers) as r
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(r->'laps') = 'array' then r->'laps' else '[]'::jsonb end
      ) as l
      where (l->>'km')::numeric      < 0
         or (l->>'km')::numeric      > 1000
         or (l->>'stars')::int       not between 0 and 5
         or (l->>'hours')::int       not between 0 and 48
         or (l->>'minutes')::int     not between 0 and 59
         or (l ? 'difficulty' and l->>'difficulty' not in ('I','II','III','IV','V','VI'))
         or (l ? 'waterLevel' and l->>'waterLevel' not in ('bajo','medio','alto','crecida'))
         or (l ? 'flow' and (l->>'flow')::numeric < 0)
    )
  end;
$$;

create table public.days (
  id bigint not null primary key,          -- id generado por el cliente
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  notes text not null default ''::text,
  rivers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint days_date_format check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint days_notes_len check (notes is null or length(notes) <= 4000),
  constraint days_rivers_size check (rivers is null or octet_length(rivers::text) <= 65536),
  constraint days_rivers_sane check (days_rivers_valid(rivers))
);

create index days_user_id_idx on public.days using btree (user_id);

create table public.settings (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  notif_enabled boolean not null default false,
  notif_time text not null default '09:00',
  updated_at timestamptz not null default now()
);

alter table public.days enable row level security;
alter table public.settings enable row level security;

create policy own_days on public.days
  as permissive for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_settings on public.settings
  as permissive for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
