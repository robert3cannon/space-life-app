import { getSettingsRoute, patchSettings } from "@/lib/handlers/settings";
import { withBot } from "@/lib/api";

export const GET = withBot(getSettingsRoute);
export const PATCH = withBot(patchSettings);

export const dynamic = "force-dynamic";
