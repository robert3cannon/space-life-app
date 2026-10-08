import { existsSync } from "node:fs";
import { config } from "dotenv";

export function loadLocalEnv() {
  if (existsSync(".env.local")) config({ path: ".env.local", quiet: true });
  if (existsSync(".env")) config({ path: ".env", quiet: true });
}
