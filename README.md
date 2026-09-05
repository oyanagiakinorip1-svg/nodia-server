# NODIA Server

Hono API + Supabase backend for the [NODIA](https://github.com/oyanagiakinorip1-svg/nodia)
Unity client (a 3D node-based memo app). Deployed to Vercel as serverless
functions at `https://nodia-server.vercel.app/api` — the live client using it
is at [nodia-web-six.vercel.app](https://nodia-web-six.vercel.app).

## Structure

- `api/index.ts` — Hono app (`/spaces`, `/space`, `/nodes`, `/connections`)
- `lib/supabase.ts` — per-request Supabase client, scoped to the caller's access token
- `supabase/schema.sql` — table definitions + row level security policies

## Setup

1. **Supabase**
   - Create a project, run `supabase/schema.sql` in the SQL Editor.
   - Enable Authentication > Sign In / Providers > **Anonymous Sign-ins**.
   - Copy the Project URL and the `anon` / publishable API key.

2. **Local install**
   ```
   npm install
   cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_ANON_KEY
   ```

3. **Deploy to Vercel**
   - Push this repo to GitHub, then in the Vercel dashboard: New Project > Import
     this repository. Vercel auto-detects the `api/` folder — no root directory
     override needed since this repo's root *is* the server.
   - Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables in
     Vercel's Project Settings before the first deploy (or redeploy after adding them).
   - Note: `SUPABASE_URL` is the bare project URL (`https://xxxx.supabase.co`),
     with no `/rest/v1/` or other path suffix — the code appends what it needs.

4. Once deployed, the Unity client's `ApiClient` should point to
   `https://<your-project>.vercel.app/api`.
