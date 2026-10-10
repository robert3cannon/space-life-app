# Orbit

Orbit is a personal life manager for Robert, a college student in East Lansing. It is a mobile-first installable web app: today's schedule, food against daily targets, workouts, reminders, and real Web Push to an iPhone. Scheduler and coach bots read and write the same data through a bearer-token API.

Times are **America/Detroit** (Eastern). The sample week assumes late starts (breakfast around 11:30), afternoon classes, evening shifts, and blocks as late as 11pm. Nothing in this repo is a real password, push key, or personal record. The example classes, cafe shifts, and meals are fiction.

## Stack

- Next.js (App Router) and React, deployed on Vercel
- Postgres (Neon, Vercel Postgres, or any Postgres `DATABASE_URL`) via Drizzle and `postgres`
- Web Push with VAPID (`web-push`) and a service worker
- Reminders are sent by `GET /api/cron/dispatch`. Vercel Hobby can call that once a day. On-time delivery uses a free external pinger every 5 minutes.

## Local setup

You need Node 22 and Postgres 16.

```bash
docker compose up -d
cp .env.example .env.local
# fill in the secrets described below
npm install
npm run migrate
npm run seed
npm run dev
```

The compose file creates `orbit` and, on a fresh volume, `orbit_test` for `npm test`. If you already have Postgres, create both databases and point `DATABASE_URL` at `orbit`.

Open [http://localhost:3000](http://localhost:3000) and sign in with `APP_PASSWORD`.

`npm run seed` **deletes** events, food, workouts, water, sleep, habits, reminders, push subscriptions, and the activity feed, then inserts an example week around today in Detroit. It refuses to run when `NODE_ENV=production` unless `ALLOW_SEED=1`. A fresh production database is only the schema from `npm run migrate`. It does not insert example classes, meals, workouts, water, sleep, or habits. The first time someone opens the app, settings pick up the default targets (including a 100 oz water goal) and the late meal-reminder times. Those are preferences, not sample logs.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Postgres URL. The Neon integration sets this. If it is empty, the app uses `POSTGRES_URL`, then `POSTGRES_PRISMA_URL`. Prepared statements are off so the pooler works. |
| `APP_PASSWORD` | yes | The only UI passcode. Use a long random string. There is no signup. |
| `SESSION_SECRET` | yes | HMAC key for the `orbit_session` cookie. `openssl rand -base64 32` |
| `BOT_API_TOKEN` | yes | Bearer token for `/api/bot/*`. |
| `VAPID_PUBLIC_KEY` | for push | URL-safe base64 public key. |
| `VAPID_PRIVATE_KEY` | for push | URL-safe base64 private key. Never commit this. |
| `VAPID_SUBJECT` | for push | `mailto:you@example.com` or an `https://` contact URL. Required by the Web Push spec. |
| `DATABASE_URL_UNPOOLED` | for deploy | Direct Neon URL. Migrations use it when it is set. The pooler is a poor fit for that transaction. The Neon integration sets this. `POSTGRES_URL_NON_POOLING` is accepted too. |
| `CRON_SECRET` | for reminders | Bearer token for `/api/cron/dispatch`. Vercel Cron sends it when this variable is set. cron-job.org must send the same header. |
| `USER_NAME` | no | Greeting name. Defaults to Robert. |
| `ALLOW_SEED` | no | Set to `1` to allow `npm run seed` against production. |
| `USDA_API_KEY` | no | FoodData Central key for food search and barcodes. If unset, the app uses `DEMO_KEY`, which is heavily rate limited. Get a free key at [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup). |
| `HEALTH_SYNC_TOKEN` | no | Bearer token for the Apple Health shortcut endpoints. Settings can mint a separate device token. Either one is accepted. |

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Put the public key in `VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run migrate` | Apply `drizzle/*.sql` once, tracked in `schema_migrations` |
| `npm run seed` | Replace data with the example week |
| `npm test` | Timezone, sleep, streaks, Apple Health shortcut payloads, session, API, reminder dispatch, and VAPID signing tests |
| `npm run icons` | Regenerate the PWA icons and splash screens |

On Vercel the install uses `vercel-build`, which migrates and then builds. Seed is never part of deploy, so a new production database starts empty.

## Deploy to Vercel

1. Import this GitHub repo. Framework preset: Next.js. Production branch: `main`.
2. Connect Neon with Vercel's Neon integration. It sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct), plus the older `POSTGRES_URL` names. Leave `POSTGRES_URL_NO_SSL` unused. Queries from the app use the pooled URL. `vercel-build` runs migrations before `next build` and uses the unpooled URL when that variable is present, so both must be available to the Production build.
3. Set `APP_PASSWORD`, `SESSION_SECRET`, `BOT_API_TOKEN`, `CRON_SECRET`, and the three VAPID variables. `HEALTH_SYNC_TOKEN` is optional. `USDA_API_KEY` is optional and avoids the shared demo food-search limit.
4. Deploy. The production database gets the schema only. Seed does not run.
5. Open the production HTTPS URL, sign in, and install it on the iPhone (below).
6. Create the cron-job.org job in the next section. Until that exists, reminders are only checked by the daily Vercel cron.

`vercel.json` schedules `GET /api/cron/dispatch` once a day at 15:00 UTC (11:00 AM Detroit during daylight time, 10:00 AM during standard time). Hobby rejects anything more frequent, and Hobby may run that job any time during the 15:00 hour. It is a catch-up. A class reminder 30 minutes ahead needs the 5-minute pinger.

Each dispatch creates missing meal and wellness reminders, sends every pending reminder whose time has arrived, and drops push subscriptions the browser has expired (HTTP 404 or 410). If every subscription fails for a temporary reason, the reminder stays pending and the next run tries again. A successful call returns HTTP 200 and JSON with `"ok": true`.

### On-time reminders with cron-job.org

Vercel Hobby cannot call the dispatch route every few minutes. [cron-job.org](https://console.cron-job.org) is free and can. Do this after the first production deploy, using the production URL (a `*.vercel.app` URL or the custom domain), not a preview URL.

1. Create a free account at [console.cron-job.org](https://console.cron-job.org).
2. Choose **Create cronjob**.
3. Title: `Orbit reminders`.
4. URL: `https://YOUR_PRODUCTION_DOMAIN/api/cron/dispatch`
5. Schedule, in the job's timezone (America/Detroit is fine):
   - Minutes: `0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55` (every 5 minutes)
   - Hours: every hour
   - Days of month, months, and weekdays: every
6. Request method: **GET**.
7. Open the headers section and add one header. Name: `Authorization`. Value: `Bearer ` followed by the `CRON_SECRET` value from Vercel, with a single space after Bearer. Do not put the secret in the URL.
8. Save the job and leave it enabled.
9. Use **Run now**. The history should show HTTP 200 and a body that includes `"ok": true`.
10. Turn on the failure email. cron-job.org disables a job after 25 failures in a row.

You can check the same URL yourself:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_PRODUCTION_DOMAIN/api/cron/dispatch
```

In Vercel, **Settings → Deployment Protection**: production must be publicly reachable. The iPhone install needs that anyway. If Standard Protection covers production, cron-job.org receives Vercel's login page, the job fails, and it turns itself off. Vercel's own daily cron is allowed through that protection and sends the bearer token on its own.

A Pro plan can replace this with a `*/5 * * * *` entry in `vercel.json`. Hobby will reject that schedule and the deploy will not go out.

## Install on an iPhone

Web Push on iOS works only for a home-screen web app, on **iOS 16.4 or later**. A Safari tab cannot subscribe.

1. Deploy Orbit (or open an HTTPS tunnel). Push and install both require HTTPS. `localhost` on the phone will not do.
2. Open the site in **Safari** (not Chrome).
3. Tap the Share button.
4. Tap **Add to Home Screen**, then Add.
5. Open **Orbit** from the new icon. The status bar should look like an app, not Safari.
6. Go to **More → Settings** and tap **Enable notifications**. Tap Allow.
7. Tap **Send a test**. The same steps are written on the settings screen.

If you deny permission: iOS Settings → Notifications → Orbit → Allow. Then open Orbit from the home screen and try again.

The manifest uses `display: standalone`, a dark theme color (`#060514`), and splash images for the 390×844 and 430×932 iPhones. Other sizes fall back to that background color.

## What the app does

- **Today.** Greeting, the current or next block, today's schedule, calories and macros against targets, water and last night's sleep, habits due today, steps and active calories when Apple Health has synced, today's workout (or the next one), pending reminders, and the latest bot notes.
- **Schedule.** Day and week views. Create, edit, and delete blocks of type class, work, study, workout, meal, or other. Optional reminder before the start.
- **Food.** Log meals with calories and protein, carbs, and fat. Search curated restaurant menus first, then USDA FoodData Central and Open Food Facts, scale a serving, or scan a package barcode with the iPhone camera. Daily totals, a weekly chart, editable targets, manual entry, and one-tap re-log of recent foods.
- **Train.** Plan exercises with sets (reps and weight in pounds, or a duration). Check sets off, mark the session done, and scroll history. The exercise library (100+ movements) shows the muscles each one trains, a front and back body map, and a two-frame form demo. Tap a muscle to list what hits it. A session and the current week each roll those muscles up so you can see what you trained and what you skipped.
- **Water and sleep.** Water has a daily ounce goal (default 100, editable) and quick adds of 8, 16, or 24 oz, plus a custom amount. Sleep is logged as bedtime and wake time, or as a duration, with an optional 1–5 quality. A bedtime after midnight still belongs to the morning you woke up, which is the usual case when wake time is around 11:00 AM. Both have a weekly chart.
- **Habits.** Daily habits, or specific weekdays. Check them off on Today. Current and best streaks skip an unfinished today and skip days that are not scheduled. Protein, water, a finished workout, and 10,000 Apple Health steps can fill a habit in. Each habit has a month calendar. An optional evening reminder covers the ones still open.
- **Reminders.** Custom reminders, plus automatic ones for events, workouts, and meals (default 11:30 breakfast, 3:00 lunch, 8:00 dinner — late on purpose). Optional water nudges only at 11:00 or later, a wind-down that can be after midnight, and an evening habit reminder.
- **Activity.** Short notes from you or from bots.
- **Settings.** Targets, the water goal, meal and wellness reminder times, and notification setup. Apple Health lives at Settings → Apple Health: the sync token, last import, weight trend, and the Shortcuts steps.

The UI is one account. Middleware redirects everyone else to `/login`. The session cookie is HTTP-only, `SameSite=Lax`, and `Secure` in production.

## Apple Health

A PWA cannot read HealthKit. Orbit takes a JSON batch from an iOS Shortcut and can hand today's food and water back so the shortcut can write them with **Log Health Sample**.

Open **More → Wellness → Apple Health** (the same screen is linked from Settings). The page starts with three steps: copy the token, build the import shortcut, then build the export shortcut and a daily automation. Jump chips on that screen skip to each section. Generate a device token there, or set `HEALTH_SYNC_TOKEN` on the server. The shortcut sends `Authorization: Bearer <token>`. Regenerate replaces the device token. Revoke turns it off. The server token keeps working after a revoke. The same screen shows the last sync and a weight trend, and it fills in the three addresses for this install:

- `POST /api/apple-health/import`
- `GET /api/apple-health/export`
- `POST /api/apple-health/export/ack`

Those three routes are outside the session cookie. `/api/health` is still only the liveness check. Do not post samples there.

Sending the same day again updates steps, energy, exercise minutes, resting heart rate, and dietary water. It does not insert a second row. Workouts match on `id` when the shortcut sends one, otherwise on type plus start plus end. Weight samples match on the timestamp. A date with no time is stored at noon Detroit. Times with no timezone are America/Detroit, so `10/8/2026, 1:30 AM` in October is Eastern Daylight Time.

Sleep fills an empty morning, or a morning already filled from Apple Health. A night you logged yourself stays. Clear that morning in Sleep if you want the next sync to replace it. When Health sends asleep segments, those are the duration. In-bed time is used only when there is no asleep segment. Awake segments are ignored.

Dietary water stays out of the water log, so exporting Orbit water does not double what Health already recorded. The water ring is what you log in Orbit. A water habit can still complete from whichever number is higher. A steps habit completes at 10,000. Imported workouts show in history. Running, walking, hiking, cycling, rowing, and core count on the weekly muscle map. Strength training, yoga, and swimming are listed without a guessed muscle group.

Apple signs shortcut files. An unsigned `.shortcut` file from this repo would not install, so the steps below are the install path. They match the screen in the app. Search the Shortcuts library for the bold action names.

### Import shortcut

1. Open Shortcuts, tap +, and name it **Orbit Health Import**.
2. Add **Date**. Leave it as Current Date.
3. Add **Format Date**. Date Format: Custom. Format String: `yyyy-MM-dd`. This text is the date.
4. Add **Find Health Samples**. Type: **Steps**. For Start Date, choose Current Date, tap that date token, and choose **Start of Day**. End Date: Current Date.
5. Add **Calculate Statistics**. Health Samples: the Steps result. Statistic: **Sum**. That number is steps.
6. Repeat **Find Health Samples** and **Calculate Statistics** for the rest of the day. Use Sum unless noted.
   - Active Energy → `activeEnergy`
   - Resting Energy. If the type list says Basal Energy Burned, use that. → `restingEnergy`
   - Exercise Time, or Apple Exercise Time → `exerciseMinutes`
   - Dietary Water → `dietaryWater`
   - Resting Heart Rate, statistic **Most Recent** → `restingHeartRate`
   - Weight, or Body Mass, statistic **Most Recent** → `weight`
7. Add **Find Health Samples**. Type: **Workouts**. Same Start of Day through Current Date.
8. Add **Repeat with Each** over those workouts. Inside the repeat, add **Dictionary**. Fill each key with **Get Details of Health Sample** on the Repeat Item:
   - `type` → Workout Type
   - `start` → Start Date
   - `end` → End Date
   - `duration` → Duration
   - `calories` → Total Energy Burned, or Energy Burned
   - `distance` → Total Distance
   Leave `id` blank. The same type, start, and end update one workout. Then **Add to Variable** named `Workouts`.
9. Add **Find Health Samples**. Type: **Sleep**. Last night started yesterday, so set Start Date to Start of Day, then **Adjust Date** to subtract 1 day. End Date: Current Date.
10. Add **Repeat with Each** over the sleep samples. Inside, **Dictionary**:
    - `state` → Value. If the detail list says Category or Sleep Analysis, use that. Asleep, In Bed, and Awake are all accepted.
    - `start` → Start Date
    - `end` → End Date
    **Add to Variable** named `Sleep`.
11. Add **Dictionary** for the body:
    - `date` → the `yyyy-MM-dd` text
    - `steps`, `activeEnergy`, `restingEnergy`, `exerciseMinutes`, `restingHeartRate`, `weight`, `dietaryWater` → the statistics above
    - `workouts` → `Workouts`
    - `sleep` → `Sleep`
    Skip a key you did not collect. Numbers may be text, including commas.
12. Add **Text**. Type `Bearer`, then a space, then paste the token. No quotes.
13. Add **Get Contents of URL**. URL: the import address. Method: POST. Headers: Key `Authorization`, Value the Text action. Request Body: JSON. JSON: the dictionary from the previous step.
14. Add **Show Result** if you want to see the reply. Run it once by hand and allow each Health type iOS asks for. A good reply includes `"ok": true`.

Example body:

```json
{
  "date": "2026-10-08",
  "steps": "8,421",
  "activeEnergy": "412 kcal",
  "restingEnergy": "1,680",
  "exerciseMinutes": "32",
  "restingHeartRate": "58",
  "weight": "172.4 lb",
  "dietaryWater": "40 fl oz",
  "workouts": [
    {
      "type": "Running",
      "start": "10/8/2026, 6:15 AM",
      "end": "10/8/2026, 7:02 AM",
      "duration": "47",
      "calories": "480",
      "distance": "4.2 mi"
    }
  ],
  "sleep": [
    { "state": "Asleep", "start": "10/7/2026, 11:55 PM", "end": "10/8/2026, 10:40 AM" }
  ]
}
```

```bash
curl -sS -X POST -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-08","steps":"8421"}' \
  "$BASE/api/apple-health/import"
```

### Export shortcut

This reads today's Orbit meals and water, writes them with **Log Health Sample**, then tells Orbit which ids were written.

1. Create a shortcut named **Orbit Health Export**.
2. Add **Get Contents of URL**. URL: the export address. Method: GET. Header `Authorization` with the same Bearer text.
3. Add **Get Dictionary Value**. Key: `food`. Dictionary: the Contents of URL.
4. Add **Repeat with Each**. Inside, add four **Log Health Sample** actions. Date for each is the Repeat Item's `loggedAt`, via **Get Dictionary Value**:
   - Dietary Energy, value `calories`, unit kcal
   - Dietary Protein, value `proteinG`, unit g
   - Dietary Carbohydrates, value `carbsG`, unit g
   - Total Fat, value `fatG`, unit g
   Then **Add to Variable** named `WrittenFood`, value the Repeat Item's `id`. Add the id only after the four samples succeed.
5. Add **Get Dictionary Value**. Key: `water`. Use the original Contents of URL, not the repeat item.
6. Add **Repeat with Each**. **Log Health Sample**, type Dietary Water, value `ounces`, unit fl oz, date `loggedAt`. Then **Add to Variable** named `WrittenWater` with the id.
7. Add **Dictionary**. `food` → `WrittenFood`. `water` → `WrittenWater`. An empty list is fine when nothing was new.
8. Add **Get Contents of URL**. URL: the acknowledge address. Method: POST. Same Authorization header. Request Body: JSON, set to that dictionary. The next export leaves those items out. Sending the same ids again does nothing.

`GET /api/apple-health/export` returns `{ date, timezone, food, meals, water }` for today in Detroit. `food` is the flat list the shortcut should log: each item has `id`, `name`, `meal`, `calories`, `proteinG`, `carbsG`, `fatG`, and `loggedAt`. `meals` is the same day grouped by place, each with nested `items` and a `totals` object. Acknowledge the flat `food` ids. Items already acknowledged are omitted from `food`; `meals` still shows the whole day. Each water item has `id`, `ounces`, and `loggedAt`.

### Daily automation

1. In Shortcuts, open the Automation tab and tap +.
2. Tap **Time of Day**.
3. Set 9:00 PM, Repeat Daily, then Next.
4. Choose New Blank Automation.
5. Add **Run Shortcut** and choose Orbit Health Import.
6. Add **Run Shortcut** and choose Orbit Health Export.
7. Turn off **Ask Before Running**, then tap Done.
8. The first run still asks for Health access. After you allow it, iOS may show a notification instead of running a Health shortcut while the phone is locked. Tap that notification if it appears.

## Bot API

All bot routes live under `/api/bot` and require:

```http
Authorization: Bearer $BOT_API_TOKEN
```

The UI uses the same handlers under `/api/...` with the session cookie instead of the bearer token. Responses are JSON. Errors look like `{ "error": "message" }` with a 4xx or 5xx status.

Times: send `date` (`YYYY-MM-DD`) plus `startTime` / `endTime` / `time` (`HH:mm`) and Orbit reads them as America/Detroit wall time. Or send absolute ISO timestamps (`startsAt`, `endsAt`, `loggedAt`, `scheduledAt`, `fireAt`).

Set `BASE` to your origin.

```bash
export BASE=http://localhost:3000
export BOT_API_TOKEN=your-token
```

### Today

`GET /api/bot/today` — schedule, food totals, water, last night's sleep, habits due today, workouts, reminders, and recent activity for today in Detroit.

```bash
curl -sS -H "Authorization: Bearer $BOT_API_TOKEN" "$BASE/api/bot/today"
```

### Events

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/events` | Current Detroit week |
| GET | `/api/bot/events?date=YYYY-MM-DD` | One day |
| GET | `/api/bot/events?weekOf=YYYY-MM-DD` | Week containing that day (Monday start) |
| GET | `/api/bot/events?from=ISO&to=ISO` | Overlapping range, max 62 days |
| POST | `/api/bot/events` | Create |
| GET | `/api/bot/events/:id` | Read one |
| PATCH | `/api/bot/events/:id` | Update |
| DELETE | `/api/bot/events/:id` | Delete and cancel its pending reminder |

`type` is `class`, `work`, `study`, `workout`, `meal`, or `other`. Omit `reminderMinutesBefore` to use the default (30). Send `null` for no reminder.

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"CSE 331","type":"class","date":"2026-10-09","startTime":"14:00","endTime":"15:20","location":"STEM Building","reminderMinutesBefore":45}' \
  "$BASE/api/bot/events"
```

```bash
curl -sS -X PATCH -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location":"Wells Hall"}' \
  "$BASE/api/bot/events/EVENT_ID"
```

```bash
curl -sS -X DELETE -H "Authorization: Bearer $BOT_API_TOKEN" \
  "$BASE/api/bot/events/EVENT_ID"
```

### Food

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/food` | Today. Totals, targets, flat `logs`, grouped `meals`, `recent`, `recentMeals`, and `places` |
| GET | `/api/bot/food?date=YYYY-MM-DD` | That day |
| GET | `/api/bot/food?from=ISO&to=ISO` | Range. Flat `logs` and grouped `meals` |
| POST | `/api/bot/food` | Log one food, or a meal when the body has `items` |
| GET, PATCH, DELETE | `/api/bot/food/:id` | One flat food item (a line inside a meal) |
| GET | `/api/bot/food/recent` | Last distinct foods, for quick re-log |
| GET | `/api/bot/food/summary?date=YYYY-MM-DD` | The Monday–Sunday week containing that day |
| GET | `/api/bot/food/search?q=` | Search curated restaurant menus, then USDA and Open Food Facts. `limit` is 1–15, default 8 |
| GET | `/api/bot/food/barcode?code=` | One packaged food by UPC/EAN |
| GET | `/api/bot/meals` | Today’s meals, with `recentMeals` and `places` |
| GET | `/api/bot/meals?date=YYYY-MM-DD` | That day’s meals |
| POST | `/api/bot/meals` | Log a meal: `{ place, items: [...] }` |
| GET, PATCH, DELETE | `/api/bot/meals/:id` | One meal. PATCH may replace `items` |
| POST | `/api/bot/meals/:id/items` | Add one item. Response is the meal |
| PATCH, DELETE | `/api/bot/meals/:id/items/:itemId` | Edit or remove one item. Deleting the last item removes the meal |

`meal` on a food or a meal is the time of day: `breakfast`, `lunch`, `dinner`, or `snack`. A meal also has a `place` (`Home`, a restaurant, or whatever he typed). One meal is one event: its `totals` are the sum of its items, and the day’s `totals` are the sum of the flat `logs`. Re-log a single food by POSTing the same name and macros, or copy a row from `/recent`. Re-log a whole meal by POSTing its `place` and `items` (or a row from `recentMeals`).

`places` is `Home`, then curated restaurant brands (Panda Express first), then places he has used recently.

A body with an `items` array is a meal. The same object works on `POST /api/bot/food` and `POST /api/bot/meals`. A body with `name` and `calories` and no `items` is still a single food and is stored as a one-item meal at `Home`. Older standalone food logs are copied into that same shape.

Search results include `per100g`, `servings` (`label` and `grams`), and calories/macros for the first serving at quantity 1. Log that serving with `POST /api/bot/food`, or scale from `per100g`: nutrients × grams × quantity / 100. Sources are `restaurant` (curated menus in `data/restaurant-foods.ts`, listed first; Panda Express is the first chain), `usda` (generic and branded), and `openfoodfacts`. A restaurant hit uses the chain as `brand`. Results are cached. Barcode lookup tries Open Food Facts, then USDA branded foods. A miss is `{ "error": "No food found for that barcode" }` with status 404.

```bash
curl -sS -H "Authorization: Bearer $BOT_API_TOKEN" \
  "$BASE/api/bot/food/search?q=chicken%20burrito"

curl -sS -H "Authorization: Bearer $BOT_API_TOKEN" \
  "$BASE/api/bot/food/barcode?code=3017620422003"
```

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Chicken wrap","meal":"lunch","calories":680,"proteinG":42,"carbsG":62,"fatG":24}' \
  "$BASE/api/bot/food"
```

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"place":"McDonald'\''s","meal":"lunch","items":[{"name":"Cheeseburger","calories":300,"proteinG":15,"carbsG":32,"fatG":13},{"name":"Strawberry banana smoothie","calories":250,"proteinG":5,"carbsG":50,"fatG":3},{"name":"Large fry","calories":480,"proteinG":6,"carbsG":66,"fatG":22}]}' \
  "$BASE/api/bot/meals"
```

Each item may also include `brand`, `grams`, `quantity` (default 1), `servingLabel`, and `sourceId` (a search hit id such as `restaurant:panda-express:broccoli-beef`). Calories and macros on an item are the line total, already scaled by quantity. `GET` responses include each meal with nested items and a flat `logs` list. Daily totals use the flat list.

### Workouts

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/workouts` | `{ upcoming, history }` |
| GET | `/api/bot/workouts?from=ISO&to=ISO` | Range |
| POST | `/api/bot/workouts` | Plan a session |
| GET, PATCH, DELETE | `/api/bot/workouts/:id` | One session |

Each exercise has `sets`. A set needs `reps` or `durationSeconds` (or both). `weight` is a number and `weightUnit` is `lb` (default) or `kg`.

PATCH accepts any of: normal fields, `exercises` (replaces the list), `status` (`planned`, `done`, `skipped`), and `setCompleted: { "setId", "completed" }`. Marking `done` checks off every set and cancels the pending reminder. An exercise may include `libraryId` from the catalog below. Replacing `exercises` deletes the previous sets, so prefer the append route when you are adding one movement to a session that already has logged sets.

`POST /api/bot/workouts/:id/exercises` appends one exercise. Send `{ "libraryId": "Plank" }` and Orbit fills three holds. For a normal lift, send sets yourself or omit them for three sets of 8. The response is the full workout.

`GET /api/bot/workouts/coverage?date=YYYY-MM-DD` is the Monday–Sunday week containing that day (today in Detroit if you omit it). It returns `primary`, `secondary`, and `neglected` muscle ids for sessions marked done, plus `heat` for every muscle. `heat` counts completed sets from circuits, single exercises, and custom workouts: a primary muscle gets 1.0 and a secondary muscle gets 0.5, multiplied by that exercise's 1–5 rating divided by 5. `volume` is the weighted-set total, `bucket` is 0–4 (none, light, moderate, high, max), and 10 weighted sets fills the top bucket. `sessions` lists the workouts that contributed.

### Exercise library

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/exercises` | Catalog. Optional `q`, `muscle`, `equipment`, `limit` (1–200, default 40) |
| GET | `/api/bot/exercises/:id` | One exercise, with steps, mistakes, and image URLs |

`muscle` matches primary or secondary. With a muscle, the list is best-first by that muscle's 1–5 rating (`sort=rating` does the same and requires `muscle`; `sort=name` stays alphabetical). Each exercise includes `ratings`, keyed by muscle id, with `score` (1–5) and `why` (one line). 5 is a top-tier movement for that muscle and 1 is minimal involvement. Scores describe the exercise, not the home gym, so a barbell bench stays a 5 for the chest even when the profile has no barbell. `equipment` is `bodyweight`, `dumbbell`, `barbell`, `machine`, `cable`, or `other`. The list follows the home equipment profile in settings: bodyweight (also when the push-up board is owned) and dumbbells. Gear you do not own returns an empty list. Add `all=1` to see the full catalog. A push-up detail includes `board` (blue chest, red shoulders, yellow back, green triceps) when the board is owned. Circuit lists include `targetRating` (`average` and `muscle`) for the circuit's target muscles.

Muscle ids: `upper_abs`, `lower_abs`, `obliques`, `biceps`, `triceps`, `forearms`, `front_delts`, `side_delts`, `rear_delts`, `upper_chest`, `mid_chest`, `lower_chest`, `lats`, `traps`, `mid_back`, `lower_back`, `glutes`, `quads`, `hamstrings`, `calves`, `adductors`, `abductors`, `hip_flexors`.

```bash
curl -sS -H "Authorization: Bearer $BOT_API_TOKEN" \
  "$BASE/api/bot/exercises?muscle=lower_abs&sort=rating"

curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"libraryId":"Hanging_Leg_Raise"}' \
  "$BASE/api/bot/workouts/WORKOUT_ID/exercises"
```

The same routes exist under `/api/exercises` for the signed-in app. Images are start and finish frames (there is no GIF in this dataset). The app crossfades them. Each exercise also links to a YouTube search for a longer tutorial.

Form photos and the written steps come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, released under the [Unlicense](https://unlicense.org/) (public domain). Orbit does not vendor the JPEGs. It loads them from jsDelivr pinned to commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. The fine muscle groups (upper abs versus lower abs, front versus rear delts, and so on) are Orbit's labels, derived from that dataset's coarser muscle list plus the exercise name. The body diagram adapts the anatomical SVG paths from [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter) by ELABBASSI Hicham (MIT License, commit `8ed39ac2ae9cb46fb79d77eedec7e5b029a75174`). Orbit splits those shapes into the finer groups above — upper, mid, and lower chest, the three delt heads, separate rectus segments, and lats versus mid back.

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Push",
    "date": "2026-10-12",
    "time": "18:00",
    "reminderMinutesBefore": 30,
    "exercises": [
      {"name": "Bench press", "sets": [{"reps": 8, "weight": 95}, {"reps": 8, "weight": 95}]},
      {"name": "Plank", "sets": [{"durationSeconds": 40}]}
    ]
  }' \
  "$BASE/api/bot/workouts"
```

```bash
curl -sS -X PATCH -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"setCompleted": {"setId": "SET_ID", "completed": true}}' \
  "$BASE/api/bot/workouts/WORKOUT_ID"
```

### Circuits

Suggested home flows built from the exercise library. Each one has a beginner and an intermediate prescription (reps or timed work, rest, and default rounds).

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/circuits` | List. Optional `?muscle=` keeps circuits whose target muscles include that id. A circuit is omitted unless its gear is in the home equipment profile |
| GET | `/api/bot/circuits/:id` | One circuit, with ordered exercises, steps, images, and both levels |
| POST | `/api/bot/circuits/:id/schedule` | Plan it on a day. Body is `{ "date": "YYYY-MM-DD", "time": "HH:MM" }` |

`difficulty` (`beginner` or `intermediate`) and `rounds` (1–5) are optional. Beginner defaults to 2 rounds, intermediate to 3. The new workout uses the usual reminder (30 minutes before, unless settings say otherwise) and shows up on Today and Schedule.

The signed-in app has the same list, detail, and schedule routes under `/api/circuits`. `POST /api/circuits/:id/complete` with the same optional `difficulty` and `rounds` logs the flow as a done workout, with every set checked, so it counts on the weekly muscle map and a workout habit.

During rest the player shows the next exercise: name, dose, board or dumbbell note, the demo frames, and the how-to. The countdown and the pause, skip, and +15s controls stay on screen. Cues are synthesized in the browser: a rising 3-2-1 in the last three seconds of rest and timed work, a short chime when a set finishes, and a longer one when the circuit ends. Start unlocks audio. The cues are short and use an ambient session so other music keeps playing. The player’s sound switch and volume are `circuitAudio`.

```bash
curl -sS -H "Authorization: Bearer $BOT_API_TOKEN" \
  "$BASE/api/bot/circuits?muscle=lower_abs"

curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-12","time":"18:00","difficulty":"beginner","rounds":2}' \
  "$BASE/api/bot/circuits/lower-abs/schedule"
```

### Custom workouts and logged sessions

A saved workout is a named straight-set session (every set of an exercise, then the next exercise). It is not a circuit and it is not a planned day until you schedule it. Logging a finished single exercise or custom workout creates a done workout, so it shows in history and counts toward the weekly muscle map and a workout habit.

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/routines` | Saved custom workouts, newest first |
| POST | `/api/bot/routines` | Save one. Body is `{ "title", "restSeconds", "exercises" }` |
| GET | `/api/bot/routines/:id` | One saved workout |
| PATCH | `/api/bot/routines/:id` | Replace the title, rest, and exercises |
| DELETE | `/api/bot/routines/:id` | Delete a saved workout |
| POST | `/api/bot/routines/:id/schedule` | Plan it on a day. Body is `{ "date": "YYYY-MM-DD", "time": "HH:MM" }` |
| GET | `/api/bot/sessions` | Completed sessions, newest first. Optional `?limit=` (1–100) |
| POST | `/api/bot/sessions` | Log a finished session |
| GET | `/api/bot/sessions/:id` | One completed session |

Each exercise on a saved workout is `{ "libraryId", "name", "sets", "reps" or "durationSeconds", "weight", "weightUnit" }`. Use reps or a hold time, not both. `weight` can be null for bodyweight. A logged session uses the same set shape as a planned workout (`reps`, `weight`, `durationSeconds`) and may differ per set. `durationSeconds` on the session is how long the workout took.

The signed-in app uses the same paths under `/api/routines` and `/api/sessions`.

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Push","restSeconds":60,"exercises":[{"libraryId":"Pushups","name":"Pushups","sets":3,"reps":12,"weight":null},{"libraryId":"Alternate_Hammer_Curl","name":"Alternate Hammer Curl","sets":3,"reps":8,"weight":15}]}' \
  "$BASE/api/bot/routines"

curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-12","time":"18:00"}' \
  "$BASE/api/bot/routines/ROUTINE_ID/schedule"

curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Pushups","durationSeconds":480,"exercises":[{"name":"Pushups","libraryId":"Pushups","sets":[{"reps":12},{"reps":10}]}]}' \
  "$BASE/api/bot/sessions"
```

### Reminders

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/reminders` | `{ upcoming, recentSent }` |
| POST | `/api/bot/reminders` | Custom reminder |
| GET, PATCH, DELETE | `/api/bot/reminders/:id` | One reminder |

POST creates `kind: "custom"`. Event, workout, and meal reminders are created by those records and by the cron job. DELETE on a meal reminder cancels it (so cron will not recreate that same slot). DELETE on an event or workout reminder also clears that record's reminder minutes.

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Pack the gym bag", "body": "Shoes and a lock.", "date": "2026-10-09", "time": "21:00"}' \
  "$BASE/api/bot/reminders"
```

### Activity feed

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/feed?limit=40` | Newest first. `limit` max 200 |
| POST | `/api/bot/feed` | `{ "message", "author" }` — author defaults to `Bot` |

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"author": "Scheduler", "message": "Friday shift starts at 4:30 so there is a cushion after class."}' \
  "$BASE/api/bot/feed"
```

### Push from a bot

`POST /api/bot/notify`

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Coach", "body": "Push day in 30 minutes", "url": "/workouts"}' \
  "$BASE/api/bot/notify"
```

`url` must be an in-app path such as `/schedule` or `/workouts/ID` (not a full URL). The response is `{ delivered, failed, removed, subscriptions, configured }`. `delivered: 0` with `subscriptions: 0` means Robert has not enabled notifications yet. HTTP 503 means the VAPID keys are missing.

### Settings

`GET /api/bot/settings` and `PATCH /api/bot/settings`.

```bash
curl -sS -X PATCH -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targets": {"calories": 2400, "proteinG": 150, "carbsG": 280, "fatG": 75}}' \
  "$BASE/api/bot/settings"
```

`mealReminders` is a list of `{ id, label, time, enabled }`. Changing it drops unsent meal reminders so the next cron run recreates them. Timezone stays `America/Detroit`.

`waterGoalOz` is the daily water goal. Default 100.

`waterReminders` is `{ enabled, times }`. Times are `HH:mm`. When enabled, every time must be 11:00 or later so nudges stay in awake hours. `sleepReminder` is `{ enabled, time }` for a wind-down, late evening (20:00 or later) or after midnight through 04:00. `habitReminder` is `{ enabled, time }` at 17:00 or later. It fires only when a habit marked for a reminder is still open that day.

Changing any of those drops unsent water, sleep, and habit reminders so the next cron run recreates them. If today's water goal is already met, today's water nudges are cleared.

`equipment` is `{ "gear": ["bodyweight", "pushup_board", "dumbbells"], "dumbbellLb": 15, "dumbbellCount": 2 }`. That is the default when the key is missing, so an older settings row picks it up with no migration. `gear` may be any subset of those three ids. Circuit lists and the exercise library follow it. Dumbbell stations note the weight and a 2-second lower. Push-up stations that use the board note the color zone.

`circuitAudio` is `{ "enabled": true, "volume": 70 }`. Volume is 0–100. A missing key uses that default. The guided player reads and updates it.

### Water

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/water` | Today: `goalOz`, `totalOz`, `logs`, and the Monday–Sunday week |
| GET | `/api/bot/water?date=YYYY-MM-DD` | That Detroit day |
| POST | `/api/bot/water` | `{ "ounces", "date"?, "time"? }`. Omit the clock to use now |
| DELETE | `/api/bot/water/:id` | Remove one pour |

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ounces":16}' \
  "$BASE/api/bot/water"
```

### Sleep

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/sleep` | Last night, plus this week and the trend against last week |
| GET | `/api/bot/sleep?date=YYYY-MM-DD` | The morning you woke up |
| POST | `/api/bot/sleep` | Log or replace that morning |
| DELETE | `/api/bot/sleep/:id` | Remove one night |

Send `bedtime` and `wakeTime` (`HH:mm`) with `date` as the wake date. A bedtime later on the clock than wake time is the previous evening (`23:30` to `11:00`). A bedtime earlier on the clock is the same date (`01:30` to `11:00`), which is the usual night-owl case. Or send `durationMinutes` instead of the clocks. `quality` is 1–5 and optional.

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-08","bedtime":"01:30","wakeTime":"11:00","quality":4}' \
  "$BASE/api/bot/sleep"
```

### Habits

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/habits` | Every habit, with `currentStreak`, `bestStreak`, and whether today is done |
| GET | `/api/bot/habits?date=YYYY-MM-DD` | Same, with `done` for that day |
| POST | `/api/bot/habits` | Create |
| GET | `/api/bot/habits/:id?month=YYYY-MM` | One habit and that month's calendar |
| PATCH | `/api/bot/habits/:id` | Rename, reschedule, or change auto-complete |
| DELETE | `/api/bot/habits/:id` | Delete the habit and its checks |
| POST | `/api/bot/habits/:id/check` | `{ "done": true, "date"? }` |

`days` is an array of weekdays, Sunday `0` through Saturday `6`. Omit it, or send `null`, for every day. `auto` is `protein`, `water`, `workout`, `steps`, or `null`. Protein, water, and a finished workout fill in from Orbit. `steps` fills in at 10,000 Apple Health steps. Water also counts dietary water imported from Health when that number is higher than the Orbit log. Unchecking an auto habit stays off (`source: "skip"`) even if the goal is still met. `remind: true` includes the habit in the evening reminder.

An unfinished today does not break `currentStreak`. Days off the schedule do not break it either.

```bash
curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Stretch","remind":true}' \
  "$BASE/api/bot/habits"

curl -sS -X POST -H "Authorization: Bearer $BOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"done":true}' \
  "$BASE/api/bot/habits/HABIT_ID/check"
```

## Tests

`npm test` uses `postgres://orbit:orbit@localhost:5432/orbit_test` and will not touch the dev database. It covers Detroit time (including the spring-forward change), after-midnight sleep, habit streaks, Apple Health shortcut dates and idempotent imports, session cookies, passcode and bot auth, event reminders, food totals, workout completion, meal-reminder creation, cron auth, and VAPID request signing. Push delivery is exercised with a fake subscription and a closed local endpoint, not a real iPhone.
