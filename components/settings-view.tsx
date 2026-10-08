"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { AppSettings } from "@/lib/types";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type PushStatus = { configured: boolean; publicKey: string | null; subscriptions: number };

function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function SettingsView() {
  const settings = useLoad<AppSettings>("/api/settings");
  const [push, setPush] = useState<PushStatus | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [busy, setBusy] = useState(false);
  const [targets, setTargets] = useState({ calories: "", proteinG: "", carbsG: "", fatG: "" });
  const [meals, setMeals] = useState<AppSettings["mealReminders"]>([]);
  const toast = useToast();

  useEffect(() => {
    setIos(isIos());
    setInstalled(isStandalone());
    if ("Notification" in window) setPermission(Notification.permission);
    api<PushStatus>("/api/push/status").then(setPush).catch(() => setPush(null));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(Boolean(sub)))
        .catch(() => setSubscribed(false));
    }
  }, []);

  useEffect(() => {
    if (!settings.data) return;
    setTargets({
      calories: String(settings.data.targets.calories),
      proteinG: String(settings.data.targets.proteinG),
      carbsG: String(settings.data.targets.carbsG),
      fatG: String(settings.data.targets.fatG),
    });
    setMeals(settings.data.mealReminders);
  }, [settings.data]);

  async function enable() {
    if (!push?.publicKey) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast("Permission wasn't granted");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(push.publicKey),
      });
      await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      setSubscribed(true);
      toast("Notifications on");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const result = await api<{ delivered: number }>("/api/push/test", { method: "POST" });
      toast(result.delivered ? "Test sent" : "No devices are subscribed yet");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveTargets(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          targets: {
            calories: Number(targets.calories),
            proteinG: Number(targets.proteinG),
            carbsG: Number(targets.carbsG),
            fatG: Number(targets.fatG),
          },
          mealReminders: meals,
        }),
      });
      toast("Saved");
      await settings.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  const blocked = ios && !installed;

  return (
    <main className="page">
      <PageTitle title="Settings" />
      <p className="kicker">Orbit</p>
      <h1 className="display" style={{ fontSize: 32 }}>Settings</h1>
      <p className="sub">Times stay on America/Detroit, even if the phone is set somewhere else.</p>

      <section className="card" style={{ marginTop: 18 }}>
        <p className="kicker">iPhone home screen</p>
        <h2 style={{ margin: "8px 0" }}>Install Orbit first</h2>
        <p className="muted">Web Push on iOS 16.4 and later only works after the app is added to the home screen and opened from that icon. Safari tabs cannot subscribe.</p>
        <ol className="steps">
          <li>Open this site in Safari on your iPhone.</li>
          <li>Tap the Share button.</li>
          <li>Tap Add to Home Screen, then Add.</li>
          <li>Open Orbit from the new home screen icon, not the Safari tab.</li>
          <li>Come back to this screen and tap Enable notifications. Choose Allow.</li>
        </ol>
        <p className="faint" style={{ marginBottom: 0 }}>
          {installed ? "This session is running as an installed app." : ios ? "This is a Safari tab. Add it to the home screen before enabling notifications." : "On this browser you can enable notifications without installing. On iPhone, use the steps above."}
        </p>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="spread">
          <strong>Notifications</strong>
          <span className="pill" data-type={subscribed ? "work" : "other"}>{subscribed ? "On" : "Off"}</span>
        </div>
        {!push?.configured ? <p className="err" style={{ marginTop: 12 }}>Push is not configured on the server yet. Add the VAPID keys from the README.</p> : null}
        {permission === "denied" ? <p className="muted">Notifications are blocked. On iPhone: Settings → Notifications → Orbit → Allow.</p> : null}
        <div className="stack" style={{ marginTop: 12 }}>
          <button className="btn" type="button" disabled={busy || blocked || !push?.configured || subscribed} onClick={() => void enable()}>
            {blocked ? "Add to Home Screen first" : subscribed ? "Notifications on" : "Enable notifications"}
          </button>
          <button className="btn-ghost" type="button" disabled={busy || !subscribed} onClick={() => void test()}>Send a test</button>
        </div>
      </section>

      {settings.loading && !settings.data ? <Loading rows={1} /> : null}
      {settings.error ? <ErrorNote message={settings.error} onRetry={settings.reload} /> : null}
      {settings.data ? (
        <form onSubmit={(event) => void saveTargets(event)} style={{ marginTop: 12 }}>
          <section className="card">
            <strong>Daily targets</strong>
            <div className="grid-2" style={{ marginTop: 12 }}>
              <label className="field"><span>Calories</span><input inputMode="numeric" value={targets.calories} onChange={(event) => setTargets({ ...targets, calories: event.target.value })} /></label>
              <label className="field"><span>Protein g</span><input inputMode="decimal" value={targets.proteinG} onChange={(event) => setTargets({ ...targets, proteinG: event.target.value })} /></label>
              <label className="field"><span>Carbs g</span><input inputMode="decimal" value={targets.carbsG} onChange={(event) => setTargets({ ...targets, carbsG: event.target.value })} /></label>
              <label className="field"><span>Fat g</span><input inputMode="decimal" value={targets.fatG} onChange={(event) => setTargets({ ...targets, fatG: event.target.value })} /></label>
            </div>
          </section>
          <section className="card" style={{ marginTop: 12 }}>
            <strong>Meal reminders</strong>
            <p className="faint">A daily nudge. Breakfast defaults to 11:30 because mornings start late.</p>
            {meals.map((meal, index) => (
              <div key={meal.id} className="grid-2" style={{ alignItems: "end" }}>
                <label className="field">
                  <span>{meal.label}</span>
                  <input type="time" value={meal.time} onChange={(event) => setMeals(meals.map((item, i) => i === index ? { ...item, time: event.target.value } : item))} />
                </label>
                <label className="field">
                  <span>On</span>
                  <select value={meal.enabled ? "yes" : "no"} onChange={(event) => setMeals(meals.map((item, i) => i === index ? { ...item, enabled: event.target.value === "yes" } : item))}>
                    <option value="yes">Enabled</option>
                    <option value="no">Off</option>
                  </select>
                </label>
              </div>
            ))}
          </section>
          <button className="btn" style={{ marginTop: 12 }} type="submit">Save targets</button>
        </form>
      ) : null}
    </main>
  );
}
