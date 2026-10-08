import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSessionToken, verifySessionToken } from "../lib/session";
import { addCalendarDays, weekStartDate, zonedDateTimeToUtc } from "../lib/time";

describe("America/Detroit time", () => {
  it("converts an afternoon in October to EDT", () => {
    const instant = zonedDateTimeToUtc("2026-10-08", "14:00");
    assert.equal(instant.toISOString(), "2026-10-08T18:00:00.000Z");
  });

  it("converts an afternoon in January to EST", () => {
    const instant = zonedDateTimeToUtc("2026-01-08", "14:00");
    assert.equal(instant.toISOString(), "2026-01-08T19:00:00.000Z");
  });

  it("handles the spring-forward boundary", () => {
    assert.equal(zonedDateTimeToUtc("2026-03-08", "01:30").toISOString(), "2026-03-08T06:30:00.000Z");
    assert.equal(zonedDateTimeToUtc("2026-03-08", "03:30").toISOString(), "2026-03-08T07:30:00.000Z");
  });

  it("starts weeks on Monday", () => {
    assert.equal(weekStartDate("2026-10-08"), "2026-10-05");
    assert.equal(weekStartDate("2026-10-04"), "2026-09-28");
    assert.equal(weekStartDate("2026-10-05"), "2026-10-05");
    assert.equal(addCalendarDays("2026-10-08", 3), "2026-10-11");
  });
});

describe("session cookie", () => {
  it("accepts a token it just signed", async () => {
    const token = await createSessionToken("secret", 60);
    assert.equal(await verifySessionToken(token, "secret"), true);
  });

  it("rejects a bad signature and an expired token", async () => {
    const token = await createSessionToken("secret", 60);
    const [payload, signature] = token.split(".");
    const flipped = signature.slice(0, -1) + (signature.endsWith("a") ? "b" : "a");
    assert.equal(await verifySessionToken(`${payload}.${flipped}`, "secret"), false);
    assert.equal(await verifySessionToken(await createSessionToken("secret", -10), "secret"), false);
    assert.equal(await verifySessionToken(token, "other-secret"), false);
  });
});
