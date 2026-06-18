# DC Connect — Production Deploy Checklist

Follow these steps in order. ~30 minutes start to finish.

## 1. Set up the database (Supabase)
1. Go to https://supabase.com → create a free account → New Project.
2. Name it (e.g. "dc-dutse"), pick a region close to Nigeria (e.g. EU West), set a DB password, create.
3. When ready, open **SQL Editor → New Query**.
4. Open `supabase-setup.sql` from this project, copy ALL of it, paste, click **Run**.
   You should see "Success. No rows returned."
5. Go to **Project Settings → API**. Copy two values:
   - **Project URL**  → this is your `VITE_SUPABASE_URL`
   - **anon public** key → this is your `VITE_SUPABASE_ANON_KEY`

## 2. Push code to GitHub
```bash
cd dc-dutse
git init
git add .
git commit -m "DC Connect production build"
git branch -M main
git remote add origin https://github.com/Clickshift-Founder/dcdutse.git
git push -u origin main
```
(If the repo already exists from before, just `git add . && git commit -m "phase 2" && git push`.)

## 3. Deploy on Vercel
1. https://vercel.com → Add New → Project → import `dcdutse`.
2. Framework auto-detects as **Vite**. Leave build settings as-is (vercel.json handles them).
3. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   (Leave `VITE_API_URL` blank for now — that's only for automatic messaging later.)
4. Click **Deploy**. You'll get a live link like `dcdutse.vercel.app`.

## 4. First-run setup (in the live app)
1. Open the app → Admin tab → PIN `1234` (CHANGE THIS in src/data/church.config.js before going wide).
2. Go to **➕ Add People** → import your real pastors, HODs, and cell leaders via CSV
   (use `people-import-template.csv` as the format). Mark HODs with role `deptHead`
   and put their department in the Department column.
3. Go to **🧑‍💼 Cell Leaders** → add each cell leader with their coverage locations
   (the dropdowns match the newcomer form, so auto-matching works).
4. Now when newcomers register, they auto-match to the right cell leader, and everything
   syncs across every device (your phone, the pastor's phone, every leader's phone).

## 5. Update the app URL in messages
In `src/data/church.config.js`, set `appUrl` to your real Vercel link (or custom domain).
This is the login link cell leaders receive in their WhatsApp digest.

## Later (when you're ready for automatic messaging)
- Stand up the backend (`server/index.js`) on your VPS (alongside ClickBot).
- Get WhatsApp Cloud API (Meta) or Twilio credentials, put them in the backend `.env`.
- Set `VITE_API_URL` in Vercel to your backend URL.
- Now Broadcast "Auto Send" and automatic birthday messages light up.
  Until then, everything works with free tap-to-send.

## Demo logins (seed data, only shows when Supabase is NOT connected)
- Cell Leader: phone `08012345601`, PIN `5601`
- Admin: PIN `1234`

---

## UPDATE: Cell Reports feature (run this once)
If your Supabase DB was created before the reporting feature, open the SQL Editor
and run the `cell_reports` block at the bottom of `supabase-setup.sql`. New setups
already include it.

## Two admin PINs
- **Super Admin** (full access): PIN `1234` — change in `src/data/church.config.js`
- **Cell Admin** (restricted): PIN `5678` — change in the same file
The Super Admin chooses which tabs the Cell Admin sees under Settings → Cell Admin Permissions.
By default the Cell Admin can view reports, cell performance, and members, but NOT
Assignments, Locations, Audit, Broadcast, or Settings.

## Cell leaders submitting reports
Cell leaders log in (phone + last-4-digits PIN), tap **📋 Cell Reports**, and submit
the weekly form. Admins see the compiled view under **📋 Weekly Reports**, mark offerings
remitted, and chase anyone who hasn't submitted.
