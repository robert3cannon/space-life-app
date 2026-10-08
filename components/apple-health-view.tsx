"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { formatLongDate, formatTime, formatWhen } from "@/lib/format";
import { getZonedParts } from "@/lib/time";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Summary = {
  days: number;
  workouts: number;
  sleepNights: number;
  sleepSkippedManual: number;
  weights: number;
  latestDate: string | null;
  steps: number | null;
  activeKcal: number | null;
  restingKcal: number | null;
  exerciseMinutes: number | null;
  restingHr: number | null;
  dietaryWaterOz: number | null;
};

type Status = {
  token: string | null;
  tokenCreatedAt: string | null;
  envTokenConfigured: boolean;
  lastSync: { syncedAt: string; summary: Summary } | null;
  weights: { measuredAt: string; pounds: number }[];
};

function poundsLabel(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function summaryLines(summary: Summary) {
  const lines = [
    summary.days === 1 ? "1 day of totals" : `${summary.days} days of totals`,
    summary.workouts === 1 ? "1 workout" : `${summary.workouts} workouts`,
    summary.sleepNights === 1 ? "1 sleep morning filled" : `${summary.sleepNights} sleep mornings filled`,
  ];
  if (summary.sleepSkippedManual > 0) {
    lines.push(
      summary.sleepSkippedManual === 1
        ? "1 morning left as you logged it"
        : `${summary.sleepSkippedManual} mornings left as you logged them`,
    );
  }
  lines.push(summary.weights === 1 ? "1 weight sample" : `${summary.weights} weight samples`);
  if (summary.latestDate) {
    const bits = [`Latest day ${formatLongDate(summary.latestDate)}`];
    if (summary.steps != null) bits.push(`${summary.steps.toLocaleString("en-US")} steps`);
    if (summary.activeKcal != null) bits.push(`${Math.round(summary.activeKcal)} active kcal`);
    if (summary.restingKcal != null) bits.push(`${Math.round(summary.restingKcal)} resting kcal`);
    if (summary.exerciseMinutes != null) bits.push(`${Math.round(summary.exerciseMinutes)} exercise min`);
    if (summary.restingHr != null) bits.push(`resting HR ${Math.round(summary.restingHr)}`);
    if (summary.dietaryWaterOz != null) bits.push(`${poundsLabel(summary.dietaryWaterOz)} oz water`);
    lines.push(bits.join(" · "));
  }
  return lines;
}

function WeightChart({ weights }: { weights: Status["weights"] }) {
  if (weights.length < 2) return null;
  const values = weights.map((weight) => weight.pounds);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.5, max - min);
  const width = 320;
  const height = 112;
  const pad = 10;
  const points = weights
    .map((weight, index) => {
      const x = pad + (index / (weights.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (weight.pounds - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const first = weights[0];
  const last = weights[weights.length - 1];
  return (
    <svg className="trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Weight from ${poundsLabel(first.pounds)} to ${poundsLabel(last.pounds)} pounds`}>
      <polyline points={points} />
    </svg>
  );
}

export function AppleHealthView() {
  const status = useLoad<Status>("/api/apple-health/status");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const importUrl = origin ? `${origin}/api/apple-health/import` : "";
  const exportUrl = origin ? `${origin}/api/apple-health/export` : "";
  const ackUrl = origin ? `${origin}/api/apple-health/export/ack` : "";

  async function copy(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`);
    } catch {
      toast("Select the field and copy it");
    }
  }

  async function tokenAction(action: "generate" | "revoke") {
    setBusy(true);
    try {
      await api("/api/apple-health/token", { method: "POST", body: JSON.stringify({ action }) });
      await status.reload();
      toast(action === "revoke" ? "Token revoked" : "New token ready");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update the token");
    } finally {
      setBusy(false);
    }
  }

  const data = status.data;

  return (
    <main className="page">
      <PageTitle title="Apple Health" />
      <p className="kicker">Settings</p>
      <h1 className="display">Apple Health</h1>
      <p className="sub">A website cannot read HealthKit. Shortcuts on your iPhone can. Orbit accepts a daily batch and can hand food and water logged today back.</p>
      <Link href="/settings" className="text-btn">All settings</Link>

      <section className="card anchor" id="start" style={{ marginTop: 8 }}>
        <h2 style={{ marginTop: 0 }}>Start here</h2>
        <ol className="steps">
          <li>Copy the sync token.</li>
          <li>Build the import shortcut and run it once by hand.</li>
          <li>Build the export shortcut, then a Time of Day automation that runs both each evening.</li>
        </ol>
      </section>
      <nav className="chips jump-row" aria-label="Apple Health sections">
        <a className="chip" href="#token">Token</a>
        <a className="chip" href="#import">Import</a>
        <a className="chip" href="#export">Export</a>
        <a className="chip" href="#automation">Daily run</a>
      </nav>

      {status.loading && !data ? <Loading /> : null}
      {status.error ? <ErrorNote message={status.error} onRetry={status.reload} /> : null}

      {data ? (
        <>
          <section className="card anchor" id="token" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Sync token</h2>
            <p className="muted">Paste this into the Authorization header in the shortcut, after the word Bearer and a space. Regenerate if you shared it. Revoke to turn the phone token off. A token set on the server as HEALTH_SYNC_TOKEN keeps working either way.</p>
            {data.envTokenConfigured ? <p className="faint">A server token is also accepted.</p> : null}
            {data.token ? (
              <>
                <label className="field">
                  <span>Device token{data.tokenCreatedAt ? ` · ${formatWhen(data.tokenCreatedAt)}` : ""}</span>
                  <input className="token-input" readOnly value={data.token} aria-label="Apple Health sync token" />
                </label>
                <div className="stack">
                  <button className="btn" type="button" disabled={busy} onClick={() => void copy(data.token || "", "Token")}>Copy token</button>
                  <button className="btn-ghost" type="button" disabled={busy} onClick={() => void tokenAction("generate")}>Regenerate</button>
                  <button className="btn-danger" type="button" disabled={busy} onClick={() => void tokenAction("revoke")}>Revoke</button>
                </div>
              </>
            ) : (
              <button className="btn" type="button" disabled={busy} onClick={() => void tokenAction("generate")}>Generate a token</button>
            )}
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Last sync</h2>
            {data.lastSync ? (
              <>
                <p className="stat">{formatWhen(data.lastSync.syncedAt)}</p>
                <ul className="steps">
                  {summaryLines(data.lastSync.summary).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Nothing received yet. After the import shortcut runs, this card lists the day, workouts, sleep, and weight it stored.</p>
            )}
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Weight</h2>
            {data.weights.length ? (
              <>
                <WeightChart weights={data.weights} />
                <p className="stat" style={{ marginBottom: 0 }}>{poundsLabel(data.weights[data.weights.length - 1].pounds)} lb</p>
                <p className="faint">
                  {formatLongDate(getZonedParts(new Date(data.weights[data.weights.length - 1].measuredAt)).date)}
                  {" · "}
                  {formatTime(data.weights[data.weights.length - 1].measuredAt)}
                </p>
                <ul className="steps">
                  {data.weights.slice(-8).map((weight) => (
                    <li key={weight.measuredAt}>
                      {formatLongDate(getZonedParts(new Date(weight.measuredAt)).date)} · {poundsLabel(weight.pounds)} lb
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Weight samples from the import shortcut show up here.</p>
            )}
          </section>
        </>
      ) : null}

      <section className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>How Orbit uses the batch</h2>
        <ul className="steps">
          <li>Steps and active calories show on Today. Sending the same day again updates those numbers. It does not add a second copy.</li>
          <li>Sleep fills an empty morning, or a morning that already came from Apple Health. A night you logged yourself stays. Clear that morning on the Sleep screen if you want the next sync to replace it. Asleep segments are used when Health sends them. In-bed time is the fallback.</li>
          <li>Workouts land in history as done. Running, walking, hiking, cycling, rowing, and core count toward the weekly muscle map. Strength training is listed without a guessed muscle group.</li>
          <li>Dietary water is stored beside the water log, not inside it, so exporting Orbit water does not double what Health already has. A water habit can still complete from whichever source is higher. A steps habit completes at 10,000.</li>
          <li>Times without a timezone are read as America/Detroit. 1:30 AM in October is Eastern Daylight Time, not UTC.</li>
        </ul>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Addresses</h2>
        <p className="muted">Use these in Get Contents of URL. They match this install.</p>
        <Address label="Import" value={importUrl} onCopy={() => void copy(importUrl, "Import address")} />
        <Address label="Export" value={exportUrl} onCopy={() => void copy(exportUrl, "Export address")} />
        <Address label="Acknowledge" value={ackUrl} onCopy={() => void copy(ackUrl, "Acknowledge address")} />
      </section>

      <section className="card anchor" id="import" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Import shortcut</h2>
        <p className="muted">Apple signs shortcut files, and an unsigned file will not install. Build this once in Shortcuts. Action names below are the ones you search for.</p>
        <ol className="steps">
          <li>Open Shortcuts, tap +, and name it Orbit Health Import.</li>
          <li>Add <strong>Date</strong>. Leave it as Current Date.</li>
          <li>Add <strong>Format Date</strong>. Date Format: Custom. Format String: <strong>yyyy-MM-dd</strong>. This text is the date.</li>
          <li>Add <strong>Find Health Samples</strong>. Type: <strong>Steps</strong>. For Start Date, choose Current Date, tap that date token, and choose <strong>Start of Day</strong>. End Date: Current Date.</li>
          <li>Add <strong>Calculate Statistics</strong>. Health Samples: the Steps result. Statistic: <strong>Sum</strong>. That number is steps.</li>
          <li>
            Repeat Find Health Samples and Calculate Statistics for the rest of the day. Use Sum unless noted.
            <ul className="detail">
              <li>Active Energy → activeEnergy</li>
              <li>Resting Energy. If the type list says Basal Energy Burned, use that. → restingEnergy</li>
              <li>Exercise Time, or Apple Exercise Time → exerciseMinutes</li>
              <li>Dietary Water → dietaryWater</li>
              <li>Resting Heart Rate, statistic <strong>Most Recent</strong> → restingHeartRate</li>
              <li>Weight, or Body Mass, statistic <strong>Most Recent</strong> → weight</li>
            </ul>
          </li>
          <li>Add <strong>Find Health Samples</strong>. Type: <strong>Workouts</strong>. Same Start of Day through Current Date.</li>
          <li>
            Add <strong>Repeat with Each</strong> over those workouts. Inside the repeat, add <strong>Dictionary</strong>. Fill each key with <strong>Get Details of Health Sample</strong> on the Repeat Item:
            <ul className="detail">
              <li>type → Workout Type</li>
              <li>start → Start Date</li>
              <li>end → End Date</li>
              <li>duration → Duration</li>
              <li>calories → Total Energy Burned, or Energy Burned</li>
              <li>distance → Total Distance</li>
            </ul>
            Leave id blank. The same type, start, and end update one workout instead of inserting another. Then <strong>Add to Variable</strong> named Workouts.
          </li>
          <li>Add <strong>Find Health Samples</strong>. Type: <strong>Sleep</strong>. Last night started yesterday, so set Start Date to Start of Day, then <strong>Adjust Date</strong> to subtract 1 day. End Date: Current Date.</li>
          <li>
            Add <strong>Repeat with Each</strong> over the sleep samples. Inside, <strong>Dictionary</strong>:
            <ul className="detail">
              <li>state → Value. If the detail list says Category or Sleep Analysis, use that. Asleep, In Bed, and Awake are all accepted.</li>
              <li>start → Start Date</li>
              <li>end → End Date</li>
            </ul>
            <strong>Add to Variable</strong> named Sleep.
          </li>
          <li>
            Add <strong>Dictionary</strong> for the body:
            <ul className="detail">
              <li>date → the yyyy-MM-dd text</li>
              <li>steps, activeEnergy, restingEnergy, exerciseMinutes, restingHeartRate, weight, dietaryWater → the statistics above</li>
              <li>workouts → Workouts</li>
              <li>sleep → Sleep</li>
            </ul>
            Skip a key if you did not collect it. Numbers may be text, including commas.
          </li>
          <li>Add <strong>Text</strong>. Type Bearer, then a space, then paste the token. No quotes.</li>
          <li>Add <strong>Get Contents of URL</strong>. URL: the import address. Method: POST. Headers: Key <strong>Authorization</strong>, Value the Text action. Request Body: JSON. JSON: the dictionary from the previous step.</li>
          <li>Add <strong>Show Result</strong> if you want to see the reply. Run it once by hand and allow each Health type iOS asks for. A good reply includes ok true.</li>
        </ol>
      </section>

      <section className="card anchor" id="export" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Export shortcut</h2>
        <p className="muted">This reads meals and water logged in Orbit today, writes them with Log Health Sample, then tells Orbit which ids were written.</p>
        <ol className="steps">
          <li>Create a shortcut named Orbit Health Export.</li>
          <li>Add <strong>Get Contents of URL</strong>. URL: the export address. Method: GET. Header <strong>Authorization</strong> with the same Bearer text.</li>
          <li>Add <strong>Get Dictionary Value</strong>. Key: <strong>food</strong>. Dictionary: the Contents of URL.</li>
          <li>
            Add <strong>Repeat with Each</strong>. Inside, add four <strong>Log Health Sample</strong> actions. Date for each is loggedAt on the Repeat Item, via <strong>Get Dictionary Value</strong>:
            <ul className="detail">
              <li>Dietary Energy, value calories, unit kcal</li>
              <li>Dietary Protein, value proteinG, unit g</li>
              <li>Dietary Carbohydrates, value carbsG, unit g</li>
              <li>Total Fat, value fatG, unit g</li>
            </ul>
            Then <strong>Add to Variable</strong> named WrittenFood, value the id on the Repeat Item. Add the id only after the four samples succeed.
          </li>
          <li>Add <strong>Get Dictionary Value</strong>. Key: <strong>water</strong>. Use the original Contents of URL, not the repeat item.</li>
          <li>Add <strong>Repeat with Each</strong>. <strong>Log Health Sample</strong>, type Dietary Water, value ounces, unit fl oz, date loggedAt. Then <strong>Add to Variable</strong> named WrittenWater with the id.</li>
          <li>Add <strong>Dictionary</strong>. food → WrittenFood. water → WrittenWater. An empty list is fine when nothing was new.</li>
          <li>Add <strong>Get Contents of URL</strong>. URL: the acknowledge address. Method: POST. Same Authorization header. Request Body: JSON, set to that dictionary. The next export leaves those items out. Sending the same ids again does nothing.</li>
        </ol>
      </section>

      <section className="card anchor" id="automation" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Run it every day</h2>
        <ol className="steps">
          <li>In Shortcuts, open the Automation tab and tap +.</li>
          <li>Tap <strong>Time of Day</strong>.</li>
          <li>Set 9:00 PM, Repeat Daily, then Next.</li>
          <li>Choose New Blank Automation.</li>
          <li>Add <strong>Run Shortcut</strong> and choose Orbit Health Import.</li>
          <li>Add <strong>Run Shortcut</strong> and choose Orbit Health Export.</li>
          <li>Turn off <strong>Ask Before Running</strong>, then tap Done.</li>
          <li>The first run still asks for Health access. After you allow it, iOS may show a notification instead of running a Health shortcut while the phone is locked. Tap that notification if it appears.</li>
        </ol>
      </section>
    </main>
  );
}

function Address({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label className="field">
        <span>{label}</span>
        <input className="token-input" readOnly value={value} aria-label={`${label} address`} />
      </label>
      <button className="btn-ghost" type="button" disabled={!value} onClick={onCopy}>Copy {label.toLowerCase()} address</button>
    </div>
  );
}
