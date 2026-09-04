create table if not exists public.tiendanube_connections (
  store_id text primary key,
  access_token text not null,
  scope text not null default '',
  connected_at timestamptz not null default now()
);

alter table public.tiendanube_connections enable row level security;
-- The Worker accesses this table exclusively with SUPABASE_SERVICE_ROLE_KEY.
