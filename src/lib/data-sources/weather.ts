export type WeatherContext = { temperatureC: number | null; rainfallMm: number | null; precipitationProbability: number | null; windSpeedKmh: number | null; forecastTime: string; source: "Open-Meteo"; retrievedAt: string; confidence: number; status: "LIVE_OR_NEAR_LIVE" | "ESTIMATED" };

export async function getCurrentWeather(latitude: number, longitude: number): Promise<WeatherContext> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: "temperature_2m,precipitation,wind_speed_10m", hourly: "precipitation_probability", forecast_days: "1", timezone: "Asia/Kolkata" }).toString();
  const response = await fetch(url, { next: { revalidate: 900 } }); if (!response.ok) throw new Error(`Weather source returned ${response.status}`);
  const data = await response.json() as { current?: { temperature_2m?: number; precipitation?: number; wind_speed_10m?: number; time?: string }; hourly?: { time?: string[]; precipitation_probability?: number[] } };
  const time = data.current?.time ?? new Date().toISOString(); const index = data.hourly?.time?.indexOf(time) ?? -1;
  return { temperatureC: data.current?.temperature_2m ?? null, rainfallMm: data.current?.precipitation ?? null, precipitationProbability: index >= 0 ? data.hourly?.precipitation_probability?.[index] ?? null : null, windSpeedKmh: data.current?.wind_speed_10m ?? null, forecastTime: time, source: "Open-Meteo", retrievedAt: new Date().toISOString(), confidence: 0.7, status: "LIVE_OR_NEAR_LIVE" };
}
