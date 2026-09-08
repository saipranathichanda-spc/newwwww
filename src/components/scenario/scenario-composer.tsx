"use client";
import { useState } from "react";

type Strategy = { id: string; name: string; allocation: { buses: number; boats: number; ambulances: number }; route: string; timeMinutes: { expected: number; low: number; high: number }; capacity: number; successProbability: number; riskScore: number; costIndex: number; bottleneck: string; tradeoff: string };
export type Result = { decisionTwinId: string; place: string; scenarioType: string; severity: string; population: number; buses: number; boats: number; ambulances: number; priorities: { safety: number; time: number; cost: number }; uncertainty: { lowerPopulation: number; upperPopulation: number; planningRange: string }; recommended: Strategy; candidates: Strategy[]; hospitals: Array<{ name: string; address?: string | null; phone?: string | null; distanceKm: number | null; travelMinutes: number | null; source: string; confidence?: number }>; weather: { temperatureC: number | null; rainfallMm: number | null; precipitationProbability: number | null; windSpeedKmh: number | null; source: string; retrievedAt: string; status: string } | null; gis: { roads: number; buildings: number; drains: number; rivers: number; bridges: number; source: string; status: string } | null; routes?: Array<import("@/lib/data-sources/routing").RouteOption>; dataStatus: Array<{ label: string; status: string; source: string }>; explanation: string };

const PRESETS = [
  { label: "Flood in Central", text: "Severe flood in Central. Evacuate 5,000 people with 10 buses, 3 rescue boats and 5 ambulances. Prioritize safety, then evacuation time, then cost." },
  { label: "Flood in Velachery", text: "Severe flood in Velachery. Evacuate 3,500 people with 8 buses, 4 rescue boats and 3 ambulances. Prioritize safety, then evacuation time, then cost." },
  { label: "Flood in VIT Chennai", text: "Severe flood in VIT Chennai. Evacuate 5,000 people with 10 buses, 3 rescue boats and 5 ambulances. Prioritize safety, then evacuation time, then cost." },
];

export function ScenarioComposer({ onScenarioBuilt }: { onScenarioBuilt?: (result: Result) => void }) {
  const [text, setText] = useState(PRESETS[0].text);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function build() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/decision/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not build scenario");
      setResult(payload as Result);
      onScenarioBuilt?.(payload as Result);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not build scenario"); }
    finally { setLoading(false); }
  }
  return <section className="mt-8 rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-6">
    <p className="text-sm font-medium tracking-[.16em] text-[#39d4b4]">CREATE DECISION TWIN</p>
    <h2 className="mt-2 text-2xl font-semibold">Describe the emergency in one sentence</h2>
    <p className="mt-2 text-sm text-[#9aabc1]">Dispatch origin is permanently fixed at <b>VIT Chennai Base</b>. Mentioning a location (e.g. Central or Velachery) automatically models the emergency and routes from VIT Chennai.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <span className="self-center text-xs text-[#9aabc1]">Quick scenarios:</span>
      {PRESETS.map((p) => (
        <button key={p.label} type="button" onClick={() => setText(p.text)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${text === p.text ? "border-[#39d4b4] bg-[#39d4b4]/20 text-[#69e8d1]" : "border-[#39506e] bg-[#07111f] text-[#9aabc1] hover:border-[#39d4b4]/60"}`}>{p.label}</button>
      ))}
    </div>
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!loading && text.trim()) build();
        }
      }}
      placeholder="Type emergency scenario and press Enter to run decision twin..."
      className="mt-4 min-h-28 w-full rounded-xl border border-[#39506e] bg-[#07111f] p-4 text-sm leading-6 outline-none focus:border-[#39d4b4]"
    />
    <button onClick={build} disabled={loading || !text.trim()} className="mt-3 rounded-lg bg-[#39d4b4] px-5 py-3 text-sm font-semibold text-[#062019] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Building Decision Twin…" : "Build scenario"}</button>
    {error && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {result && <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs tracking-[.14em] text-[#39d4b4]">DECISION TWIN CREATED</p><h3 className="mt-1 text-xl font-semibold">{result.place} · {result.scenarioType}</h3></div><span className="rounded-full bg-[#113c3d] px-3 py-1 text-xs text-[#69e8d1]">{result.decisionTwinId}</span></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Affected people", result.population.toLocaleString()], ["Buses", result.buses], ["Boats", result.boats], ["Ambulances", result.ambulances], ["Uncertainty", result.uncertainty.planningRange]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-[#10233a] p-3"><p className="text-xs text-[#9aabc1]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>
      <div className="rounded-xl border border-[#39d4b4]/40 bg-[#0b292d] p-5"><p className="text-xs tracking-[.14em] text-[#69e8d1]">RECOMMENDED STRATEGY</p><h3 className="mt-2 text-xl font-semibold">{result.recommended.name}</h3><p className="mt-2 text-sm leading-6 text-[#c5d7e9]">{result.explanation}</p><div className="mt-4 grid gap-3 sm:grid-cols-4"><Metric label="Expected time" value={`${result.recommended.timeMinutes.expected} min`} /><Metric label="Likely range" value={`${result.recommended.timeMinutes.low}–${result.recommended.timeMinutes.high} min`} /><Metric label="Success probability" value={`${result.recommended.successProbability}%`} /><Metric label="Risk score" value={`${result.recommended.riskScore}/100`} /></div><p className="mt-4 text-sm text-[#b6c4d5]"><b>Recommended route:</b> {result.recommended.route}</p><p className="mt-2 text-sm text-[#b6c4d5]"><b>Allocation:</b> {result.recommended.allocation.buses} buses · {result.recommended.allocation.boats} boats · {result.recommended.allocation.ambulances} ambulances</p></div>
      <div><p className="mb-3 text-sm font-semibold">Scenario comparison</p><div className="grid gap-3 md:grid-cols-3">{result.candidates.map((candidate) => <div key={candidate.id} className={`rounded-xl border p-4 ${candidate.id === result.recommended.id ? "border-[#39d4b4] bg-[#102d35]" : "border-[#23354d] bg-[#10233a]"}`}><div className="flex items-start justify-between gap-2"><p className="font-medium">{candidate.name}</p>{candidate.id === result.recommended.id && <span className="text-xs text-[#69e8d1]">BEST FIT</span>}</div><p className="mt-3 text-sm text-[#b6c4d5]">{candidate.timeMinutes.expected} min · {candidate.successProbability}% success · risk {candidate.riskScore}</p><p className="mt-2 text-xs leading-5 text-[#9aabc1]">{candidate.tradeoff}</p></div>)}</div></div>
      <div className="grid gap-5 md:grid-cols-2"><div><p className="mb-3 text-sm font-semibold">Nearby hospitals</p><div className="space-y-2">{result.hospitals.length > 0 ? result.hospitals.map((hospital) => <div key={hospital.name} className="rounded-lg border border-[#23354d] bg-[#10233a] p-3 text-sm"><p className="font-medium">{hospital.name}</p><p className="mt-1 text-xs text-[#9aabc1]">{hospital.distanceKm == null ? "Distance unavailable" : `${hospital.distanceKm} km`} · {hospital.travelMinutes == null ? "travel time unavailable" : `~${hospital.travelMinutes} min`} · {hospital.source}</p></div>) : <div className="rounded-lg border border-[#23354d] bg-[#10233a] p-3 text-sm text-[#9aabc1]">UNAVAILABLE; no hospital data could be retrieved. No facilities were substituted.</div>}</div></div><div><p className="mb-3 text-sm font-semibold">Data status</p><div className="space-y-2">{result.dataStatus.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-[#23354d] bg-[#10233a] p-3 text-sm"><span>{item.label}</span><span className="text-right text-xs text-[#69e8d1]">{item.status} · {item.source}</span></div>)}</div></div></div>
      <div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-[#23354d] bg-[#10233a] p-4 text-sm"><p className="font-semibold">Weather context</p>{result.weather ? <p className="mt-2 text-xs leading-5 text-[#b6c4d5]">{result.weather.temperatureC ?? "—"}°C · rainfall {result.weather.rainfallMm ?? "—"} mm · rain chance {result.weather.precipitationProbability ?? "—"}% · wind {result.weather.windSpeedKmh ?? "—"} km/h<br /><span className="text-[#69e8d1]">{result.weather.source} · {result.weather.status}</span></p> : <p className="mt-2 text-xs text-[#9aabc1]">UNAVAILABLE; no weather value was substituted.</p>}</div><div className="rounded-lg border border-[#23354d] bg-[#10233a] p-4 text-sm"><p className="font-semibold">GCC GIS context</p>{result.gis ? <p className="mt-2 text-xs leading-5 text-[#b6c4d5]">Roads {result.gis.roads} · buildings {result.gis.buildings} · drains {result.gis.drains} · rivers {result.gis.rivers} · bridges {result.gis.bridges}<br /><span className="text-[#69e8d1]">{result.gis.source} · {result.gis.status}</span></p> : <p className="mt-2 text-xs text-[#9aabc1]">UNAVAILABLE; no GIS value was substituted.</p>}</div></div>
      <p className="rounded-lg border border-[#39506e] bg-[#07111f] p-3 text-xs leading-5 text-[#9aabc1]">Simulation outputs are model estimates based on the prompt. Population is USER_REPORTED; routes and outcomes are SIMULATED. Individual phone locations and live telecom counts are not accessed.</p>
    </div>}
  </section>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#123c42] p-3"><p className="text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-[#9fc7c5]">{label}</p></div>; }
