# Orbit

Orbit is a personal life manager for Robert, a college student in East Lansing. It is a mobile-first installable web app: today's schedule, food against daily targets, workouts, reminders, and real Web Push to an iPhone. Scheduler and coach bots read and write the same data through a bearer-token API.

Times are **America/Detroit** (Eastern). The sample week assumes late starts (breakfast around 11:30), afternoon classes, evening shifts, and blocks as late as 11pm. Nothing in this repo is a real password, push key, or personal record. The example classes, cafe shifts, and meals are fiction.

## Stack

- Next.js (App Router) and React, deployed on Vercel
- Postgres (Neon, Vercel Postgres, or any Postgres `DATABASE_URL`) via Drizzle and `postgres`
- Web Push with VAPID (`web-push`) and a service worker
- Vercel Cron hits `/api/cron/dispatch` to send due reminders

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
| `DATABASE_URL` | yes | Postgres connection string. On Neon, use the **pooled** URL. The app disables prepared statements so pooled connections work. |
| `APP_PASSWORD` | yes | The only UI passcode. Use a long random string. There is no signup. |
| `SESSION_SECRET` | yes | HMAC key for the `orbit_session` cookie. `openssl rand -base64 32` |
| `BOT_API_TOKEN` | yes | Bearer token for `/api/bot/*`. |
| `VAPID_PUBLIC_KEY` | for push | URL-safe base64 public key. |
| `VAPID_PRIVATE_KEY` | for push | URL-safe base64 private key. Never commit this. |
| `VAPID_SUBJECT` | for push | `mailto:you@example.com` or an `https://` contact URL. Required by the Web Push spec. |
| `CRON_SECRET` | for reminders | Bearer token for `/api/cron/dispatch`. Vercel sends it automatically when this variable is set. |
| `USER_NAME` | no | Greeting name. Defaults to Robert. |
| `ALLOW_SEED` | no | Set to `1` to allow `npm run seed` against production. |
| `USDA_API_KEY` | no | FoodData Central key for food search and barcodes. If unset, the app uses `DEMO_KEY`, which is heavily rate limited. Get a free key at [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup). |

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
| `npm test` | Timezone, session, API, reminder dispatch, and VAPID signing tests |
| `npm run icons` | Regenerate the PWA icons and splash screens |

On Vercel the install uses `vercel-build`, which migrates and then builds. Seed is never part of deploy, so a new production database starts empty.

## Deploy to Vercel

1. Create a Postgres database (Neon or Vercel Postgres) and copy the pooled connection string.
2. Import this GitHub repo into Vercel. Framework preset: Next.js.
3. Set every required variable above. `vercel-build` runs migrations during deploy, so `DATABASE_URL` must be present at build time.
4. `vercel.json` registers a cron: `GET /api/cron/dispatch` every 5 minutes. Vercel adds `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
5. Deploy, open the HTTPS URL, sign in, and install it on the iPhone (below).

**Vercel Hobby cron only runs once per day**, which is too coarse for "30 minutes before class." On Hobby, point any external scheduler (a second cron host you control) at the same URL every few minutes:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_APP.vercel.app/api/cron/dispatch
```

Pro (and any scheduler that can call that URL) can use the 5-minute schedule already in `vercel.json`. Each run creates upcoming meal reminders if they are missing, sends every pending reminder whose time has arrived, and drops push subscriptions the browser has expired (HTTP 404 or 410). If every subscription fails for a temporary reason, the reminder stays pending and the next run tries again.

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

- **Today.** Greeting, the current or next block, today's schedule, calories and macros against targets, water and last night's sleep, habits due today, today's workout (or the next one), pending reminders, and the latest bot notes.
- **Schedule.** Day and week views. Create, edit, and delete blocks of type class, work, study, workout, meal, or other. Optional reminder before the start.
- **Food.** Log meals with calories and protein, carbs, and fat. Search USDA FoodData Central and Open Food Facts by name, scale a serving, or scan a package barcode with the iPhone camera. Daily totals, a weekly chart, editable targets, manual entry, and one-tap re-log of recent foods.
- **Train.** Plan exercises with sets (reps and weight in pounds, or a duration). Check sets off, mark the session done, and scroll history. The exercise library (100+ movements) shows the muscles each one trains, a front and back body map, and a two-frame form demo. Tap a muscle to list what hits it. A session and the current week each roll those muscles up so you can see what you trained and what you skipped.
- **Water and sleep.** Water has a daily ounce goal (default 100, editable) and quick adds of 8, 16, or 24 oz, plus a custom amount. Sleep is logged as bedtime and wake time, or as a duration, with an optional 1–5 quality. A bedtime after midnight still belongs to the morning you woke up, which is the usual case when wake time is around 11:00 AM. Both have a weekly chart.
- **Habits.** Daily habits, or specific weekdays. Check them off on Today. Current and best streaks skip an unfinished today and skip days that are not scheduled. Protein, water, and a finished workout can fill a habit in from data already in the app. Each habit has a month calendar. An optional evening reminder covers the ones still open.
- **Reminders.** Custom reminders, plus automatic ones for events, workouts, and meals (default 11:30 breakfast, 3:00 lunch, 8:00 dinner — late on purpose). Optional water nudges only at 11:00 or later, a wind-down that can be after midnight, and an evening habit reminder.
- **Activity.** Short notes from you or from bots.
- **Settings.** Targets, the water goal, meal and wellness reminder times, and notification setup.

The UI is one account. Middleware redirects everyone else to `/login`. The session cookie is HTTP-only, `SameSite=Lax`, and `Secure` in production.

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
| GET | `/api/bot/food` | Today, with totals, targets, and recent foods |
| GET | `/api/bot/food?date=YYYY-MM-DD` | That day |
| GET | `/api/bot/food?from=ISO&to=ISO` | Range |
| POST | `/api/bot/food` | Log. Omit `loggedAt` to use now |
| GET, PATCH, DELETE | `/api/bot/food/:id` | One entry |
| GET | `/api/bot/food/recent` | Last distinct foods, for quick re-log |
| GET | `/api/bot/food/summary?date=YYYY-MM-DD` | The Monday–Sunday week containing that day |
| GET | `/api/bot/food/search?q=` | Search USDA and Open Food Facts. `limit` is 1–15, default 8 |
| GET | `/api/bot/food/barcode?code=` | One packaged food by UPC/EAN |

`meal` is `breakfast`, `lunch`, `dinner`, or `snack`. Re-log by POSTing the same name and macros again (or copy a row from `/recent`).

Search results include `per100g`, `servings` (`label` and `grams`), and calories/macros for the first serving at quantity 1. Log that serving with `POST /api/bot/food`, or scale from `per100g`: nutrients × grams × quantity / 100. Sources are `usda` (generic and branded, including restaurant items when USDA has them) and `openfoodfacts`. Results are cached. Barcode lookup tries Open Food Facts, then USDA branded foods. A miss is `{ "error": "No food found for that barcode" }` with status 404.

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

`GET /api/bot/workouts/coverage?date=YYYY-MM-DD` is the Monday–Sunday week containing that day (today in Detroit if you omit it). It returns `primary`, `secondary`, and `neglected` muscle ids for sessions marked done.

### Exercise library

| Method | Path | |
| --- | --- | --- |
| GET | `/api/bot/exercises` | Catalog. Optional `q`, `muscle`, `equipment`, `limit` (1–200, default 40) |
| GET | `/api/bot/exercises/:id` | One exercise, with steps, mistakes, and image URLs |

`muscle` matches primary or secondary. Primary hits are listed first. `equipment` is `bodyweight`, `dumbbell`, `barbell`, `machine`, `cable`, or `other`.

Muscle ids: `upper_abs`, `lower_abs`, `obliques`, `biceps`, `triceps`, `forearms`, `front_delts`, `side_delts`, `rear_delts`, `upper_chest`, `mid_chest`, `lower_chest`, `lats`, `traps`, `mid_back`, `lower_back`, `glutes`, `quads`, `hamstrings`, `calves`, `adductors`, `abductors`, `hip_flexors`.

```bash
curl -sS -H "Authorization: Bearer $BOT_API_TOKEN" \
  "$BASE/api/bot/exercises?muscle=lower_abs"

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

`days` is an array of weekdays, Sunday `0` through Saturday `6`. Omit it, or send `null`, for every day. `auto` is `protein`, `water`, `workout`, or `null`. Those fill in from food, water, and finished workouts. Unchecking an auto habit stays off (`source: "skip"`) even if the goal is still met. `remind: true` includes the habit in the evening reminder.

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

`npm test` uses `postgres://orbit:orbit@localhost:5432/orbit_test` and will not touch the dev database. It covers Detroit time (including the spring-forward change), after-midnight sleep, habit streaks, session cookies, passcode and bot auth, event reminders, food totals, workout completion, meal-reminder creation, cron auth, and VAPID request signing. Push delivery is exercised with a fake subscription and a closed local endpoint, not a real iPhone.
