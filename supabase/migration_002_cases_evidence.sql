-- ============================================================
-- Detectra — migration 002: app_users columns + cases + evidence
-- Run this in Supabase SQL Editor AFTER schema.sql.
--
-- Part A below adds columns to app_users that later features
-- (rank/jurisdiction, profile editing) depend on but the original
-- schema.sql never included — without these, Officer accounts are
-- missing department/rank/station and the jurisdiction filtering in
-- utils/jurisdiction.ts silently falls back to "no access".
--
-- Part B adds the cases + evidence tables — see note further down.
-- ============================================================

-- ─── Part A: app_users columns ───
alter table app_users add column if not exists department text not null default 'Local Police';
alter table app_users add column if not exists rank text;
alter table app_users add column if not exists station_id text;
alter table app_users add column if not exists phone text;
alter table app_users add column if not exists photo_data_url text;
alter table app_users add column if not exists granted_overrides text[] not null default '{}';

-- ─── Part B: cases + evidence ───
-- The original schema.sql modeled the knowledge-graph side
-- (entities/relationships/investigations) but never defined a table
-- for the flat case-record data the app actually creates through
-- "Add / Import Case" (FIR text, batch upload, CCTNS import, scanned
-- report) or the Evidence panel on each case. This migration adds
-- both, with the same region-scoped RLS pattern used for
-- entities/relationships.
-- ============================================================

-- ─── Cases (flat incident record — what "Add / Import Case" creates) ───
create table if not exists cases (
  id                text primary key,   -- human-readable ids from the app (e.g. 'FIR001') kept as-is
  date              date not null default current_date,
  latitude          numeric not null,
  longitude         numeric not null,
  crime_type        text not null default 'Unknown',
  severity_score    int not null default 5,
  crime_hour        int not null default 12,
  suspect_name      text not null default 'Unknown',
  phone_number      text,
  vehicle_number    text,
  gang_affiliation  text not null default 'Unknown',
  evidence_found    text not null default 'None',
  case_status       text not null default 'Open' check (case_status in ('Open','Under Investigation','Closed')),
  station           text,
  department        text,
  region            text not null default 'All-India',
  org_id            text not null default 'NCRB',
  created_by        uuid references app_users(id),
  created_at        timestamptz not null default now()
);

-- ─── Evidence (attached to a case, structured by type) ───
create table if not exists evidence (
  id             text primary key,
  case_id        text not null references cases(id) on delete cascade,
  type           text not null check (type in ('CDR','Financial','Physical','Digital','Document','Photo')),
  department     text not null,
  uploaded_by    text not null,     -- display name of the submitting officer/analyst
  notes          text,
  fields         jsonb not null default '{}',
  file_name      text,
  file_data_url  text,              -- base64 data URL; fine for a prototype, move to Supabase Storage for production
  region         text not null default 'All-India',
  created_by     uuid references app_users(id),
  created_at     timestamptz not null default now()
);

alter table cases enable row level security;
alter table evidence enable row level security;

-- Cases: Admin/National Analyst see all; everyone else sees rows tagged
-- to their region or 'All-India'. (Station/rank-level granularity is
-- still enforced client-side via utils/jurisdiction.ts — see note at
-- the bottom of this file.)
create policy cases_scoped_read on cases for select
  using (
    exists (
      select 1 from app_users u
      where u.id = auth.uid()
      and (u.role in ('Admin','National Analyst')
           or cases.region = u.region
           or cases.region = 'All-India')
    )
  );

create policy cases_write on cases for insert
  with check (auth.uid() is not null);

create policy cases_update on cases for update
  using (auth.uid() is not null);

-- Evidence: same region-scoped read; any authenticated user can attach
-- evidence to a case (insert-only, no update — evidence is append-only
-- by design, matching the audit-log pattern).
create policy evidence_scoped_read on evidence for select
  using (
    exists (
      select 1 from app_users u
      where u.id = auth.uid()
      and (u.role in ('Admin','National Analyst')
           or evidence.region = u.region
           or evidence.region = 'All-India')
    )
  );

create policy evidence_write on evidence for insert
  with check (auth.uid() is not null);

-- ============================================================
-- Note on jurisdiction granularity
-- ============================================================
-- utils/jurisdiction.ts implements station -> district -> zone -> national
-- visibility based on an Officer's rank. Replicating that exact hierarchy
-- in RLS would need a stations/districts/zones lookup table plus a SQL
-- function mirroring scopeForRank() — straightforward but more work than
-- this deadline allows. For now, DB-level RLS enforces region-level
-- scoping (same as entities/relationships); the finer station/rank
-- breakdown within a region is enforced client-side in
-- filterIncidentsForUser(). If you need real DB-level station
-- granularity before judging, say so and I'll add the lookup table +
-- policy function next — it's a contained addition on top of this.