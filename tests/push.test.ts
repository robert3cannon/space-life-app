import assert from "node:assert/strict";
import { describe, it } from "node:test";
import webpush from "web-push";

async function browserKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return {
    p256dh: Buffer.from(raw).toString("base64url"),
    auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url"),
  };
}

describe("web push", () => {
  it("signs a VAPID request without contacting a push service", async () => {
    const vapid = webpush.generateVAPIDKeys();
    webpush.setVapidDetails("mailto:test@example.com", vapid.publicKey, vapid.privateKey);
    const keys = await browserKeys();
    const details = webpush.generateRequestDetails(
      {
        endpoint: "https://push.example.test/subscription/device",
        keys,
      },
      JSON.stringify({ title: "Orbit", body: "Class in 30 minutes", url: "/schedule" }),
      { TTL: 60, urgency: "high" },
    );
    const authorization = String(details.headers.Authorization ?? details.headers.authorization ?? "");
    assert.match(authorization, /^vapid /);
    assert.ok(details.body && details.body.length > 0);
  });

  it("attempts delivery and fails cleanly when the endpoint is closed", async () => {
    const vapid = webpush.generateVAPIDKeys();
    webpush.setVapidDetails("mailto:test@example.com", vapid.publicKey, vapid.privateKey);
    const keys = await browserKeys();
    await assert.rejects(() =>
      webpush.sendNotification(
        { endpoint: "https://127.0.0.1:9/push/device", keys },
        JSON.stringify({ title: "Orbit", body: "Test", url: "/" }),
        { TTL: 60, timeout: 2000 },
      ),
    );
  });
});
