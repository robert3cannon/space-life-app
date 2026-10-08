import { json } from "../api";
import { getToday } from "../services/today";

export async function getTodayRoute() {
  return json(await getToday());
}
