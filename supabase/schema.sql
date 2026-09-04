-- NODIA: nodes & connections, isolated per-user via Supabase Auth (anonymous sign-ins).
-- Run this in the Supabase SQL editor. Also enable:
--   Dashboard > Authentication > Sign In / Providers > Anonymous Sign-ins

create extension if not exists pgcrypto;

create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  position_z double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_node uuid not null references public.nodes (id) on delete cascade,
  to_node uuid not null references public.nodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, from_node, to_node)
);

create index if not exists nodes_user_id_idx on public.nodes (user_id);
create index if not exists connections_user_id_idx on public.connections (user_id);

alter table public.nodes enable row level security;
alter table public.connections enable row level security;

create policy "nodes_select_own" on public.nodes for select using (auth.uid() = user_id);
create policy "nodes_insert_own" on public.nodes for insert with check (auth.uid() = user_id);
create policy "nodes_update_own" on public.nodes for update using (auth.uid() = user_id);
create policy "nodes_delete_own" on public.nodes for delete using (auth.uid() = user_id);

create policy "connections_select_own" on public.connections for select using (auth.uid() = user_id);
create policy "connections_insert_own" on public.connections for insert with check (auth.uid() = user_id);
create policy "connections_delete_own" on public.connections for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nodes_touch_updated_at on public.nodes;
create trigger nodes_touch_updated_at
before update on public.nodes
for each row execute function public.touch_updated_at();
