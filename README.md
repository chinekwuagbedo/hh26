# Red Sea

Red Sea is a React website built with Vite. It runs in a browser and no longer uses Expo or native mobile tooling.

## Run on Windows
1. If connected to TAMU_Wifi, just run http://localhost:5173 (very much preferred)

OR

1. Install Node.js (20.19+ or 22.12+).
2. Open PowerShell in this project folder and install packages:

   ```powershell
   npm install
   ```

3. Create a local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Open `.env` and set `FOODDATA_API_KEY` to a new key from [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide.html). Do not put the key in React code or commit `.env`. The key previously shared in chat should be revoked and replaced.
5. Start the website and API proxy together:

   ```powershell
   npm run dev
   ```

6. Open the URL printed by Vite, usually <http://localhost:5173>.

The browser talks to the local Node API at `/api`; Vite forwards those requests to the server on port 3001. Food search is proxied server-side so the USDA key is not sent to the browser. Searches are limited to 30 per IP per minute.

Profile, cycle/day logs, workouts, and food logs are stored in browser local storage. Period dates, symptoms, and feelings can also sync between devices after linking the profile to a verified email; food and workout logs remain local. Apple Health/HealthKit and SQLCipher were native-only features and are not available in this browser version. MyFitnessPal CSV exports can still be imported from the Cycle screen.

## Cross-device period sync

1. Create a Supabase project. The project's **Connect** dialog shows the Project URL and publishable key; keys are also listed under **Project Settings → API Keys**. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
2. Enable email OTP/magic-link authentication. Add the local Vite URL (usually `http://localhost:5173`) and production site URL to Supabase Auth's allowed redirect URLs.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. Use the key beginning `sb_publishable_` (or the legacy public `anon` key), never `sb_secret_` or `service_role` in this browser app.
4. In Me, enter the same Tide ID and verified email on each device, then open the emailed sign-in link. Initial sync merges local period entries with the account's cycle data. Row-level security limits cycle records to their owner.

The Cycle screen accepts CSV with a `Period Date` column, or `Date` and `Period` columns. Period values can be true/yes/1/period or false/no/0. JSON may contain a `periodDates` array, a date-keyed `dayLogs`/`logs` object, or an array of dates. Imports add period flags without replacing other day-log fields. The importer runs locally and does not send the file to a third party.

## Checks and production

```powershell
npm run lint
npm run typecheck
npm run build
```

The production build is served by the Node API server:

```powershell
$env:NODE_ENV = "production"
npm start
```

Then open <http://localhost:3001>. Set `FOODDATA_API_KEY` in the deployment environment as a server-side secret before starting the server.
