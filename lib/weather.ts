import { weatherLabel, type WeatherSnap } from "./outfit-picker";

const EAST_LANSING = { latitude: 42.737, longitude: -84.4839 };

let override: WeatherSnap | undefined;

/** Tests inject a forecast so the picker never calls Open-Meteo. */
export function setWeatherForTests(value: WeatherSnap | undefined) {
  override = value;
}

export async function eastLansingWeather(fetchImpl: typeof fetch = fetch): Promise<WeatherSnap> {
  if (override) return override;
  const params = new URLSearchParams({
    latitude: String(EAST_LANSING.latitude),
    longitude: String(EAST_LANSING.longitude),
    current: "temperature_2m,weather_code",
    temperature_unit: "fahrenheit",
    timezone: "America/Detroit",
  });
  try {
    const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error("weather");
    const body = (await response.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
    const tempF = Number(body.current?.temperature_2m);
    const code = Number(body.current?.weather_code);
    if (!Number.isFinite(tempF)) throw new Error("weather");
    return { tempF, code: Number.isFinite(code) ? code : 0, label: weatherLabel(Number.isFinite(code) ? code : 0), live: true };
  } catch {
    return { tempF: 60, code: -1, label: "Mild", live: false };
  }
}
