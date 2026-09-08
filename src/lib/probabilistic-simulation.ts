import type { DecisionTwin, SimulationResult } from "@/lib/decision-twin";
import { simulateDeterministicDecisionTwin } from "@/lib/decision-twin";

// ==========================================
// PHASE 9: PROBABILISTIC SIMULATION (MONTE CARLO)
// ==========================================

export type DistributionType = "UNIFORM" | "NORMAL" | "TRIANGULAR";

export interface UncertaintyVariable {
  id: string;
  name: string;
  enabled: boolean;
  baseValue: number;
  min: number;
  max: number;
  mode?: number; // for triangular
  stdDev?: number; // for normal
  unit: string;
  distribution: DistributionType;
  explanation: string;
}

export interface MonteCarloConfig {
  iterations: 100 | 500 | 1000 | 5000;
  seed: number;
  uncertainties: Record<string, UncertaintyVariable>;
}

export interface PercentileStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  stdDev: number;
}

export interface RiskDistributionBuckets {
  low: { count: number; percentage: number }; // < 35
  moderate: { count: number; percentage: number }; // 35 - 59
  high: { count: number; percentage: number }; // 60 - 79
  critical: { count: number; percentage: number }; // >= 80
}

export interface MonteCarloIterationSummary {
  iteration: number;
  evacuationTimeMinutes: number;
  estimatedCostInr: number;
  riskScore: number;
  score: number;
  feasible: boolean;
  sampledPopulation: number;
  sampledRainfallMm: number;
}

export interface ProbabilisticSimulationResult {
  totalIterations: number;
  seed: number;
  successCount: number;
  failureCount: number;
  successProbability: number; // 0 to 100%
  failureProbability: number; // 0 to 100%
  timeStats: PercentileStats;
  costStats: PercentileStats;
  riskStats: PercentileStats;
  scoreStats: PercentileStats;
  riskDistribution: RiskDistributionBuckets;
  sampledIterationsPreview: MonteCarloIterationSummary[]; // first 20 for transparency inspection
  assumptions: UncertaintyVariable[];
  computedAt: string;
}

// ==========================================
// SEEDED PSEUDO-RANDOM NUMBER GENERATOR (MULBERRY32)
// ==========================================

export function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==========================================
// STATISTICAL DISTRIBUTION SAMPLERS
// ==========================================

export function sampleUniform(min: number, max: number, prng: () => number): number {
  return min + prng() * (max - min);
}

export function sampleNormal(mean: number, stdDev: number, min: number, max: number, prng: () => number): number {
  // Box-Muller transform
  const u1 = Math.max(1e-7, prng());
  const u2 = prng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const val = mean + z * stdDev;
  return Math.min(max, Math.max(min, val));
}

export function sampleTriangular(min: number, max: number, mode: number, prng: () => number): number {
  const u = prng();
  const f = (mode - min) / (max - min);
  if (u < f) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

export function sampleVariable(v: UncertaintyVariable, prng: () => number): number {
  if (!v.enabled) return v.baseValue;

  switch (v.distribution) {
    case "UNIFORM":
      return sampleUniform(v.min, v.max, prng);
    case "NORMAL":
      return sampleNormal(v.baseValue, v.stdDev ?? (v.max - v.min) / 4, v.min, v.max, prng);
    case "TRIANGULAR":
      return sampleTriangular(v.min, v.max, v.mode ?? v.baseValue, prng);
    default:
      return v.baseValue;
  }
}

// ==========================================
// DEFAULT CONFIGURABLE UNCERTAINTIES
// ==========================================

export function getDefaultUncertainties(twin: DecisionTwin): Record<string, UncertaintyVariable> {
  const pop = twin.estimatedPopulation.value;
  const rainfall = twin.weatherContext?.rainfallMm ?? 5;

  return {
    affectedPopulation: {
      id: "affectedPopulation",
      name: "Affected Population Variance",
      enabled: true,
      baseValue: pop,
      min: Math.round(pop * 0.8),
      max: Math.round(pop * 1.25),
      stdDev: Math.round(pop * 0.08),
      unit: "people",
      distribution: "NORMAL",
      explanation: "Field headcounts during floods exhibit ±20% variation as unrecorded household residents emerge."
    },
    rainfall: {
      id: "rainfall",
      name: "Precipitation Surge / Cloudburst",
      enabled: true,
      baseValue: rainfall,
      min: Math.max(0, rainfall * 0.7),
      max: rainfall > 0 ? rainfall * 1.8 + 15 : 25,
      mode: rainfall,
      unit: "mm/hr",
      distribution: "TRIANGULAR",
      explanation: "Monsoon convective cloudbursts create localized spikes in surface runoff."
    },
    traffic: {
      id: "traffic",
      name: "Urban Congestion Factor",
      enabled: true,
      baseValue: 1.0,
      min: 0.9,
      max: 1.45,
      unit: "x multiplier",
      distribution: "UNIFORM",
      explanation: "Panic departures and stalled civilian vehicles cause arterial transit corridor slowdowns."
    },
    travelTime: {
      id: "travelTime",
      name: "Corridor Turnaround Delay",
      enabled: true,
      baseValue: 0,
      min: -5,
      max: 20,
      stdDev: 6,
      unit: "minutes",
      distribution: "NORMAL",
      explanation: "Vehicle turnaround cycles vary due to junction waterlogging and manual traffic diversions."
    },
    roadAccessibility: {
      id: "roadAccessibility",
      name: "Road Inundation Obstruction",
      enabled: true,
      baseValue: 5,
      min: 0,
      max: 25,
      unit: "% probability",
      distribution: "UNIFORM",
      explanation: "Probability of secondary bridge approaches or low underpasses becoming temporarily impassable."
    },
    responseDelay: {
      id: "responseDelay",
      name: "Staging & Manifest Latency",
      enabled: true,
      baseValue: 15,
      min: 10,
      max: 35,
      mode: 15,
      unit: "minutes",
      distribution: "TRIANGULAR",
      explanation: "Time required for elderly/child boarding, headcount manifest, and life vest distribution."
    },
    vehicleAvailability: {
      id: "vehicleAvailability",
      name: "Fleet Attrition (Breakdowns)",
      enabled: true,
      baseValue: 0,
      min: 0,
      max: 2,
      unit: "buses unavailable",
      distribution: "UNIFORM",
      explanation: "Occasional mechanical failure or water ingress in vehicle exhaust/air filters."
    },
    routeDisruption: {
      id: "routeDisruption",
      name: "Canal Surge Secondary Risk",
      enabled: true,
      baseValue: 10,
      min: 0,
      max: 30,
      unit: "% risk delta",
      distribution: "UNIFORM",
      explanation: "Secondary risk of surplus canal overflow impacting arterial road shoulders."
    }
  };
}

// ==========================================
// PERCENTILE CALCULATION HELPER
// ==========================================

function computePercentiles(values: number[]): PercentileStats {
  if (values.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const getP = (p: number) => {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(n * p)));
    return sorted[idx];
  };

  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Math.round((sum / n) * 10) / 10;
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  return {
    mean,
    median: getP(0.5),
    min: sorted[0],
    max: sorted[n - 1],
    p10: getP(0.1),
    p25: getP(0.25),
    p50: getP(0.5),
    p75: getP(0.75),
    p90: getP(0.9),
    stdDev
  };
}

// ==========================================
// MONTE CARLO SIMULATION ENGINE
// ==========================================

export function runMonteCarloSimulation(
  twin: DecisionTwin,
  customConfig?: Partial<MonteCarloConfig>
): ProbabilisticSimulationResult {
  const iterations = customConfig?.iterations ?? 1000;
  const seed = customConfig?.seed ?? 424242;
  const uncertainties = customConfig?.uncertainties ?? getDefaultUncertainties(twin);

  const prng = createMulberry32(seed);

  const times: number[] = [];
  const costs: number[] = [];
  const risks: number[] = [];
  const scores: number[] = [];
  let successCount = 0;

  const maxTimeAllowed = twin.constraints.maxResponseTimeMinutes.allowedValue;
  const maxBudgetAllowed = twin.constraints.maxBudget.allowedValue;

  let lowRiskCount = 0;
  let modRiskCount = 0;
  let highRiskCount = 0;
  let critRiskCount = 0;

  const summariesPreview: MonteCarloIterationSummary[] = [];

  for (let i = 0; i < iterations; i++) {
    // 1. Sample enabled uncertainties
    const sampledPop = Math.round(sampleVariable(uncertainties.affectedPopulation, prng));
    const sampledRainfall = Math.round(sampleVariable(uncertainties.rainfall, prng) * 10) / 10;
    const sampledTraffic = sampleVariable(uncertainties.traffic, prng);
    const sampledTravelDelay = Math.round(sampleVariable(uncertainties.travelTime, prng));
    const sampledAttrition = Math.round(sampleVariable(uncertainties.vehicleAvailability, prng));
    const sampledStagingDelay = Math.round(sampleVariable(uncertainties.responseDelay, prng));

    // 2. Clone twin state for iteration (never mutate original)
    const clone: DecisionTwin = {
      ...twin,
      estimatedPopulation: {
        ...twin.estimatedPopulation,
        value: Math.max(10, sampledPop)
      },
      resources: {
        ...twin.resources,
        buses: {
          ...twin.resources.buses,
          value: Math.max(1, twin.resources.buses.value - sampledAttrition)
        }
      },
      weatherContext: twin.weatherContext
        ? {
            ...twin.weatherContext,
            rainfallMm: Math.max(0, sampledRainfall)
          }
        : null
    };

    // 3. Run deterministic simulation on sampled clone
    const simResult: SimulationResult = simulateDeterministicDecisionTwin(clone);

    // Apply traffic and staging variance to the iteration evacuation time
    const adjustedTime = Math.max(
      15,
      Math.round((simResult.evacuationTimeMinutes + sampledTravelDelay + (sampledStagingDelay - 15)) * sampledTraffic)
    );

    // Iteration success criteria: feasible AND within response time limit and budget tolerance
    const isSuccessful =
      simResult.feasible &&
      adjustedTime <= Math.round(maxTimeAllowed * 1.15) &&
      (maxBudgetAllowed <= 0 || simResult.estimatedCostInr <= Math.round(maxBudgetAllowed * 1.25));

    if (isSuccessful) {
      successCount++;
    }

    times.push(adjustedTime);
    costs.push(simResult.estimatedCostInr);
    risks.push(simResult.riskScore);
    scores.push(simResult.score);

    // Risk distribution tally
    if (simResult.riskScore < 35) lowRiskCount++;
    else if (simResult.riskScore < 60) modRiskCount++;
    else if (simResult.riskScore < 80) highRiskCount++;
    else critRiskCount++;

    // Preview for first 15 iterations
    if (i < 15) {
      summariesPreview.push({
        iteration: i + 1,
        evacuationTimeMinutes: adjustedTime,
        estimatedCostInr: simResult.estimatedCostInr,
        riskScore: simResult.riskScore,
        score: simResult.score,
        feasible: isSuccessful,
        sampledPopulation: sampledPop,
        sampledRainfallMm: sampledRainfall
      });
    }
  }

  const successProbability = Math.round((successCount / iterations) * 1000) / 10;
  const failureProbability = Math.round((100 - successProbability) * 10) / 10;

  return {
    totalIterations: iterations,
    seed,
    successCount,
    failureCount: iterations - successCount,
    successProbability,
    failureProbability,
    timeStats: computePercentiles(times),
    costStats: computePercentiles(costs),
    riskStats: computePercentiles(risks),
    scoreStats: computePercentiles(scores),
    riskDistribution: {
      low: { count: lowRiskCount, percentage: Math.round((lowRiskCount / iterations) * 100) },
      moderate: { count: modRiskCount, percentage: Math.round((modRiskCount / iterations) * 100) },
      high: { count: highRiskCount, percentage: Math.round((highRiskCount / iterations) * 100) },
      critical: { count: critRiskCount, percentage: Math.round((critRiskCount / iterations) * 100) }
    },
    sampledIterationsPreview: summariesPreview,
    assumptions: Object.values(uncertainties),
    computedAt: new Date().toISOString()
  };
}
