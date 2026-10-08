import { json, readJson } from "../api";
import { getSettings, updateSettings } from "../services/settings";
import { settingsPatchSchema } from "../validation";

export async function getSettingsRoute() {
  return json(await getSettings());
}

export async function patchSettings(req: Request) {
  const input = settingsPatchSchema.parse(await readJson(req));
  return json(await updateSettings(input));
}
