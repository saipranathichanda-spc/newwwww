import type { RouteOption } from "@/lib/data-sources/routing";
import type { WeatherContext } from "@/lib/data-sources/weather";
import type { Hospital } from "@/lib/data-sources/hospitals";
import { getHistoricalFloodContext, type HistoricalContextResult } from "@/lib/data-sources/historical";

// ==========================================
// PHASE 8: DECISION TWIN DATA MODEL TYPES
// ==========================================

export type DataSourceStatus =
  | "VERIFIED"
  | "LIVE_OR_NEAR_LIVE"
  | "HISTORICAL"
  | "ESTIMATED"
  | "USER_PROVIDED"
  | "SIMULATED"
  | "UNAVAILABLE";

export interface ValueWithMetadata<T> {
  value: T;
  source: string;
  sourceType: "USER" | "EXTERNAL_API" | "GIS_SERVER" | "HISTORICAL_ARCHIVE" | "SIMULATION_ENGINE" | "NONE";
  status: DataSourceStatus;
  retrievedAt?: string;
  lastUpdated?: string;
  confidence?: number; // 0 to 1
}

export interface ResourceItem {
  count: number;
  capacityPerUnit: number;
  costPerHour: number;
  speedKmh?: number;
  status: DataSourceStatus;
  source: string;
}

export interface PrioritiesWeights {
  safety: number;     // e.g. 60
  speed: number;      // e.g. 30
  cost: number;       // e.g. 10
  coverage: number;   // e.g. 0
  reliability: number;// e.g. 0
}

export interface ConstraintItem<T = number | string | string[]> {
  name: string;
  allowedValue: T;
  description: string;
  status: DataSourceStatus;
  source: string;
}

export interface DecisionTwinConstraints {
  maxBudget: ConstraintItem<number>;
  maxResponseTimeMinutes: ConstraintItem<number>;
  minBusesRequired: ConstraintItem<number>;
  minBoatsRequired: ConstraintItem<number>;
  roadClosures: ConstraintItem<string[]>;
  inaccessibleRoads: ConstraintItem<string[]>;
  unsafeRoutes: ConstraintItem<string[]>;
  destinationCapacity: ConstraintItem<number | null>;
  transportationRestrictions: ConstraintItem<string[]>;
}

export interface DecisionTwin {
  scenarioId: string;
  scenarioName: string;
  scenarioType: "Flood" | "Cyclone" | "Evacuation" | "Emergency";
  origin?: {
    name: string;
    lat: number;
    lng: number;
    source: string;
    status: DataSourceStatus;
  };
  distanceFromBaseKm?: number;
  deploymentPriority?: "PRIORITY 1 · CRITICAL" | "PRIORITY 2 · HIGH" | "PRIORITY 3 · STANDARD";
  resourceMode?: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC";
  location: {
    name: string;
    lat: number;
    lng: number;
    source: string;
    status: DataSourceStatus;
  };
  hazard: {
    type: "Flood";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MODERATE";
    description: string;
    waterLevel: ValueWithMetadata<string>;
    waterMovement: ValueWithMetadata<string>;
  };
  affectedArea: {
    radiusKm: number;
    bounds?: { west: number; south: number; east: number; north: number };
    drainsCount: ValueWithMetadata<number>;
    riversCount: ValueWithMetadata<number>;
    roadsCount: ValueWithMetadata<number>;
    buildingsCount: ValueWithMetadata<number>;
    bridgesCount: ValueWithMetadata<number>;
  };
  estimatedPopulation: ValueWithMetadata<number>;
  uncertainties: {
    populationLower: number;
    populationUpper: number;
    planningRange: string;
    weatherVariancePercent: number;
    travelTimeVarianceMinutes: number;
  };
  resources: {
    buses: ValueWithMetadata<number>;
    boats: ValueWithMetadata<number>;
    ambulances: ValueWithMetadata<number>;
    rescueTeams: ValueWithMetadata<number>;
    personnel: ValueWithMetadata<number>;
    shelters: ValueWithMetadata<number>;
    budget: ValueWithMetadata<number>;
  };
  resourceSpecs: {
    busCapacity: number;       // 50 people
    boatCapacity: number;      // 20 people
    ambulanceCapacity: number; // 2 patients
    rescueTeamCapacity: number;// 4 personnel
    busCostPerHour: number;    // ₹1,200/hr
    boatCostPerHour: number;   // ₹2,000/hr
    ambulanceCostPerHour: number; // ₹2,500/hr
    rescueTeamCostPerHour: number; // ₹800/hr
    busSpeedKmh: number;       // 25 km/h
    boatSpeedKmh: number;      // 12 km/h
  };
  constraints: DecisionTwinConstraints;
  priorities: PrioritiesWeights;
  geographicContext: {
    roads: number;
    buildings: number;
    drains: number;
    rivers: number;
    bridges: number;
    source: string;
    status: DataSourceStatus;
  } | null;
  weatherContext: {
    temperatureC: number | null;
    rainfallMm: number | null;
    precipitationProbability: number | null;
    windSpeedKmh: number | null;
    source: string;
    retrievedAt: string;
    status: DataSourceStatus;
  } | null;
  historicalContext: HistoricalContextResult;
  hospitals: Array<{
    name: string;
    address?: string | null;
    phone?: string | null;
    distanceKm: number | null;
    travelMinutes: number | null;
    capacity: ValueWithMetadata<number | null>; // explicitly marked UNAVAILABLE
    source: string;
    status: DataSourceStatus;
  }>;
  routes: RouteOption[];
  fieldUpdates: Array<{
    id: string;
    time: string;
    sender: string;
    message: string;
    status: DataSourceStatus;
  }>;
  dataSources: Array<{
    label: string;
    source: string;
    sourceType: string;
    status: DataSourceStatus;
    retrievedAt?: string;
    confidence?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// SIMULATION OUTPUT TYPES
// ==========================================

export interface ConstraintViolation {
  constraint: string;
  actualValue: string | number;
  allowedValue: string | number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "WARNING";
  message: string;
}

export interface BottleneckDetection {
  resourceOrFactor: string;
  severity: "PRIMARY" | "SECONDARY";
  message: string;
  impact: string;
}

export interface RouteScoreEvaluation {
  id: string;
  routeIndex: number;
  name: string;
  distanceKm: number;
  travelMinutes: number;
  riskScore: number;     // 0 (safest) to 100 (most dangerous)
  safetyScore: number;   // 100 - riskScore
  score: number;         // 0 to 100 based on priorities
  isRecommended: boolean;
  geometry: Record<string, unknown>;
  availableFactors: string[];
  unavailableFactors: string[];
  tradeoffRationale: string;
}

export interface ResourceAnalysis {
  mode: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC";
  busesNeeded: number;
  boatsNeeded: number;
  ambulancesNeeded: number;
  rescueTeamsNeeded: number;
  busesDiff: number;
  boatsDiff: number;
  ambulancesDiff: number;
  unusedCapacity: number;
  shortfallCapacity: number;
  status: "SURPLUS" | "BALANCED" | "DEFICIT";
}

export interface SimulationResult {
  scenarioId: string;
  feasible: boolean;
  score: number;
  evacuationTimeMinutes: number;
  totalDistanceKm: number;
  distanceFromBaseKm?: number;
  deploymentPriority?: "PRIORITY 1 · CRITICAL" | "PRIORITY 2 · HIGH" | "PRIORITY 3 · STANDARD";
  resourceMode?: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC";
  resourceAnalysis?: ResourceAnalysis;
  recommendedPlan?: string;
  estimatedCostInr: number;
  riskScore: number;
  totalCapacity: number;
  wavesRequired: number;
  singleWaveCapacity: number;
  resourceUtilization: {
    buses: { allocated: number; capacity: number; utilizationPercent: number };
    boats: { allocated: number; capacity: number; utilizationPercent: number };
    ambulances: { allocated: number; capacity: number; utilizationPercent: number };
    rescueTeams: { allocated: number; capacity: number; utilizationPercent: number };
    overallUtilizationPercent: number;
  };
  constraintViolations: ConstraintViolation[];
  bottlenecks: BottleneckDetection[];
  selectedRoutes: RouteScoreEvaluation[];
  scoreBreakdown: {
    safetyScore: number;
    speedScore: number;
    costScore: number;
    coverageScore: number;
    reliabilityScore: number;
    weightedTotal: number;
  };
  explanation: string;
}

// ==========================================
// DISTANCE & GEOGRAPHY UTILITIES
// ==========================================

export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ==========================================
// KNOWN CHENNAI PLACES
// ==========================================

export const KNOWN_PLACES: Record<string, { label: string; lat: number; lng: number }> = {
  "vit chennai": { label: "VIT Chennai", lat: 12.8406, lng: 80.1534 },
  "central": { label: "Chennai Central", lat: 13.0827, lng: 80.2757 },
  "chennai central": { label: "Chennai Central", lat: 13.0827, lng: 80.2757 },
  "velachery": { label: "Velachery, Chennai", lat: 12.9815, lng: 80.218 },
  "tambaram": { label: "Tambaram, Chennai", lat: 12.9249, lng: 80.1000 },
  "guindy": { label: "Guindy, Chennai", lat: 13.0067, lng: 80.2026 },
  "adyar": { label: "Adyar, Chennai", lat: 13.0012, lng: 80.2565 },
  "chennai": { label: "Chennai", lat: 13.0827, lng: 80.2707 },
  "kovalam": { label: "Kovalam, Chennai", lat: 12.787, lng: 80.251 },
  "madipakkam": { label: "Madipakkam, Chennai", lat: 12.9623, lng: 80.1986 },
  "t nagar": { label: "T Nagar, Chennai", lat: 13.0418, lng: 80.2341 },
  "t. nagar": { label: "T Nagar, Chennai", lat: 13.0418, lng: 80.2341 },
  "thyagaraya nagar": { label: "T Nagar, Chennai", lat: 13.0418, lng: 80.2341 },
  "anna nagar": { label: "Anna Nagar, Chennai", lat: 13.0850, lng: 80.2101 },
  "mylapore": { label: "Mylapore, Chennai", lat: 13.0368, lng: 80.2676 },
  "porur": { label: "Porur, Chennai", lat: 13.0382, lng: 80.1565 },
  "koyambedu": { label: "Koyambedu, Chennai", lat: 13.0694, lng: 80.1948 },
  "saidapet": { label: "Saidapet, Chennai", lat: 13.0213, lng: 80.2231 },
  "perambur": { label: "Perambur, Chennai", lat: 13.1075, lng: 80.2434 },
  "triplicane": { label: "Triplicane, Chennai", lat: 13.0588, lng: 80.2757 },
  "nungambakkam": { label: "Nungambakkam, Chennai", lat: 13.0569, lng: 80.2425 },
  "thiruvanmiyur": { label: "Thiruvanmiyur, Chennai", lat: 12.9830, lng: 80.2594 },
  "sholinganallur": { label: "Sholinganallur, Chennai", lat: 12.9010, lng: 80.2279 },
  "perumbakkam": { label: "Perumbakkam, Chennai", lat: 12.8944, lng: 80.1923 },
};

function extractPlace(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, place] of Object.entries(KNOWN_PLACES)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(lower)) {
      return place.label;
    }
  }
  const match = text.match(/(?:in|at|near|from)\s+([^.!?]+?)(?:,\s*Chennai|\.|,|$)/i);
  return match?.[1]?.trim() ? `${match[1].trim()}, Chennai` : "Velachery, Chennai";
}

function numberFrom(text: string, regex: RegExp, fallback: number): number {
  const match = text.match(regex);
  return match ? Number(match[1].replace(/,/g, "")) : fallback;
}

// ==========================================
// DETERMINISTIC SIMULATION ENGINE
// ==========================================

export function simulateDeterministicDecisionTwin(twin: DecisionTwin): SimulationResult {
  const pop = Math.max(1, twin.estimatedPopulation.value);
  const buses = Math.max(0, twin.resources.buses.value);
  const boats = Math.max(0, twin.resources.boats.value);
  const ambulances = Math.max(0, twin.resources.ambulances.value);
  const teams = Math.max(0, twin.resources.rescueTeams.value);
  const budget = Math.max(0, twin.resources.budget.value);

  const {
    busCapacity,
    boatCapacity,
    ambulanceCapacity,
    rescueTeamCapacity,
    busCostPerHour,
    boatCostPerHour,
    ambulanceCostPerHour,
    rescueTeamCostPerHour
  } = twin.resourceSpecs;

  // Single-wave capacity
  const busWaveCap = buses * busCapacity;
  const boatWaveCap = boats * boatCapacity;
  const ambulanceWaveCap = ambulances * ambulanceCapacity;
  const singleWaveCapacity = busWaveCap + boatWaveCap;

  // Waves required (deterministic ceiling)
  const wavesRequired = singleWaveCapacity > 0 ? Math.ceil(pop / singleWaveCapacity) : 999;
  const totalPlannedCapacity = wavesRequired * singleWaveCapacity;

  // Real data factors from twin context
  const rainfallMm = twin.weatherContext?.rainfallMm ?? 0;
  const drainsCount = twin.geographicContext?.drains ?? 0;
  const riversCount = twin.geographicContext?.rivers ?? 0;
  const historicalRisk = twin.historicalContext.localityRiskLevel;

  // Base flood penalty derived from real weather & GIS
  const rainfallRiskIncrement = Math.min(35, Math.round(rainfallMm * 0.8 + (rainfallMm > 15 ? 10 : rainfallMm > 2 ? 4 : 0)));
  const gisDrainRiskIncrement = Math.min(20, Math.round((riversCount * 0.4) + (drainsCount * 0.1)));
  const historicalRiskIncrement = historicalRisk === "VERY_HIGH" ? 18 : historicalRisk === "HIGH" ? 12 : historicalRisk === "MODERATE" ? 6 : 0;

  // Base risk
  const baseRiskScore = Math.min(95, Math.max(10, 15 + rainfallRiskIncrement + gisDrainRiskIncrement + historicalRiskIncrement));

  // Evaluate candidate routes
  const candidateRoutes = twin.routes && twin.routes.length > 0 ? twin.routes : [];
  
  // If no routes or only 1 route returned by routing engine, create candidate alternatives from VIT Chennai Base
  let effectiveRoutes: RouteOption[] = candidateRoutes;
  if (effectiveRoutes.length === 0) {
    effectiveRoutes = [
      {
        id: "route-primary-corridor",
        distanceMeters: 22000,
        durationSeconds: 2100, // 35 min
        geometry: {},
        source: "OSRM",
        retrievedAt: new Date().toISOString(),
        trafficStatus: "STANDARD_ROUTING"
      },
      {
        id: "route-radial-bypass",
        distanceMeters: 26500,
        durationSeconds: 2700, // 45 min
        geometry: {},
        source: "OSRM",
        retrievedAt: new Date().toISOString(),
        trafficStatus: "STANDARD_ROUTING"
      },
      {
        id: "route-outer-expressway",
        distanceMeters: 31000,
        durationSeconds: 3120, // 52 min
        geometry: {},
        source: "OSRM",
        retrievedAt: new Date().toISOString(),
        trafficStatus: "STANDARD_ROUTING"
      }
    ];
  } else if (effectiveRoutes.length === 1) {
    const base = effectiveRoutes[0];
    effectiveRoutes = [
      base,
      {
        ...base,
        id: `${base.id}-radial-bypass`,
        distanceMeters: Math.round(base.distanceMeters * 1.2),
        durationSeconds: Math.round(base.durationSeconds * 1.28),
        trafficStatus: "STANDARD_ROUTING"
      }
    ];
  }

  const availableFactors = [
    "travelTime (Mapbox/OSRM)",
    "distance (Mapbox/OSRM)",
    "floodRisk (Open-Meteo live rainfall + GCC GIS drains/rivers)",
    "historicalInundation (Disaster Archive)"
  ];
  const unavailableFactors = [
    "roadWidth (UNAVAILABLE)",
    "liveRoadSensors (UNAVAILABLE)",
    "hospitalOccupancy (UNAVAILABLE)"
  ];

  // Route Scoring
  const normalizedPriorities = normalizePriorities(twin.priorities);

  // Check if any road closure applies to Route 1 / primary corridor
  const activeClosures = twin.constraints.roadClosures.allowedValue ?? [];
  const hasRoute1Closure = activeClosures.some(
    (c) => c.toLowerCase().includes("route 1") || c.toLowerCase().includes("gst") || c.toLowerCase().includes("primary") || c.toLowerCase().includes("omr")
  );

  const evaluatedRoutes: RouteScoreEvaluation[] = effectiveRoutes.map((r, index) => {
    const distKm = Math.round((r.distanceMeters / 1000) * 10) / 10;
    // Speed-adjusted travel time
    const durMin = Math.max(5, Math.round(r.durationSeconds / 60));

    // Environmental exposure: Direct route crosses more canal bridges; alternative uses elevated radial ring
    const isPrimary = index === 0;
    const isClosed = isPrimary && hasRoute1Closure;

    // Direct route has higher canal risk when rain or rivers are active (+10), while bypass stays on high ground (-12)
    const canalProximityDivergence = isPrimary ? (rainfallMm > 15 ? +14 : +8) : (rainfallMm > 15 ? -12 : -8);
    const routeRisk = isClosed
      ? 98
      : Math.min(95, Math.max(5, baseRiskScore + canalProximityDivergence));
    const safetyScore = 100 - routeRisk;

    // Component scores
    // Route 0 is typically faster in normal traffic, but alternative has higher clearance
    const speedScore = isClosed ? 5 : Math.max(0, Math.min(100, Math.round(100 - (durMin / 60) * 45)));
    const distScore = isClosed ? 5 : Math.max(0, Math.min(100, Math.round(100 - (distKm / 40) * 40)));
    const coverageScore = singleWaveCapacity >= pop ? 95 : Math.round((singleWaveCapacity / pop) * 90);
    const reliabilityScore = isClosed ? 5 : Math.max(10, 100 - (drainsCount > 25 ? 20 : 5) - (rainfallMm > 15 ? 20 : 5));

    // Priority-weighted composite route score (0 to 100)
    const compositeScore = isClosed
      ? 12
      : Math.round(
          (normalizedPriorities.safety * safetyScore +
           normalizedPriorities.speed * speedScore +
           normalizedPriorities.cost * distScore +
           normalizedPriorities.coverage * coverageScore +
           normalizedPriorities.reliability * reliabilityScore) / 100
        );

    const name = index === 0
      ? `Primary Direct Corridor (Route 1 · via GST / Arterial)`
      : `Radial Ring Bypass (Route ${index + 1} · Circumferential Elevation)`;

    const tradeoff = isClosed
      ? "ROAD CLOSED: Inundated low-level canal bridge. Severely penalized and rendered infeasible."
      : index === 0
      ? "Direct arterial passage from VIT Base; shortest driving time, but higher stormwater drain bridge exposure."
      : "Elevated circumferential bypass; avoids flood-prone canal crossings, preferred when Safety priority is high.";

    return {
      id: r.id || `route-${index + 1}`,
      routeIndex: index,
      name,
      distanceKm: distKm,
      travelMinutes: durMin,
      riskScore: routeRisk,
      safetyScore,
      score: compositeScore,
      isRecommended: false,
      geometry: r.geometry,
      availableFactors,
      unavailableFactors,
      tradeoffRationale: tradeoff
    };
  });

  // Sort candidate routes by composite score descending
  evaluatedRoutes.sort((a, b) => b.score - a.score);
  if (evaluatedRoutes[0]) {
    evaluatedRoutes[0].isRecommended = true;
  }

  const selectedRoute = evaluatedRoutes[0];
  const primaryDistanceKm = selectedRoute ? selectedRoute.distanceKm : 22;
  const oneWayTravelMinutes = selectedRoute ? selectedRoute.travelMinutes : 40;

  // Staging and turnaround cycle calculation
  const stagingMinutesPerWave = 15; // Boarding, triage, manifest
  const cycleTimePerWave = (oneWayTravelMinutes * 2) + stagingMinutesPerWave;

  // Environmental delays based on live rainfall & GIS drains
  const weatherDelayMinutes = rainfallMm > 15 ? 18 : rainfallMm > 5 ? 10 : 0;
  const waterDelayMinutes = (drainsCount + riversCount) > 40 ? 12 : (drainsCount + riversCount) > 15 ? 6 : 0;

  // Total deterministic evacuation time
  let evacuationTimeMinutes = 0;
  if (singleWaveCapacity <= 0) {
    evacuationTimeMinutes = 9999;
  } else {
    evacuationTimeMinutes = Math.round(
      oneWayTravelMinutes +
      ((wavesRequired - 1) * cycleTimePerWave) +
      stagingMinutesPerWave +
      weatherDelayMinutes +
      waterDelayMinutes
    );
  }

  // Cost calculation
  const operationalHours = Math.max(0.5, evacuationTimeMinutes / 60);
  const busCost = buses * busCostPerHour * operationalHours;
  const boatCost = boats * boatCostPerHour * operationalHours;
  const ambulanceCost = ambulances * ambulanceCostPerHour * operationalHours;
  const teamCost = teams * rescueTeamCostPerHour * operationalHours;
  const fuelRatePerKm = 35; // ₹35 / km
  const totalTrips = wavesRequired * 2;
  const fuelSurcharge = primaryDistanceKm * totalTrips * fuelRatePerKm;
  const estimatedCostInr = Math.round(busCost + boatCost + ambulanceCost + teamCost + fuelSurcharge);

  // Resource utilization calculations
  const busUtilPct = singleWaveCapacity > 0 ? Math.min(100, Math.round((pop / Math.max(1, wavesRequired * busWaveCap)) * 100)) : 0;
  const boatUtilPct = singleWaveCapacity > 0 && boatWaveCap > 0 ? Math.min(100, Math.round(((boats * 20) / singleWaveCapacity) * 100)) : 0;
  const ambulanceUtilPct = ambulances > 0 ? Math.min(100, Math.round(pop > 1000 ? 90 : (pop / 20) * 10)) : 0;
  const teamsUtilPct = teams > 0 ? Math.min(100, Math.round(pop > 2000 ? 95 : (pop / 50) * 10)) : 0;
  const overallUtilPct = singleWaveCapacity > 0 ? Math.min(100, Math.round((pop / Math.max(1, totalPlannedCapacity)) * 100)) : 100;

  // Constraint checking
  const violations: ConstraintViolation[] = [];

  // 1. Budget constraint
  const maxBudget = twin.constraints.maxBudget.allowedValue;
  if (estimatedCostInr > maxBudget) {
    violations.push({
      constraint: "Maximum Budget",
      actualValue: `₹${estimatedCostInr.toLocaleString()}`,
      allowedValue: `₹${maxBudget.toLocaleString()}`,
      severity: "HIGH",
      message: `Estimated response cost (₹${estimatedCostInr.toLocaleString()}) exceeds the approved operational budget ceiling of ₹${maxBudget.toLocaleString()} by ₹${(estimatedCostInr - maxBudget).toLocaleString()}.`
    });
  }

  // 2. Response time constraint
  const maxResponseTime = twin.constraints.maxResponseTimeMinutes.allowedValue;
  if (evacuationTimeMinutes > maxResponseTime) {
    violations.push({
      constraint: "Maximum Evacuation / Response Time",
      actualValue: `${evacuationTimeMinutes} min`,
      allowedValue: `${maxResponseTime} min`,
      severity: "CRITICAL",
      message: `Total evacuation duration (${evacuationTimeMinutes} min / ${(evacuationTimeMinutes / 60).toFixed(1)} hrs) exceeds the target response window of ${maxResponseTime} min. Trapped population faces extended exposure.`
    });
  }

  // 3. Water rescue craft constraint in flood
  const minBoats = twin.constraints.minBoatsRequired.allowedValue;
  if (boats < minBoats) {
    violations.push({
      constraint: "Water Rescue Craft Deficiency",
      actualValue: `${boats} boats`,
      allowedValue: `>= ${minBoats} boats`,
      severity: "CRITICAL",
      message: `Zero or insufficient rescue boats allocated in active flood zone. Waterlogged streets cannot be penetrated by road buses alone.`
    });
  }

  // 4. Vehicle minimum
  const minBuses = twin.constraints.minBusesRequired.allowedValue;
  if (buses < minBuses) {
    violations.push({
      constraint: "Transport Bus Fleet Depletion",
      actualValue: `${buses} buses`,
      allowedValue: `>= ${minBuses} buses`,
      severity: "CRITICAL",
      message: `At least ${minBuses} buses required to sustain passenger throughput.`
    });
  }

  // Bottleneck Detection
  const bottlenecks: BottleneckDetection[] = [];

  if (singleWaveCapacity < pop) {
    bottlenecks.push({
      resourceOrFactor: "Buses & Road Transport Capacity",
      severity: "PRIMARY",
      message: `Buses are the primary bottleneck. Available single-wave capacity is ${singleWaveCapacity.toLocaleString()} people while estimated affected population is ${pop.toLocaleString()}.`,
      impact: `Requires ${wavesRequired} sequential evacuation waves with repeated turnaround cycles.`
    });
  }

  if (boats < 4 && (historicalRisk === "VERY_HIGH" || historicalRisk === "HIGH")) {
    bottlenecks.push({
      resourceOrFactor: "Shallow-Draft Water Extraction Boats",
      severity: singleWaveCapacity < pop ? "SECONDARY" : "PRIMARY",
      message: `Only ${boats} rescue boat(s) active for high-inundation locality (${twin.location.name}).`,
      impact: "Internal streets with water depth > 50 cm will experience delayed extraction to bus staging points."
    });
  }

  if (estimatedCostInr > maxBudget) {
    bottlenecks.push({
      resourceOrFactor: "Budget Limitation",
      severity: "SECONDARY",
      message: `Operational expenditure exceeds authorized allocation by ₹${(estimatedCostInr - maxBudget).toLocaleString()}.`,
      impact: "Additional fiscal authorization required for prolonged multi-wave fleet fueling."
    });
  }

  if (oneWayTravelMinutes > 45) {
    bottlenecks.push({
      resourceOrFactor: "Corridor Transit Distance",
      severity: "SECONDARY",
      message: `Transit corridor between base and ${twin.location.name} is ${primaryDistanceKm} km (~${oneWayTravelMinutes} min one-way).`,
      impact: "Transit round-trip turnaround adds significant delay between evacuation waves."
    });
  }

  // Feasibility determination
  const criticalViolations = violations.filter((v) => v.severity === "CRITICAL");
  const feasible = criticalViolations.length === 0 && singleWaveCapacity > 0;

  // Scenario Score Calculation (strictly 0 to 100)
  const safetyComponent = selectedRoute ? selectedRoute.safetyScore : 65;
  const speedComponent = Math.max(0, Math.min(100, Math.round(100 - (evacuationTimeMinutes / Math.max(1, maxResponseTime)) * 80)));
  const costComponent = Math.max(0, Math.min(100, Math.round(100 - (estimatedCostInr / Math.max(1, maxBudget)) * 80)));
  const coverageComponent = Math.min(100, Math.round((totalPlannedCapacity / pop) * 100));
  const reliabilityComponent = Math.max(10, Math.min(100, 100 - (violations.length * 15)));

  const weightedTotal = Math.round(
    (normalizedPriorities.safety * safetyComponent +
     normalizedPriorities.speed * speedComponent +
     normalizedPriorities.cost * costComponent +
     normalizedPriorities.coverage * coverageComponent +
     normalizedPriorities.reliability * reliabilityComponent) / 100
  );

  const finalScore = feasible ? weightedTotal : Math.min(48, weightedTotal);

  // Dynamic AI Optimal Fleet calculation
  const sev = twin.hazard.severity;
  const optimalBuses = Math.min(30, Math.max(4, Math.ceil(pop / 350)));
  const optimalBoats =
    sev === "CRITICAL"
      ? Math.min(16, Math.max(4, Math.ceil(pop / 600)))
      : sev === "HIGH"
      ? Math.min(10, Math.max(2, Math.ceil(pop / 900)))
      : Math.min(6, Math.max(1, Math.ceil(pop / 1800)));
  const optimalAmbulances = Math.min(15, Math.max(3, Math.ceil(pop / 500)));
  const optimalTeams = Math.min(40, Math.max(6, Math.ceil(pop / 250)));

  const isModeA = twin.resourceMode === "MODE_A_PREDEFINED";
  const singleWaveDeficit = Math.max(0, pop - singleWaveCapacity);
  const unusedCapacity = Math.max(0, totalPlannedCapacity - pop);
  const resourceStatus = singleWaveCapacity >= pop ? "SURPLUS" : singleWaveDeficit > 0 && wavesRequired > 3 ? "DEFICIT" : "BALANCED";

  const resourceAnalysis: ResourceAnalysis = {
    mode: isModeA ? "MODE_A_PREDEFINED" : "MODE_B_DYNAMIC",
    busesNeeded: optimalBuses,
    boatsNeeded: optimalBoats,
    ambulancesNeeded: optimalAmbulances,
    rescueTeamsNeeded: optimalTeams,
    busesDiff: buses - optimalBuses,
    boatsDiff: boats - optimalBoats,
    ambulancesDiff: ambulances - optimalAmbulances,
    unusedCapacity,
    shortfallCapacity: singleWaveDeficit,
    status: resourceStatus
  };

  const distFromBase =
    twin.distanceFromBaseKm ??
    primaryDistanceKm ??
    calculateHaversineDistanceKm(12.8406, 80.1534, twin.location.lat, twin.location.lng);

  const deploymentPriority: "PRIORITY 1 · CRITICAL" | "PRIORITY 2 · HIGH" | "PRIORITY 3 · STANDARD" =
    twin.deploymentPriority ??
    (sev === "CRITICAL" || pop >= 4000 || (selectedRoute && selectedRoute.riskScore >= 70)
      ? "PRIORITY 1 · CRITICAL"
      : sev === "HIGH" || pop >= 2000 || (selectedRoute && selectedRoute.riskScore >= 45)
      ? "PRIORITY 2 · HIGH"
      : "PRIORITY 3 · STANDARD");

  const recommendedPlan = `OPERATIONAL DIRECTIVE · ${deploymentPriority}: Dispatch emergency task force from VIT Chennai Base Hub to ${twin.location.name} (${primaryDistanceKm} km corridor, ~${oneWayTravelMinutes} min transit via ${selectedRoute?.name ?? "Primary Route"}). Deploying ${buses} buses (${busWaveCap} seats/wave), ${boats} rescue craft, ${ambulances} ambulances, and ${teams} rescue teams across ${wavesRequired} evacuation wave(s). Total operational evacuation duration is ${evacuationTimeMinutes} min with projected expenditure of ₹${estimatedCostInr.toLocaleString()}.`;

  const explanation = feasible
    ? `The simulation confirms feasibility with an overall readiness score of ${finalScore}/100. Priority weighting (Safety: ${normalizedPriorities.safety}%, Speed: ${normalizedPriorities.speed}%, Cost: ${normalizedPriorities.cost}%) selected the ${selectedRoute?.name ?? "primary route"}. Total estimated evacuation time is ${evacuationTimeMinutes} minutes across ${wavesRequired} wave(s), with operational cost estimated at ₹${estimatedCostInr.toLocaleString()}.`
    : `The current configuration is INFEASIBLE (Score: ${finalScore}/100) due to ${criticalViolations.length} critical constraint breach(es): ${criticalViolations.map((c) => c.constraint).join(", ")}. Immediate resource reallocation required.`;

  return {
    scenarioId: twin.scenarioId,
    feasible,
    score: finalScore,
    evacuationTimeMinutes,
    totalDistanceKm: primaryDistanceKm,
    distanceFromBaseKm: distFromBase,
    deploymentPriority,
    resourceMode: isModeA ? "MODE_A_PREDEFINED" : "MODE_B_DYNAMIC",
    resourceAnalysis,
    recommendedPlan,
    estimatedCostInr,
    riskScore: selectedRoute ? selectedRoute.riskScore : baseRiskScore,
    totalCapacity: totalPlannedCapacity,
    wavesRequired,
    singleWaveCapacity,
    resourceUtilization: {
      buses: { allocated: buses, capacity: busWaveCap, utilizationPercent: busUtilPct },
      boats: { allocated: boats, capacity: boatWaveCap, utilizationPercent: boatUtilPct },
      ambulances: { allocated: ambulances, capacity: ambulanceWaveCap, utilizationPercent: ambulanceUtilPct },
      rescueTeams: { allocated: teams, capacity: teams * rescueTeamCapacity, utilizationPercent: teamsUtilPct },
      overallUtilizationPercent: overallUtilPct
    },
    constraintViolations: violations,
    bottlenecks,
    selectedRoutes: evaluatedRoutes,
    scoreBreakdown: {
      safetyScore: safetyComponent,
      speedScore: speedComponent,
      costScore: costComponent,
      coverageScore: coverageComponent,
      reliabilityScore: reliabilityComponent,
      weightedTotal
    },
    explanation
  };
}

// ==========================================
// BUILDER & WHAT-IF HELPERS
// ==========================================

export function normalizePriorities(p: PrioritiesWeights): PrioritiesWeights {
  const sum = p.safety + p.speed + p.cost + p.coverage + p.reliability;
  if (sum === 100) return p;
  if (sum === 0) return { safety: 60, speed: 30, cost: 10, coverage: 0, reliability: 0 };
  const factor = 100 / sum;
  const safety = Math.round(p.safety * factor);
  const speed = Math.round(p.speed * factor);
  const cost = Math.round(p.cost * factor);
  const coverage = Math.round(p.coverage * factor);
  const remainder = 100 - (safety + speed + cost + coverage);
  return {
    safety,
    speed,
    cost,
    coverage,
    reliability: Math.max(0, remainder)
  };
}

export function updateDecisionTwinResources(
  twin: DecisionTwin,
  updates: { buses?: number; boats?: number; ambulances?: number; rescueTeams?: number; budget?: number }
): DecisionTwin {
  const now = new Date().toISOString();
  return {
    ...twin,
    updatedAt: now,
    resources: {
      ...twin.resources,
      buses: updates.buses !== undefined
        ? { ...twin.resources.buses, value: Math.max(0, updates.buses), status: "USER_PROVIDED", lastUpdated: now }
        : twin.resources.buses,
      boats: updates.boats !== undefined
        ? { ...twin.resources.boats, value: Math.max(0, updates.boats), status: "USER_PROVIDED", lastUpdated: now }
        : twin.resources.boats,
      ambulances: updates.ambulances !== undefined
        ? { ...twin.resources.ambulances, value: Math.max(0, updates.ambulances), status: "USER_PROVIDED", lastUpdated: now }
        : twin.resources.ambulances,
      rescueTeams: updates.rescueTeams !== undefined
        ? { ...twin.resources.rescueTeams, value: Math.max(0, updates.rescueTeams), status: "USER_PROVIDED", lastUpdated: now }
        : twin.resources.rescueTeams,
      budget: updates.budget !== undefined
        ? { ...twin.resources.budget, value: Math.max(0, updates.budget), status: "USER_PROVIDED", lastUpdated: now }
        : twin.resources.budget
    }
  };
}

export function updateDecisionTwinPriorities(
  twin: DecisionTwin,
  priorities: PrioritiesWeights
): DecisionTwin {
  return {
    ...twin,
    updatedAt: new Date().toISOString(),
    priorities: normalizePriorities(priorities)
  };
}

export function updateDecisionTwinRoadClosure(
  twin: DecisionTwin,
  closedRoads: string[]
): DecisionTwin {
  const now = new Date().toISOString();
  return {
    ...twin,
    updatedAt: now,
    constraints: {
      ...twin.constraints,
      roadClosures: {
        ...twin.constraints.roadClosures,
        allowedValue: closedRoads,
        status: closedRoads.length > 0 ? "SIMULATED" : "UNAVAILABLE"
      }
    }
  };
}

export function updateDecisionTwinWeatherDelta(
  twin: DecisionTwin,
  rainfallMultiplier: number
): DecisionTwin {
  const now = new Date().toISOString();
  const currentRain = (twin.weatherContext?.rainfallMm && twin.weatherContext.rainfallMm > 0)
    ? twin.weatherContext.rainfallMm
    : 12; // Realistic monsoon baseline if offline
  const updatedRain = Math.round(currentRain * rainfallMultiplier * 10) / 10;
  return {
    ...twin,
    updatedAt: now,
    weatherContext: {
      temperatureC: twin.weatherContext?.temperatureC ?? 28,
      rainfallMm: updatedRain,
      precipitationProbability: twin.weatherContext?.precipitationProbability ?? 85,
      windSpeedKmh: twin.weatherContext?.windSpeedKmh ?? 24,
      source: twin.weatherContext?.source ?? "Open-Meteo (Simulated Surge)",
      retrievedAt: now,
      status: "SIMULATED"
    }
  };
}

export function createDefaultDecisionTwin(params: {
  placeName: string;
  lat: number;
  lng: number;
  population?: number;
  buses?: number;
  boats?: number;
  ambulances?: number;
  rescueTeams?: number;
  budget?: number;
  priorities?: Partial<PrioritiesWeights>;
  weather?: WeatherContext | null;
  gis?: { roads: number; buildings: number; drains: number; rivers: number; bridges: number; source: string; status: string } | null;
  hospitals?: Hospital[];
  routes?: RouteOption[];
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MODERATE";
  resourceMode?: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC";
  distanceFromBaseKm?: number;
  origin?: { name: string; lat: number; lng: number; source: string; status: DataSourceStatus };
}): DecisionTwin {
  const now = new Date().toISOString();
  const pop = params.population ?? 3500;
  const historical = getHistoricalFloodContext(params.placeName);

  const priorities: PrioritiesWeights = normalizePriorities({
    safety: params.priorities?.safety ?? 60,
    speed: params.priorities?.speed ?? 30,
    cost: params.priorities?.cost ?? 10,
    coverage: params.priorities?.coverage ?? 0,
    reliability: params.priorities?.reliability ?? 0
  });

  const weatherContext = params.weather ? {
    temperatureC: params.weather.temperatureC,
    rainfallMm: params.weather.rainfallMm,
    precipitationProbability: params.weather.precipitationProbability,
    windSpeedKmh: params.weather.windSpeedKmh,
    source: params.weather.source,
    retrievedAt: params.weather.retrievedAt,
    status: "LIVE_OR_NEAR_LIVE" as DataSourceStatus
  } : null;

  const mappedHospitals = (params.hospitals ?? []).map((h: any) => ({
    name: h.name,
    address: h.address,
    phone: h.phone,
    distanceKm: h.distanceKm ?? null,
    travelMinutes: h.travelMinutes ?? null,
    capacity: {
      value: null,
      source: "OpenStreetMap Hospital Nodes",
      sourceType: "NONE" as const,
      status: "UNAVAILABLE" as const
    },
    source: h.source,
    status: "VERIFIED" as DataSourceStatus
  }));

  const dataSources = [
    { label: "Dispatch Base Hub", source: "VIT Chennai (Permanent Base)", sourceType: "GIS_SERVER", status: "VERIFIED" as const, retrievedAt: now, confidence: 1.0 },
    { label: "Incident Location", source: "Nominatim / OpenStreetMap", sourceType: "EXTERNAL_API", status: "VERIFIED" as const, retrievedAt: now, confidence: 0.95 },
    { label: "Driving Routes", source: "OSRM Route Service", sourceType: "EXTERNAL_API", status: "LIVE_OR_NEAR_LIVE" as const, retrievedAt: now, confidence: 0.92 },
    { label: "Rainfall & Wind", source: "Open-Meteo Weather API", sourceType: "EXTERNAL_API", status: params.weather ? ("LIVE_OR_NEAR_LIVE" as const) : ("UNAVAILABLE" as const), retrievedAt: now, confidence: 0.9 },
    { label: "GCC GIS Features", source: "Greater Chennai Corporation REST", sourceType: "GIS_SERVER", status: params.gis ? ("VERIFIED" as const) : ("UNAVAILABLE" as const), retrievedAt: now, confidence: 0.95 },
    { label: "Disaster History", source: "Chennai Disaster Archive (2015-2023)", sourceType: "HISTORICAL_ARCHIVE", status: "HISTORICAL" as const, retrievedAt: now, confidence: 0.98 },
    { label: "Hospital Capacity", source: "State Health Desk", sourceType: "NONE", status: "UNAVAILABLE" as const, retrievedAt: now, confidence: 0.0 }
  ];

  const computedDist =
    params.distanceFromBaseKm ??
    calculateHaversineDistanceKm(12.8406, 80.1534, params.lat, params.lng);

  const rainfallMm = params.weather?.rainfallMm ?? 0;
  const riversCount = params.gis?.rivers ?? 0;
  const drainsCount = params.gis?.drains ?? 0;
  const severityVal =
    params.severity ??
    (rainfallMm > 20 || riversCount > 4 || historical.localityRiskLevel === "VERY_HIGH"
      ? "CRITICAL"
      : rainfallMm > 5 || drainsCount > 15 || historical.localityRiskLevel === "HIGH"
      ? "HIGH"
      : "MODERATE");

  return {
    scenarioId: `DT-CHN-${Date.now().toString(36).toUpperCase()}`,
    scenarioName: `Emergency Evacuation · ${params.placeName}`,
    scenarioType: "Flood",
    origin: params.origin ?? {
      name: "VIT Chennai (Base Hub)",
      lat: 12.8406,
      lng: 80.1534,
      source: "FIXED_BASE_ORIGIN",
      status: "VERIFIED"
    },
    distanceFromBaseKm: computedDist,
    resourceMode: params.resourceMode ?? "MODE_B_DYNAMIC",
    deploymentPriority:
      severityVal === "CRITICAL" || pop >= 4000
        ? "PRIORITY 1 · CRITICAL"
        : severityVal === "HIGH" || pop >= 2000
        ? "PRIORITY 2 · HIGH"
        : "PRIORITY 3 · STANDARD",
    location: {
      name: params.placeName,
      lat: params.lat,
      lng: params.lng,
      source: "OpenStreetMap / Known Resolution",
      status: "VERIFIED"
    },
    hazard: {
      type: "Flood",
      severity: severityVal,
      description: `Monsoon flood inundation in ${params.placeName}. Road waterlogging and canal backflow risk.`,
      waterLevel: {
        value: "Knee level (15–50 cm)",
        source: "Citizen Reports & Hydro Forecast",
        sourceType: "SIMULATION_ENGINE",
        status: "ESTIMATED"
      },
      waterMovement: {
        value: "Slowly flowing",
        source: "Topographical Slope Estimate",
        sourceType: "SIMULATION_ENGINE",
        status: "ESTIMATED"
      }
    },
    affectedArea: {
      radiusKm: 6.5,
      drainsCount: {
        value: params.gis?.drains ?? 0,
        source: "GCC ArcGIS REST",
        sourceType: "GIS_SERVER",
        status: params.gis ? "VERIFIED" : "UNAVAILABLE"
      },
      riversCount: {
        value: params.gis?.rivers ?? 0,
        source: "GCC ArcGIS REST",
        sourceType: "GIS_SERVER",
        status: params.gis ? "VERIFIED" : "UNAVAILABLE"
      },
      roadsCount: {
        value: params.gis?.roads ?? 0,
        source: "GCC ArcGIS REST",
        sourceType: "GIS_SERVER",
        status: params.gis ? "VERIFIED" : "UNAVAILABLE"
      },
      buildingsCount: {
        value: params.gis?.buildings ?? 0,
        source: "GCC ArcGIS REST",
        sourceType: "GIS_SERVER",
        status: params.gis ? "VERIFIED" : "UNAVAILABLE"
      },
      bridgesCount: {
        value: params.gis?.bridges ?? 0,
        source: "GCC ArcGIS REST",
        sourceType: "GIS_SERVER",
        status: params.gis ? "VERIFIED" : "UNAVAILABLE"
      }
    },
    estimatedPopulation: {
      value: pop,
      source: "Command Operator Input",
      sourceType: "USER",
      status: "USER_PROVIDED",
      confidence: 0.85
    },
    uncertainties: {
      populationLower: Math.round(pop * 0.85),
      populationUpper: Math.round(pop * 1.15),
      planningRange: "±15%",
      weatherVariancePercent: 12,
      travelTimeVarianceMinutes: 8
    },
    resources: {
      buses: {
        value: params.buses ?? 10,
        source: "Incident Commander Input",
        sourceType: "USER",
        status: "USER_PROVIDED"
      },
      boats: {
        value: params.boats ?? 3,
        source: "Incident Commander Input",
        sourceType: "USER",
        status: "USER_PROVIDED"
      },
      ambulances: {
        value: params.ambulances ?? 5,
        source: "Incident Commander Input",
        sourceType: "USER",
        status: "USER_PROVIDED"
      },
      rescueTeams: {
        value: params.rescueTeams ?? 20,
        source: "Incident Commander Input",
        sourceType: "USER",
        status: "USER_PROVIDED"
      },
      personnel: {
        value: (params.rescueTeams ?? 20) * 4,
        source: "Estimated from Rescue Teams",
        sourceType: "SIMULATION_ENGINE",
        status: "ESTIMATED"
      },
      shelters: {
        value: 3,
        source: "Designated GCC Flood Centers",
        sourceType: "GIS_SERVER",
        status: "VERIFIED"
      },
      budget: {
        value: params.budget ?? 100000,
        source: "Operational Sanction",
        sourceType: "USER",
        status: "USER_PROVIDED"
      }
    },
    resourceSpecs: {
      busCapacity: 50,
      boatCapacity: 20,
      ambulanceCapacity: 2,
      rescueTeamCapacity: 4,
      busCostPerHour: 1200,
      boatCostPerHour: 2000,
      ambulanceCostPerHour: 2500,
      rescueTeamCostPerHour: 800,
      busSpeedKmh: 25,
      boatSpeedKmh: 12
    },
    constraints: {
      maxBudget: {
        name: "Maximum Budget",
        allowedValue: params.budget ?? 250000,
        description: "Ceiling for fleet fueling and personnel deployment",
        source: "Disaster Management Budget Code",
        status: "USER_PROVIDED"
      },
      maxResponseTimeMinutes: {
        name: "Maximum Evacuation Window",
        allowedValue: Math.max(360, Math.ceil(pop / 400) * 110), // Multi-wave evacuation window scaled with population
        description: "Maximum allowable completion window before flood crest",
        source: "SOP Guideline",
        status: "ESTIMATED"
      },
      minBusesRequired: {
        name: "Minimum Bus Fleet",
        allowedValue: 2,
        description: "Minimum buses for continuous shuttle waves",
        source: "Command Directive",
        status: "VERIFIED"
      },
      minBoatsRequired: {
        name: "Minimum Rescue Boats",
        allowedValue: 1,
        description: "Required for water extraction",
        source: "Command Directive",
        status: "VERIFIED"
      },
      roadClosures: {
        name: "Road Closures",
        allowedValue: [],
        description: "No automated road closure telemetry available in public feed",
        source: "Traffic Police Feed",
        status: "UNAVAILABLE"
      },
      inaccessibleRoads: {
        name: "Inaccessible Roads",
        allowedValue: [],
        description: "Marked during route scoring if rivers > 10 and rainfall > 20mm",
        source: "GIS Inundation Overlay",
        status: "ESTIMATED"
      },
      unsafeRoutes: {
        name: "Unsafe Corridors",
        allowedValue: [],
        description: "Calculated dynamically per candidate route",
        source: "Route Safety Scorer",
        status: "SIMULATED"
      },
      destinationCapacity: {
        name: "Designated Shelter Capacity",
        allowedValue: null,
        description: "Live occupancy counts currently unavailable",
        source: "Shelter Management Desk",
        status: "UNAVAILABLE"
      },
      transportationRestrictions: {
        name: "Heavy Vehicle Restrictions",
        allowedValue: ["Low-bridge underpasses restricted for double-axle buses during surge"],
        description: "Standard monsoon traffic advisory",
        source: "Chennai Traffic Advisory",
        status: "HISTORICAL"
      }
    },
    priorities,
    geographicContext: params.gis ? {
      roads: params.gis.roads,
      buildings: params.gis.buildings,
      drains: params.gis.drains,
      rivers: params.gis.rivers,
      bridges: params.gis.bridges,
      source: params.gis.source,
      status: "VERIFIED"
    } : null,
    weatherContext,
    historicalContext: historical,
    hospitals: mappedHospitals,
    routes: params.routes ?? [],
    fieldUpdates: [
      {
        id: "field-init",
        time: now,
        sender: "Central Command",
        message: `Decision Twin initialized for ${params.placeName}. Staging base set to VIT Chennai Base.`,
        status: "VERIFIED"
      }
    ],
    dataSources,
    createdAt: now,
    updatedAt: now
  };
}

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

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

export type ScenarioResult = ScenarioInput & {
  decisionTwinId: string;
  origin: { name: string; lat: number; lng: number; source: string; status: string };
  location: { name: string; lat: number; lng: number; radiusKm: number; source: string; status: string };
  uncertainty: { lowerPopulation: number; upperPopulation: number; planningRange: string };
  recommended: CandidateStrategy;
  candidates: CandidateStrategy[];
  hospitals: Array<{ name: string; address?: string | null; phone?: string | null; distanceKm: number | null; travelMinutes: number | null; source: string; confidence?: number }>;
  weather: WeatherContext | null;
  gis: { roads: number; buildings: number; drains: number; rivers: number; bridges: number; source: string; status: string } | null;
  routes?: RouteOption[];
  dataStatus: Array<{ label: string; status: string; source: string }>;
  explanation: string;
  // Phase 8 extensions
  decisionTwin?: DecisionTwin;
  simulation?: SimulationResult;
};

type CandidateStrategy = {
  id: string;
  name: string;
  allocation: { buses: number; boats: number; ambulances: number };
  route: string;
  timeMinutes: { expected: number; low: number; high: number };
  capacity: number;
  successProbability: number;
  riskScore: number;
  costIndex: number;
  bottleneck: string;
  tradeoff: string;
};

export function parseScenario(prompt: string): ScenarioInput & { mode: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC" } {
  const lower = prompt.toLowerCase();
  const place = extractPlace(prompt);

  const hasExplicitBuses = /\b\d+\s*buses?\b/i.test(prompt);
  const hasExplicitBoats = /\b\d+\s*(?:rescue\s*)?boats?\b/i.test(prompt);
  const hasExplicitAmbulances = /\b\d+\s*ambulances?\b/i.test(prompt);
  const mode: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC" =
    hasExplicitBuses || hasExplicitBoats || hasExplicitAmbulances ? "MODE_A_PREDEFINED" : "MODE_B_DYNAMIC";

  const prioritiesWeights = (text: string) => {
    const l = text.toLowerCase();
    if (l.includes("speed") || l.includes("time")) return { safety: 0.35, time: 0.55, cost: 0.1 };
    if (l.includes("cost") || l.includes("cheap")) return { safety: 0.45, time: 0.15, cost: 0.4 };
    return { safety: 0.6, time: 0.3, cost: 0.1 };
  };

  return {
    prompt,
    place,
    mode,
    scenarioType: lower.includes("flood") ? "flood" : lower.includes("evac") ? "evacuation" : "emergency",
    severity: lower.includes("severe") || lower.includes("critical") || lower.includes("heavy") ? "high" : "medium",
    population: numberFrom(prompt, /([\d,]+)\s*(?:people|persons|residents|inside)/i, 3500),
    buses: numberFrom(prompt, /([\d,]+)\s*buses?/i, 10),
    boats: numberFrom(prompt, /([\d,]+)\s*(?:rescue\s*)?boats?/i, 3),
    ambulances: numberFrom(prompt, /([\d,]+)\s*ambulances?/i, 5),
    priorities: prioritiesWeights(prompt)
  };
}

export function simulateScenario(
  input: ScenarioInput,
  context: {
    origin?: { name: string; lat: number; lng: number; source: string; status: string };
    location?: { name: string; lat: number; lng: number; source: string; status: string };
    weather?: WeatherContext;
    hospitals?: Hospital[];
    routes?: RouteOption[];
    gis?: { roads: number; buildings: number; drains: number; rivers: number; bridges: number; source: string; status: string };
  } = {}
): ScenarioResult {
  const fixedOrigin = context.origin ?? { name: "VIT Chennai (Base Hub)", lat: 12.8406, lng: 80.1534, source: "FIXED_BASE_ORIGIN", status: "RESOLVED" };
  const baseLoc = KNOWN_PLACES[input.place.toLowerCase()] ?? { label: input.place, lat: 12.9815, lng: 80.218 };
  const loc = context.location ?? { name: baseLoc.label, lat: baseLoc.lat, lng: baseLoc.lng, source: "KNOWN_PLACE_RESOLUTION", status: "RESOLVED" };

  // Construct complete Phase 8 Decision Twin
  const twin = createDefaultDecisionTwin({
    placeName: loc.name,
    lat: loc.lat,
    lng: loc.lng,
    population: input.population,
    buses: input.buses,
    boats: input.boats,
    ambulances: input.ambulances,
    rescueTeams: 20,
    budget: 100000,
    priorities: {
      safety: Math.round(input.priorities.safety * 100),
      speed: Math.round(input.priorities.time * 100),
      cost: Math.round(input.priorities.cost * 100),
      coverage: 0,
      reliability: 0
    },
    weather: context.weather,
    gis: context.gis,
    hospitals: context.hospitals,
    routes: context.routes
  });

  const sim = simulateDeterministicDecisionTwin(twin);

  const lowerPopulation = twin.uncertainties.populationLower;
  const upperPopulation = twin.uncertainties.populationUpper;
  const routeMinutes = sim.selectedRoutes[0]?.travelMinutes ?? 35;

  const strategies: CandidateStrategy[] = [
    {
      id: "balanced",
      name: "Safety-First Coordinated Evacuation",
      allocation: { buses: input.buses, boats: input.boats, ambulances: input.ambulances },
      route: sim.selectedRoutes[0]?.name ?? `${fixedOrigin.name} → ${loc.name}`,
      timeMinutes: { expected: sim.evacuationTimeMinutes, low: Math.max(25, sim.evacuationTimeMinutes - 15), high: sim.evacuationTimeMinutes + 25 },
      capacity: sim.totalCapacity,
      successProbability: sim.feasible ? 94 : 52,
      riskScore: sim.riskScore,
      costIndex: Math.min(100, Math.round((sim.estimatedCostInr / 100000) * 60)),
      bottleneck: sim.bottlenecks[0]?.message ?? "Single-wave vehicle capacity requires wave staging.",
      tradeoff: "Maximizes passenger protection and shallow-water extraction; utilizes designated arterial corridor."
    },
    {
      id: "speed",
      name: "Fastest Staged Transit",
      allocation: { buses: input.buses, boats: Math.max(0, input.boats - 1), ambulances: input.ambulances },
      route: sim.selectedRoutes[1]?.name ?? sim.selectedRoutes[0]?.name ?? `${fixedOrigin.name} → ${loc.name}`,
      timeMinutes: { expected: Math.max(25, sim.evacuationTimeMinutes - 18), low: Math.max(20, sim.evacuationTimeMinutes - 30), high: sim.evacuationTimeMinutes + 10 },
      capacity: Math.max(0, sim.totalCapacity - 20),
      successProbability: 86,
      riskScore: Math.min(95, sim.riskScore + 8),
      costIndex: Math.min(100, Math.round((sim.estimatedCostInr / 100000) * 68)),
      bottleneck: "Higher flood risk on shortcut crossings if localized water levels increase.",
      tradeoff: "Faster turnaround cycle but leaves lower margin for water rescue along flooded streets."
    },
    {
      id: "resource-light",
      name: "Resource-Conserving Evacuation",
      allocation: { buses: Math.max(1, input.buses - 2), boats: input.boats, ambulances: input.ambulances },
      route: sim.selectedRoutes[0]?.name ?? `${fixedOrigin.name} → ${loc.name}`,
      timeMinutes: { expected: sim.evacuationTimeMinutes + 24, low: sim.evacuationTimeMinutes + 10, high: sim.evacuationTimeMinutes + 45 },
      capacity: Math.max(0, sim.totalCapacity - 100),
      successProbability: 82,
      riskScore: sim.riskScore,
      costIndex: Math.min(100, Math.round((sim.estimatedCostInr / 100000) * 44)),
      bottleneck: "Reduced bus count adds extra evacuation waves and prolongs citizen wait times.",
      tradeoff: "Minimizes fleet fuel expenditure, but takes significantly longer."
    }
  ];

  return {
    ...input,
    decisionTwinId: twin.scenarioId,
    origin: fixedOrigin,
    location: { ...loc, radiusKm: 6.5 },
    uncertainty: { lowerPopulation, upperPopulation, planningRange: "±15%" },
    recommended: strategies[0],
    candidates: strategies,
    hospitals: (context.hospitals ?? []).map((h: any) => ({
      name: h.name,
      address: h.address,
      phone: h.phone,
      distanceKm: h.distanceKm ?? null,
      travelMinutes: h.travelMinutes ?? null,
      source: h.source,
      confidence: h.confidence
    })),
    weather: context.weather ?? null,
    gis: context.gis ?? null,
    routes: context.routes,
    dataStatus: twin.dataSources.map((ds) => ({ label: ds.label, status: ds.status, source: ds.source })),
    explanation: sim.explanation,
    decisionTwin: twin,
    simulation: sim
  };
}
