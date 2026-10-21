create table if not exists public.orbis_rooms (
  id uuid primary key,
  revision bigint not null default 0,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.orbis_rooms enable row level security;
revoke all on public.orbis_rooms from anon, authenticated;
grant select, insert, update on public.orbis_rooms to service_role;
-- No public policies: all access goes through the authoritative Edge Function.
