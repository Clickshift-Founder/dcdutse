-- ============================================================
--  DC CONNECT — SUPABASE SETUP
--  Run this ENTIRE file in your Supabase project:
--  Dashboard → SQL Editor → New Query → paste all → Run.
--
--  After running, get your keys from:
--  Dashboard → Project Settings → API
--    • Project URL        → VITE_SUPABASE_URL
--    • anon public key     → VITE_SUPABASE_ANON_KEY
--  Put them in your frontend .env (see .env.example).
-- ============================================================

-- ---- Extensions ----
create extension if not exists "pgcrypto";

-- ============================================================
--  TABLES
-- ============================================================

-- Churches (one row for DC Dutse now; enables multi-tenant later)
create table if not exists churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch text,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- People: newcomers, members, cell leaders, zonal pastors, HODs, pastors
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,                                  -- optional
  roles text[] default array['newcomer'],      -- newcomer, member, cellLeader, zonalPastor, deptHead, pastor
  status text default 'new',                   -- new, active, member, flagged
  -- address (matches the newcomer form cascade)
  area text, sublocation text, village text, street text,
  -- spiritual
  born_again boolean, baptized_hg boolean, baptized_water boolean,
  how_came text, inviter_name text, mission text,
  -- demographics
  gender text, marital text, birthday date,
  -- prayer & departments
  prayer_points text[], custom_prayer text,
  departments text[],                          -- department ids the person is interested in / assigned to
  dept_assigned text,                          -- the single department they now serve in (after membership)
  -- assignment & followup
  assigned_leader_id uuid references people(id) on delete set null,
  attendance date[] default array[]::date[],
  contacted_at timestamptz,
  whatsapp_added boolean default false,
  -- leader-specific
  zone text,
  coverage text[],                             -- exact area/sublocation strings this leader covers
  can_login boolean default false,
  dept_id text,                                -- for HODs: which department they head
  -- birthday automation
  last_birthday_greeted date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_people_church on people(church_id);
create index if not exists idx_people_status on people(status);
create index if not exists idx_people_leader on people(assigned_leader_id);
create index if not exists idx_people_phone on people(phone);

-- Custom locations added by admin (beyond the built-in FCT list)
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,
  area text not null,
  sublocation text,
  villages text,
  created_at timestamptz default now()
);

-- Message log: every send (manual or automated), for accountability & delivery tracking
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,
  to_phone text,
  to_email text,
  channel text,                                -- whatsapp, sms, email, call
  body text,
  subject text,                                -- for email
  status text default 'queued',                -- queued, sent, delivered, failed
  campaign_id uuid,                            -- groups a broadcast
  person_id uuid references people(id) on delete set null,
  error text,
  created_at timestamptz default now()
);

create index if not exists idx_messages_campaign on messages(campaign_id);
create index if not exists idx_messages_church on messages(church_id);

-- Broadcast campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,
  name text,
  audience text,                               -- members, newcomers, not_members, zone:X, dept:Y, flagged, birthdays
  channel text,
  body text,
  subject text,
  scheduled_for timestamptz,                   -- null = send now
  status text default 'draft',                 -- draft, scheduled, sending, sent
  total integer default 0,
  sent integer default 0,
  failed integer default 0,
  created_at timestamptz default now()
);

-- Audit log
create table if not exists audit (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,
  action text,
  detail text,
  actor text,
  at timestamptz default now()
);

create index if not exists idx_audit_church on audit(church_id);

-- ============================================================
--  AUTO-UPDATE updated_at
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_people_updated on people;
create trigger trg_people_updated before update on people
  for each row execute function set_updated_at();

-- ============================================================
--  HELPER: auto-promote to member at threshold
--  (call from app after marking attendance, or rely on app logic)
-- ============================================================
create or replace function recompute_status(p_id uuid, threshold int default 5)
returns void as $$
begin
  update people set status =
    case
      when array_length(attendance,1) >= threshold then 'member'
      when array_length(attendance,1) > 0 then 'active'
      else 'new'
    end
  where id = p_id and status <> 'flagged';
end;
$$ language plpgsql;

-- ============================================================
--  SEED: create the DC Dutse church row
-- ============================================================
insert into churches (name, branch, config)
select 'Dominion City', 'Dutse Branch',
  jsonb_build_object(
    'address', 'No. 2 Dutse Obasanjo Rd, after Mae Suya, Dutse Alhaji, FCT Abuja',
    'leadPastor', 'Pastor Stanley Nzewigbo',
    'membershipThreshold', 5
  )
where not exists (select 1 from churches where name = 'Dominion City' and branch = 'Dutse Branch');

-- ============================================================
--  ROW LEVEL SECURITY
--  For a single-church launch with an anon key, we keep RLS
--  permissive (the app is gated by admin/leader PINs in-app).
--  When you go multi-tenant or add Supabase Auth, tighten these
--  to: church_id = auth.jwt() ->> 'church_id'.
-- ============================================================
alter table churches  enable row level security;
alter table people    enable row level security;
alter table locations enable row level security;
alter table messages  enable row level security;
alter table campaigns enable row level security;
alter table audit     enable row level security;

-- Permissive policies for launch (anon key can read/write).
-- NOTE: revisit before opening to multiple churches.
do $$
declare t text;
begin
  foreach t in array array['churches','people','locations','messages','campaigns','audit']
  loop
    execute format('drop policy if exists "anon_all_%1$s" on %1$s;', t);
    execute format('create policy "anon_all_%1$s" on %1$s for all using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
--  DONE. Next:
--  1. Copy Project URL + anon key into frontend .env
--  2. (Optional) import your people via the Admin → Add People CSV
--  3. Deploy. The app auto-detects Supabase and switches from
--     browser-only storage to the shared cloud database.
-- ============================================================

-- ============================================================
--  CELL REPORTS  (added in the reporting build)
--  Weekly home-cell reports submitted by cell leaders.
--  Run this block in the SQL Editor if you set up your DB
--  before this feature existed.
-- ============================================================
create table if not exists cell_reports (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade,
  leader_id uuid references people(id) on delete set null,
  leader_name text,
  week_of date,                 -- the Sunday (or chosen date) the report covers
  report_date date,             -- actual date the cell held
  topic text,
  adults int default 0,
  children int default 0,
  mvps_present text[],          -- ids of assigned newcomers present
  mvps_present_names text[],    -- names snapshot for the report
  offering numeric default 0,
  dca int default 0,            -- attendees currently in Dominion City Academy
  dli int default 0,            -- attendees currently in Leadership Institute
  comment text,
  offering_remitted boolean default false,
  remitted_at timestamptz,
  remitted_note text,
  created_at timestamptz default now()
);

create index if not exists idx_reports_church on cell_reports(church_id);
create index if not exists idx_reports_leader on cell_reports(leader_id);
create index if not exists idx_reports_week on cell_reports(week_of);

alter table cell_reports enable row level security;
drop policy if exists "anon_all_cell_reports" on cell_reports;
create policy "anon_all_cell_reports" on cell_reports for all using (true) with check (true);

-- ============================================================
--  CELL REPORTS — additional fields (souls won/visited, cell MVP)
--  Run this block if your cell_reports table already exists.
--  Existing rows default to 0; nothing is lost.
-- ============================================================
alter table cell_reports add column if not exists souls_won int default 0;
alter table cell_reports add column if not exists souls_visited int default 0;
alter table cell_reports add column if not exists cell_mvp int default 0;

-- ============================================================
--  FIX: newcomer inserts were failing silently. Run this block.
--  1) birthday stored as TEXT (supports year-less "MM-DD")
--  2) add assigned_leader_name / assigned_leader_phone so the
--     cell portal can always match a soul to its leader by phone
--     (a generated/local leader id is NOT a valid uuid).
-- ============================================================
alter table people alter column birthday type text using birthday::text;
alter table people add column if not exists assigned_leader_name text;
alter table people add column if not exists assigned_leader_phone text;
