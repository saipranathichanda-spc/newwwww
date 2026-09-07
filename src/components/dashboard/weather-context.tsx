"use client";
import { useEffect, useState } from "react";
import type { WeatherContext } from "@/lib/data-sources/weather";

export function WeatherContextPanel() {
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  useEffect(() => { fetch("/api/weather?lat=13.0827&lng=80.2707").then((r) => r.ok ? r.json() : null).then(setWeather).catch(() => setWeather(null)); }, []);
  if (!weather) return <div className="mt-6 rounded-xl border border-[#23354d] bg-[#0d1b2d] p-5 text-sm text-[#9aabc1]">Weather context UNAVAILABLE. No weather values were substituted.</div>;
  return <div className="mt-6 rounded-xl border border-[#23354d] bg-[#0d1b2d] p-5"><p className="text-sm font-semibold">Chennai weather context <span className="ml-2 text-xs font-normal text-[#9aabc1]">Open-Meteo forecast · uncertainty applies</span></p><div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><Value label="Temperature" value={`${weather.temperatureC ?? "Unknown"}°C`}/><Value label="Rainfall now" value={`${weather.rainfallMm ?? "Unknown"} mm`}/><Value label="Rain chance" value={`${weather.precipitationProbability ?? "Unknown"}%`}/><Value label="Wind" value={`${weather.windSpeedKmh ?? "Unknown"} km/h`}/></div></div>;
}
function Value({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#10233a] p-3"><p className="text-xs text-[#9aabc1]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
