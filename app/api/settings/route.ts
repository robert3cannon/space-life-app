import { getSettingsRoute, patchSettings } from "@/lib/handlers/settings";
import { withUser } from "@/lib/api";

export const GET = withUser(getSettingsRoute);
export const PATCH = withUser(patchSettings);

export const dynamic = "force-dynamic";
