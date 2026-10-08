process.env.DATABASE_URL = "postgres://orbit:orbit@localhost:5432/orbit_test";
process.env.APP_PASSWORD = "test-passcode";
process.env.SESSION_SECRET = "test-session-secret-value";
process.env.BOT_API_TOKEN = "test-bot-token-value";
process.env.CRON_SECRET = "test-cron-secret-value";
process.env.VAPID_SUBJECT = "mailto:test@example.com";
process.env.VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";

if (!process.env.DATABASE_URL.includes("orbit_test")) {
  throw new Error("Refusing to run tests against a database other than orbit_test");
}
