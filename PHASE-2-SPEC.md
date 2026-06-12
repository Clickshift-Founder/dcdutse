# DC Connect — Phase 2 Spec: Backend, Broadcast & AI Calling

This document specs the move from the current browser-only app to a production backend, then layers on broadcast messaging and (optionally) an AI calling agent.

---

## 1. Why a backend is needed for production

The current app stores data in each browser (`localStorage`). That is perfect for a single-user demo, but in production it means:

- The pastor's phone and your phone show different data — nothing is shared.
- If a phone is wiped or the browser cache cleared, that data is gone.
- Automatic WhatsApp/SMS can't run (no server to send from).
- Multi-church tenancy is impossible (no central place to separate churches).

A backend solves all four. It becomes the single source of truth that every device reads from and writes to.

---

## 2. Recommended architecture

```
Frontend (Vercel)  →  Node backend (your VPS)  →  Supabase (Postgres + auth)
                                              →  WhatsApp Cloud API / Twilio
                                              →  Voice provider (phase 3)
```

- Frontend: stays exactly where it is, on Vercel. No change except it now reads/writes via the backend API instead of localStorage.
- Backend: a Node/Express service on your VPS, alongside ClickBot. Holds the business logic, talks to the database and the providers.
- Database: Supabase (managed Postgres). Chosen over self-hosting because it gives backups, auth, row-level security, and a dashboard for free — all things you'd otherwise build and maintain yourself.

### Why Supabase over a DB you install on the VPS
Your VPS *can* run Postgres, but then you own backups, security patches, disk monitoring, and crash recovery. For a solo founder running three products, that is real risk. Supabase removes that burden and its free tier (500MB DB, 50k monthly active users) is far beyond what one church needs. Keep the VPS for compute (the Node server, workers, the calling agent); let Supabase own the data.

---

## 3. Database schema (Supabase / Postgres)

```sql
-- Churches (enables multi-tenancy later)
create table churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch text,
  config jsonb,            -- address, pastor, services, theme, messages
  created_at timestamptz default now()
);

-- Everyone: newcomers, members, leaders, pastors, HODs
create table people (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id),
  name text not null,
  phone text not null,
  roles text[] default '{newcomer}',   -- newcomer, member, cellLeader, zonalPastor, deptHead, pastor
  status text default 'new',           -- new, active, member, flagged
  area text, sublocation text, village text,
  born_again bool, baptized_hg bool, baptized_water bool,
  how_came text, inviter_name text,
  gender text, marital text, birthday date,
  prayer_points text[], custom_prayer text,
  departments text[],
  assigned_leader_id uuid references people(id),
  attendance date[],
  contacted_at timestamptz,
  whatsapp_added bool default false,
  created_at timestamptz default now()
);

-- Cell leader coverage areas (for auto-matching)
create table coverage (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid references people(id),
  location text not null   -- exact area or sublocation string
);

-- Message log (every send, for accountability + delivery tracking)
create table messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id),
  to_phone text, channel text,       -- whatsapp, sms, call
  body text, status text,            -- queued, sent, delivered, failed
  campaign_id uuid,                  -- groups a broadcast together
  created_at timestamptz default now()
);

-- Audit log
create table audit (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id),
  action text, detail text, actor text,
  at timestamptz default now()
);
```

Row-level security (RLS) keyed on `church_id` is what makes one deployment safely serve many churches — each church only sees its own rows.

---

## 4. Backend API endpoints

```
GET    /api/people?status=&role=&area=     list / filter people
POST   /api/people                          create (newcomer or leader)
PATCH  /api/people/:id                       update status, attendance, assignment
DELETE /api/people/:id

POST   /api/assign                           manual assignment
GET    /api/match?area=&sub=                 returns the matching cell leader

POST   /api/notify                           single WhatsApp/SMS (already built)
POST   /api/broadcast                         queue a bulk send to a filtered audience
GET    /api/broadcast/:id                     campaign status + delivery counts

POST   /api/calls/schedule                    schedule an AI call (phase 3)
POST   /api/calls/webhook                      receive call outcome from voice provider

POST   /api/sync                              offline-queue flush (already built)
```

The current `server/index.js` already implements `/api/notify` and `/api/sync`. Phase 2 adds the database wiring and the broadcast endpoints.

---

## 5. Broadcast tab (frontend)

A new admin tab. Flow:

1. Pick an audience with filters: All members, All newcomers, Not-yet-members, A specific zone, A specific department, Flagged only, Birthdays this week.
2. Compose a message, with placeholders like `{firstName}` that personalize per recipient.
3. Choose channel: WhatsApp or SMS.
4. Preview: see recipient count and a sample rendered message.
5. Send: the backend queues each message through the broadcast worker (rate-limited so providers don't block you), and the Messages table tracks delivered/failed.

A scheduled option ("send Sunday 6am") is a natural extension once the worker exists.

Tap-to-send stays as the zero-cost fallback for when no provider is configured.

---

## 6. Should the AI calling agent be the next phase?

Short answer: it should be *phase 3*, not the immediate next step. Build broadcast first. Reasons:

- Broadcast is lower-risk, cheaper, and teaches you what the calls should even say. The wording that works in a WhatsApp follow-up is the script the agent will later speak.
- A misfiring text is a minor annoyance; a misfiring autonomous phone call to a brand-new visitor can feel intrusive and reflect on the church. Earn that trust gradually.
- The calling stack depends on having clean contact data and a backend already running — both of which phase 2 delivers.

### What the 48-hour AI caller would need

1. A trigger: a scheduled job that finds newcomers created >48h ago with `contacted_at IS NULL`.
2. A voice provider: Vapi, Bland.ai, or Retell. These handle the hard parts — placing the call, low-latency speech-to-text and text-to-speech, and turn-taking. You do not build telephony yourself.
3. A tightly-scoped agent prompt: one job only — "warmly welcome {firstName} to {church}, confirm they're well, invite them to {nextService} and their HomeCell with {leaderName}, answer only basic questions, and offer to have a pastor call back for anything deeper." Explicitly forbid it from going off-script.
4. Context injection: the person's name, area, prayer points, assigned leader, service times — passed in per call so it sounds informed, like Boardy does.
5. An outcome webhook: the provider calls back with what happened (reached / voicemail / call back later), which updates `contacted_at` and the message log.
6. Guardrails: a daily call cap, calling-hours window (never late at night), an opt-out, and a human-handoff path. Always disclose it's an automated assistant from the church.

### Why Boardy feels so good (and how to match it)
Boardy is narrow. It does one job — networking intros — and never pretends to do more. Its accuracy comes from scope discipline plus good context, not from being a general agent. Replicate that: keep the DC Dutse agent pointed at exactly one task, feed it rich per-person context, and have it gracefully hand off anything outside its lane. A narrow agent that nails the welcome call beats a clever one that occasionally says something theologically or pastorally off.

### Rough cost picture (validate before committing)
Voice providers bill per minute (roughly US$0.05–0.15/min all-in including the underlying telephony and model). A 2-minute welcome call is a few cents. For a church doing tens of newcomers a week this is very affordable; the cost discipline is mostly about call caps and not re-calling people.

---

## 7. Suggested sequence

1. Phase 2a — Stand up Supabase + migrate the backend to read/write it. Frontend switches from localStorage to the API. Now data is shared across devices.
2. Phase 2b — Broadcast tab + worker. Bulk WhatsApp/SMS with audience filters.
3. Phase 3 — AI welcome caller, scoped to the 48-hour follow-up, built on the now-clean data and running backend.
4. Phase 4 — True multi-tenancy: church sign-up, per-church subdomains, RLS isolation. The schema above already anticipates this via `church_id`.

Each phase ships value on its own, so you're never stuck in a long build with nothing to show leadership.
