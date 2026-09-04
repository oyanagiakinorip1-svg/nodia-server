-- Adds multi-space support to an already-provisioned NODIA database.
-- Safe to run once against the existing project: creates the spaces table,
-- backfills one default space per existing user, then attaches space_id to
-- every existing node/connection before making the column required.

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '無題のスペース',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spaces enable row level security;

create policy "spaces_select_own" on public.spaces for select using (auth.uid() = user_id);
create policy "spaces_insert_own" on public.spaces for insert with check (auth.uid() = user_id);
create policy "spaces_update_own" on public.spaces for update using (auth.uid() = user_id);
create policy "spaces_delete_own" on public.spaces for delete using (auth.uid() = user_id);

create index if not exists spaces_user_id_idx on public.spaces (user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spaces_touch_updated_at on public.spaces;
create trigger spaces_touch_updated_at
before update on public.spaces
for each row execute function public.touch_updated_at();

-- One default space per user who already has nodes.
insert into public.spaces (user_id, name)
select distinct user_id, 'マイスペース'
from public.nodes
on conflict do nothing;

alter table public.nodes add column if not exists space_id uuid references public.spaces (id) on delete cascade;
alter table public.connections add column if not exists space_id uuid references public.spaces (id) on delete cascade;

update public.nodes n
set space_id = s.id
from public.spaces s
where n.space_id is null and s.user_id = n.user_id;

update public.connections c
set space_id = s.id
from public.spaces s
where c.space_id is null and s.user_id = c.user_id;

alter table public.nodes alter column space_id set not null;
alter table public.connections alter column space_id set not null;

create index if not exists nodes_space_id_idx on public.nodes (space_id);
create index if not exists connections_space_id_idx on public.connections (space_id);
