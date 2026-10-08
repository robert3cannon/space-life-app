import { json, readJson } from "../api";
import { HttpError } from "../errors";
import { deliverPush, isPushConfigured, removeSubscription, saveSubscription, subscriptionCount } from "../push";
import { pushSubscribeSchema } from "../validation";

export async function getPushStatus() {
  return json({
    configured: isPushConfigured(),
    publicKey: isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
    subscriptions: await subscriptionCount(),
  });
}

export async function subscribePush(req: Request) {
  if (!isPushConfigured()) throw new HttpError("Push is not configured on the server", 503);
  const input = pushSubscribeSchema.parse(await readJson(req));
  const saved = await saveSubscription({
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: req.headers.get("user-agent"),
  });
  return json(saved, 201);
}

export async function unsubscribePush(req: Request) {
  const input = pushSubscribeSchema.pick({ endpoint: true }).parse(await readJson(req));
  return json(await removeSubscription(input.endpoint));
}

export async function testPush() {
  if (!isPushConfigured()) throw new HttpError("Push is not configured on the server", 503);
  const result = await deliverPush({
    title: "Orbit",
    body: "Notifications are reaching this device.",
    url: "/settings",
    tag: `test-${Date.now()}`,
  });
  return json(result);
}
