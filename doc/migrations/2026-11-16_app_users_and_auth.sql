-- Website logins: users (retailer or supplier), one-time password tokens.
-- Access is service-role only (RLS on, no policies), like the other tables.

create table if not exists public.app_users (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  email            text not null,
  role             text not null check (role in ('retailer','supplier')),
  supplier_id      uuid references public.suppliers(id) on delete cascade,
  password_hash    text,
  status           text not null default 'invited' check (status in ('invited','active','disabled')),
  invited_by       text,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  constraint app_users_supplier_matches_role check ((role = 'supplier') = (supplier_id is not null))
);
create unique index if not exists app_users_email_unique on public.app_users (lower(email));
create index if not exists app_users_tenant_idx on public.app_users (tenant_id);
alter table public.app_users enable row level security;

create table if not exists public.auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  token_hash  text not null unique,
  purpose     text not null check (purpose in ('set_password','reset_password')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists auth_tokens_user_idx on public.auth_tokens (user_id);
alter table public.auth_tokens enable row level security;
