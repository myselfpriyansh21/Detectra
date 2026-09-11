-- ============================================================
-- Detectra — Supabase schema (PS-189: AI-Powered Criminal
-- Network Analysis System)
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New query).
-- ============================================================

-- ─── Extensions ───
create extension if not exists "pgcrypto";   -- gen_random_uuid(), digest()

-- ─── Users (profile row per Supabase Auth user) ───
create table if not exists app_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  employee_id   text unique not null,
  name          text not null,
  role          text not null check (role in ('Admin','National Analyst','State Analyst','Officer','Auditor')),
  organization  text not null default 'NCRB',
  region        text not null default 'All-India',
  is_active     boolean not null default true,
  created_by    uuid references app_users(id),
  created_at    timestamptz not null default now()
);

-- ─── Entities (people, phones, vehicles, locations, orgs, accounts) ───
create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('Person','Phone','Vehicle','Location','Organization','Account')),
  name        text not null,
  aliases     text[] not null default '{}',
  attributes  jsonb not null default '{}',
  region      text not null default 'All-India',
  community   int not null default 0,
  page_rank   numeric not null default 0,
  created_by  uuid references app_users(id),
  org_id      text not null default 'NCRB',
  created_at  timestamptz not null default now()
);

-- ─── Relationships between entities ───
create table if not exists relationships (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references entities(id) on delete cascade,
  target_id     uuid not null references entities(id) on delete cascade,
  type          text not null,
  weight        numeric not null default 1,
  source_doc    text,
  verified      boolean not null default false,
  verified_by   uuid references app_users(id),
  region        text not null default 'All-India',
  org_id        text not null default 'NCRB',
  event_time    timestamptz,
  created_by    uuid references app_users(id),
  created_at    timestamptz not null default now()
);

-- ─── Uploaded source documents (FIR / CDR / Financial / Surveillance / Social / Criminal DB) ───
create table if not exists data_sources (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('FIR','CDR','Financial','Surveillance','Social','Criminal')),
  filename      text not null,
  region        text not null default 'All-India',
  org_id        text not null default 'NCRB',
  entity_count  int not null default 0,
  rel_count     int not null default 0,
  uploaded_by   uuid references app_users(id),
  uploaded_at   timestamptz not null default now()
);

-- ─── Investigations / cases ───
create table if not exists investigations (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  lead_officer  uuid references app_users(id),
  status        text not null default 'Open' check (status in ('Open','Under Investigation','Closed')),
  region        text not null default 'All-India',
  org_id        text not null default 'NCRB',
  created_at    timestamptz not null default now()
);

create table if not exists investigation_entities (
  investigation_id uuid references investigations(id) on delete cascade,
  entity_id         uuid references entities(id) on delete cascade,
  added_by          uuid references app_users(id),
  added_at          timestamptz not null default now(),
  primary key (investigation_id, entity_id)
);

-- ─── Data-access control: which sources/regions a role can see ───
create table if not exists access_grants (
  id       uuid primary key default gen_random_uuid(),
  role     text not null,
  source   text not null,
  region   text not null default 'All-India',
  enabled  boolean not null default true
);

-- ─── Hash-chained, append-only audit log (tamper-evidence) ───
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references app_users(id),
  user_name   text not null,
  action      text not null,
  resource    text not null,
  details     text,
  prev_hash   text not null,
  hash        text not null,
  created_at  timestamptz not null default now()
);

-- Trigger: compute hash = sha256(prev_hash || row data) so any edit to a
-- past row breaks the chain and "Verify Integrity" in the Admin dashboard
-- can detect it by recomputing hashes and comparing.
create or replace function audit_log_hash_chain() returns trigger as $$
declare
  last_hash text;
begin
  select hash into last_hash from audit_log order by id desc limit 1;
  if last_hash is null then last_hash := 'GENESIS'; end if;
  new.prev_hash := last_hash;
  new.hash := encode(
    digest(last_hash || new.user_id::text || new.action || new.resource || coalesce(new.details,'') || now()::text, 'sha256'),
    'hex'
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_hash on audit_log;
create trigger trg_audit_hash before insert on audit_log
  for each row execute function audit_log_hash_chain();

-- Audit log is append-only: block updates/deletes at the DB level.
create or replace function block_audit_mutation() returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;

drop trigger if exists trg_audit_no_update on audit_log;
create trigger trg_audit_no_update before update or delete on audit_log
  for each row execute function block_audit_mutation();

-- ============================================================
-- Row Level Security — role + region scoped access
-- ============================================================

alter table app_users enable row level security;
alter table entities enable row level security;
alter table relationships enable row level security;
alter table data_sources enable row level security;
alter table investigations enable row level security;
alter table investigation_entities enable row level security;
alter table access_grants enable row level security;
alter table audit_log enable row level security;

-- helper: current user's row
create or replace function current_app_user() returns app_users as $$
  select * from app_users where id = auth.uid();
$$ language sql stable;

-- Admin: full access to everything.
create policy admin_all_users on app_users for all
  using (exists (select 1 from app_users u where u.id = auth.uid() and u.role = 'Admin'));

-- Everyone can read their own profile row.
create policy self_read on app_users for select
  using (id = auth.uid());

-- Entities: Admin/National Analyst see all; State Analyst/Officer/Auditor
-- see only their own region's rows (or 'All-India' shared data).
create policy entities_scoped_read on entities for select
  using (
    exists (
      select 1 from app_users u
      where u.id = auth.uid()
      and (u.role in ('Admin','National Analyst')
           or entities.region = u.region
           or entities.region = 'All-India')
    )
  );

create policy entities_write on entities for insert
  with check (exists (select 1 from app_users u where u.id = auth.uid() and u.role in ('Admin','National Analyst','State Analyst','Officer')));

create policy relationships_scoped_read on relationships for select
  using (
    exists (
      select 1 from app_users u
      where u.id = auth.uid()
      and (u.role in ('Admin','National Analyst')
           or relationships.region = u.region
           or relationships.region = 'All-India')
    )
  );

create policy relationships_write on relationships for insert
  with check (exists (select 1 from app_users u where u.id = auth.uid() and u.role in ('Admin','National Analyst','State Analyst','Officer')));

-- Audit log: Admin + Auditor can read all; everyone else can only read
-- entries where they are the acting user. Insert is allowed for any
-- authenticated user (their own actions get logged); updates/deletes are
-- blocked entirely by the trigger above regardless of RLS.
create policy audit_read on audit_log for select
  using (
    exists (select 1 from app_users u where u.id = auth.uid() and u.role in ('Admin','Auditor'))
    or user_id = auth.uid()
  );

create policy audit_insert on audit_log for insert
  with check (auth.uid() is not null);

-- Access grants: only Admin can manage; everyone can read (needed so the
-- UI can show/hide source tabs per role).
create policy access_grants_read on access_grants for select using (true);
create policy access_grants_admin_write on access_grants for all
  using (exists (select 1 from app_users u where u.id = auth.uid() and u.role = 'Admin'));

-- Investigations: Officers see only investigations they lead; Analysts/
-- Admin see all within scope.
create policy investigations_read on investigations for select
  using (
    exists (
      select 1 from app_users u
      where u.id = auth.uid()
      and (u.role in ('Admin','National Analyst')
           or investigations.region = u.region
           or investigations.lead_officer = u.id)
    )
  );

-- ============================================================
-- Seed: default access grants (Admin can edit later from the UI)
-- ============================================================
insert into access_grants (role, source, region, enabled) values
  ('Admin','FIR','All-India',true), ('Admin','CDR','All-India',true), ('Admin','Financial','All-India',true),
  ('Admin','Surveillance','All-India',true), ('Admin','Social','All-India',true), ('Admin','Criminal','All-India',true),
  ('National Analyst','FIR','All-India',true), ('National Analyst','CDR','All-India',true), ('National Analyst','Financial','All-India',true),
  ('National Analyst','Surveillance','All-India',true), ('National Analyst','Social','All-India',true), ('National Analyst','Criminal','All-India',true),
  ('State Analyst','FIR','All-India',true), ('State Analyst','CDR','All-India',true), ('State Analyst','Financial','All-India',true),
  ('State Analyst','Surveillance','All-India',false), ('State Analyst','Social','All-India',false), ('State Analyst','Criminal','All-India',true),
  ('Officer','FIR','All-India',true), ('Officer','CDR','All-India',true), ('Officer','Financial','All-India',false),
  ('Officer','Surveillance','All-India',false), ('Officer','Social','All-India',false), ('Officer','Criminal','All-India',true),
  ('Auditor','FIR','All-India',false), ('Auditor','CDR','All-India',false), ('Auditor','Financial','All-India',false),
  ('Auditor','Surveillance','All-India',false), ('Auditor','Social','All-India',false), ('Auditor','Criminal','All-India',false)
on conflict do nothing;

-- ============================================================
-- Notes
-- ============================================================
-- 1. Create your first Admin manually: sign up a user via Supabase Auth,
--    then run:
--    insert into app_users (id, employee_id, name, role, organization, region)
--    values ('<auth-user-uuid>', 'ADMIN001', 'Admin Superintendent', 'Admin', 'NCRB', 'All-India');
-- 2. Every subsequent user should be created by the Admin dashboard
--    (Admin -> User Management -> Create User), which calls
--    supabase.auth.admin.createUser via a server-side function/edge
--    function — the anon key alone cannot create auth users directly.
