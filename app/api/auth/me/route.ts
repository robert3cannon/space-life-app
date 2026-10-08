import { withUser } from "@/lib/api";
import { json } from "@/lib/api";
import { TIMEZONE } from "@/lib/constants";
import { displayName } from "@/lib/profile";

export const GET = withUser(async () => json({ name: displayName(), timezone: TIMEZONE }));
export const dynamic = "force-dynamic";
