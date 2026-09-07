export type ScenarioInput = {
  prompt: string;
  place: string;
  scenarioType: "flood" | "emergency" | "evacuation";
  severity: "high" | "medium" | "low";
  population: number;
  buses: number;
  boats: number;
  ambulances: number;
  priorities: { safety: number; time: number; cost: number };
};

type LiveContext = {
  origin?: { name: string; lat: number; lng: number; source: string; status: string };
  location?: { name: string; lat: number; lng: number; source: string; status: string };
  weather?: { temperatureC: number | null; rainfallMm: number | null; precipitationProbability: number | null; windSpeedKmh: number | null; source: string; retrievedAt: string; status: string };
  hospitals?: Array<{ name: string; address?: string | null; phone?: string | null; distanceKm?: number; travelMinutes?: number; source: string; confidence?: number }>;
  routes?: Array<{ id: string; distanceMeters: number; durationSeconds: number; source: string; trafficStatus?: string }>;
  gis?: { roads: number; buildings: number; drains: number; rivers: number; bridges: number; source: string; status: string };
};

export type ScenarioResult = ScenarioInput & {
  decisionTwinId: string;
  origin: { name: string; lat: number; lng: number; source: string; status: string };
  location: { name: string; lat: number; lng: number; radiusKm: number; source: string; status: string };
  uncertainty: { lowerPopulation: number; upperPopulation: number; planningRange: string };
  recommended: CandidateStrategy;
  candidates: CandidateStrategy[];
  hospitals: Array<{ name: string; address?: string | null; phone?: string | null; distanceKm: number | null; travelMinutes: number | null; source: string; confidence?: number }>;
  weather: LiveContext["weather"] | null;
  gis: LiveContext["gis"] | null;
  routes?: LiveContext["routes"];
  dataStatus: Array<{ label: string; status: string; source: string }>;
  explanation: string;
};

type CandidateStrategy = { id: string; name: string; allocation: { buses: number; boats: number; ambulances: number }; route: string; timeMinutes: { expected: number; low: number; high: number }; capacity: number; successProbability: number; riskScore: number; costIndex: number; bottleneck: string; tradeoff: string };

const KNOWN_PLACES: Record<string, { label: string; lat: number; lng: number }> = {
  "vit chennai": { label: "VIT Chennai", lat: 12.8406, lng: 80.1534 },
  "central": { label: "Chennai Central", lat: 13.0827, lng: 80.2757 },
  "chennai central": { label: "Chennai Central", lat: 13.0827, lng: 80.2757 },
  "velachery": { label: "Velachery, Chennai", lat: 12.9815, lng: 80.218 },
  "tambaram": { label: "Tambaram, Chennai", lat: 12.9249, lng: 80.1000 },
  "guindy": { label: "Guindy, Chennai", lat: 13.0067, lng: 80.2026 },
  "adyar": { label: "Adyar, Chennai", lat: 13.0012, lng: 80.2565 },
  "chennai": { label: "Chennai", lat: 13.0827, lng: 80.2707 },
  "kovalam": { label: "Kovalam, Chennai", lat: 12.787, lng: 80.251 },
};
function numberFrom(text: string, regex: RegExp, fallback: number) { const match = text.match(regex); return match ? Number(match[1].replace(/,/g, "")) : fallback; }
function extractPlace(text: string) {
  const lower = text.toLowerCase();
  for (const [key, place] of Object.entries(KNOWN_PLACES)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(lower)) {
      return place.label;
    }
  }
  const match = text.match(/(?:in|at|near|from)\s+([^.!?]+?)(?:,\s*Chennai|\.|,|$)/i);
  return match?.[1]?.trim() ? `${match[1].trim()}, Chennai` : "Chennai";
}
function priorityWeights(text: string) { const lower = text.toLowerCase(); if (lower.includes("speed") || lower.includes("time")) return { safety: 0.45, time: 0.45, cost: 0.1 }; if (lower.includes("cost") || lower.includes("cheap")) return { safety: 0.5, time: 0.2, cost: 0.3 }; return { safety: 0.6, time: 0.3, cost: 0.1 }; }
export function parseScenario(prompt: string): ScenarioInput { const lower = prompt.toLowerCase(); return { prompt, place: extractPlace(prompt), scenarioType: lower.includes("flood") ? "flood" : lower.includes("evac") ? "evacuation" : "emergency", severity: lower.includes("severe") || lower.includes("critical") || lower.includes("heavy") ? "high" : "medium", population: numberFrom(prompt, /([\d,]+)\s*(?:people|persons|residents|inside)/i, 5000), buses: numberFrom(prompt, /([\d,]+)\s*buses?/i, 10), boats: numberFrom(prompt, /([\d,]+)\s*(?:rescue\s*)?boats?/i, 3), ambulances: numberFrom(prompt, /([\d,]+)\s*ambulances?/i, 5), priorities: priorityWeights(prompt) }; }
function locationFor(place: string) { const entry = Object.entries(KNOWN_PLACES).find(([key]) => place.toLowerCase().includes(key)); return entry?.[1] ?? { label: place, lat: 13.0827, lng: 80.2707 }; }

export function simulateScenario(input: ScenarioInput, context: LiveContext = {}): ScenarioResult {
  const fixedOrigin = context.origin ?? { name: "VIT Chennai (Base Hub)", lat: 12.8406, lng: 80.1534, source: "FIXED_BASE_ORIGIN", status: "RESOLVED" };
  const base = locationFor(input.place); const location = context.location ?? { name: base.label, lat: base.lat, lng: base.lng, source: "KNOWN_PLACE_RESOLUTION", status: "RESOLVED" };
  const population = Math.max(1, input.population); const lowerPopulation = Math.round(population * 0.85); const upperPopulation = Math.round(population * 1.15); const totalCapacity = input.buses * 50 + input.boats * 20; const medicalReserve = Math.max(1, input.ambulances);
  const routeMinutes = context.routes?.[0] ? Math.round(context.routes[0].durationSeconds / 60) : 0; const weatherPenalty = (context.weather?.rainfallMm ?? 0) > 5 ? 12 : (context.weather?.precipitationProbability ?? 0) > 60 ? 8 : 0; const gisPenalty = context.gis ? Math.min(10, Math.round((context.gis.rivers + context.gis.drains) / 40)) : 0; const baseTime = Math.max(34, Math.round((routeMinutes || 42) + population / Math.max(60, totalCapacity) * 8 + weatherPenalty + gisPenalty));
  const isVitIncident = location.name.toLowerCase().includes("vit");
  const routeDescription = isVitIncident
    ? `${location.name} → designated safe assembly area`
    : `${fixedOrigin.name} → ${location.name}`;
  const routeLabel = context.routes?.[0]
    ? `${routeDescription} (${context.routes[0].source}; ${context.routes[0].trafficStatus ?? "standard routing"})`
    : `${routeDescription} (model-estimated)`;
  const strategies: CandidateStrategy[] = [
    { id: "balanced", name: "Safety-first balanced evacuation", allocation: { buses: input.buses, boats: input.boats, ambulances: medicalReserve }, route: routeLabel, timeMinutes: { expected: baseTime, low: Math.max(25, baseTime - 10), high: baseTime + 18 }, capacity: totalCapacity, successProbability: Math.min(96, Math.round(77 + (totalCapacity / population) * 16 - weatherPenalty / 4)), riskScore: Math.min(85, 24 + gisPenalty + (weatherPenalty > 0 ? 5 : 0)), costIndex: 62, bottleneck: totalCapacity < population ? "Vehicle capacity requires multiple evacuation waves." : "Road accessibility and staging order.", tradeoff: "Best safety/time balance; keeps ambulances available for medical priority." },
    { id: "speed", name: "Fastest staged evacuation", allocation: { buses: input.buses, boats: Math.max(0, input.boats - 1), ambulances: medicalReserve }, route: routeLabel, timeMinutes: { expected: Math.max(28, baseTime - 12), low: Math.max(22, baseTime - 20), high: baseTime + 12 }, capacity: Math.max(0, totalCapacity - 20), successProbability: Math.min(95, Math.round(73 + (totalCapacity / population) * 16 - weatherPenalty / 4)), riskScore: Math.min(90, 35 + gisPenalty), costIndex: 68, bottleneck: "Higher exposure if the primary corridor becomes inaccessible.", tradeoff: "Faster in the model, but less resilient to road or water-access disruption." },
    { id: "resource-light", name: "Resource-conserving response", allocation: { buses: Math.max(1, input.buses - 2), boats: input.boats, ambulances: medicalReserve }, route: routeLabel, timeMinutes: { expected: baseTime + 19, low: baseTime + 8, high: baseTime + 36 }, capacity: Math.max(0, totalCapacity - 100), successProbability: Math.min(92, Math.round(70 + (totalCapacity / population) * 16 - weatherPenalty / 4)), riskScore: Math.min(90, 31 + gisPenalty), costIndex: 42, bottleneck: "Fewer buses increase waiting time and evacuation waves.", tradeoff: "Lowest operating cost, but slower and less suitable when safety is the priority." },
  ];
  const score = (candidate: CandidateStrategy) => input.priorities.safety * (100 - candidate.riskScore) + input.priorities.time * (100 - candidate.timeMinutes.expected) + input.priorities.cost * (100 - candidate.costIndex); const recommended = [...strategies].sort((a, b) => score(b) - score(a))[0];
  const hospitals = (context.hospitals ?? []).slice(0, 6).map((hospital) => ({ ...hospital, distanceKm: hospital.distanceKm ?? null, travelMinutes: hospital.travelMinutes ?? null }));
  return { ...input, decisionTwinId: `DT-${Date.now().toString(36).toUpperCase()}`, origin: fixedOrigin, location: { ...location, radiusKm: 10 }, uncertainty: { lowerPopulation, upperPopulation, planningRange: "±15%" }, recommended, candidates: strategies, hospitals, weather: context.weather ?? null, gis: context.gis ?? null, routes: context.routes, dataStatus: [{ label: "Origin Base", status: fixedOrigin.status, source: fixedOrigin.name }, { label: "Incident Location", status: location.status, source: location.source }, { label: "Population", status: "USER_REPORTED", source: "User prompt" }, { label: "Weather", status: context.weather?.status ?? "UNAVAILABLE", source: context.weather?.source ?? "No weather context" }, { label: "Hospitals", status: context.hospitals?.length ? "LIVE_OR_NEAR_LIVE" : "UNAVAILABLE", source: context.hospitals?.[0]?.source ?? "No hospital context" }, { label: "Routes", status: context.routes?.length ? "STANDARD_ROUTING" : "SIMULATED", source: context.routes?.[0]?.source ?? "Local model" }, { label: "GIS", status: context.gis?.status ?? "UNAVAILABLE", source: context.gis?.source ?? "No GIS context" }, { label: "Telecom phone count", status: "UNAVAILABLE", source: "No authorized telecom feed" }], explanation: `The ${recommended.name.toLowerCase()} is recommended because safety has the highest weight. The model incorporated ${context.weather ? "weather context" : "no weather context"}, ${context.routes?.length ? `route option from ${fixedOrigin.name} (${Math.round((context.routes[0].distanceMeters || 0) / 1000)} km)` : "no fetched route option"}, and ${context.gis ? "GCC GIS feature counts" : "no GCC GIS context"}. Numerical outcomes remain SIMULATED and should be recalculated when new data arrives.` };
}
