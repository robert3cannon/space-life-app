import webpush from "web-push";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { pushSubscriptions } from "./db/schema";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

export type PushSender = (sub: typeof pushSubscriptions.$inferSelect, payload: PushPayload) => Promise<void>;

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function applyVapid() {
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  return true;
}

async function defaultSender(sub: typeof pushSubscriptions.$inferSelect, payload: PushPayload) {
  applyVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: "high" },
    );
  } catch (err) {
    const statusCode =
      typeof err === "object" && err && "statusCode" in err ? Number((err as { statusCode: unknown }).statusCode) : undefined;
    const wrapped = new Error(err instanceof Error ? err.message : "Push failed") as Error & { statusCode?: number };
    if (Number.isFinite(statusCode)) wrapped.statusCode = statusCode;
    throw wrapped;
  }
}

let sender: PushSender = defaultSender;

export function setPushSender(next: PushSender | null) {
  sender = next ?? defaultSender;
}

export async function saveSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(pushSubscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent },
    })
    .returning();
  return { id: row.id, endpoint: row.endpoint };
}

export async function removeSubscription(endpoint: string) {
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return { ok: true };
}

export async function subscriptionCount() {
  const db = getDb();
  const rows = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions);
  return rows.length;
}

export async function deliverPush(payload: PushPayload) {
  const db = getDb();
  const subs = await db.select().from(pushSubscriptions);
  const usingDefault = sender === defaultSender;
  if (usingDefault && !isPushConfigured()) {
    return {
      configured: false,
      delivered: 0,
      failed: 0,
      removed: 0,
      transient: 0,
      subscriptions: subs.length,
    };
  }

  let delivered = 0;
  let failed = 0;
  let removed = 0;
  let transient = 0;
  for (const sub of subs) {
    try {
      await sender(sub, payload);
      delivered += 1;
    } catch (err) {
      const status = typeof err === "object" && err && "statusCode" in err ? Number((err as { statusCode: unknown }).statusCode) : undefined;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        removed += 1;
      } else {
        failed += 1;
        transient += 1;
        console.error("push_failed", status ?? "network");
      }
    }
  }
  return { configured: true, delivered, failed, removed, transient, subscriptions: subs.length };
}
