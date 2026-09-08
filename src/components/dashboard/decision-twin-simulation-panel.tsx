"use client";

import { useState, useEffect, useMemo } from "react";
import {
  type DecisionTwin,
  type SimulationResult,
  type PrioritiesWeights,
  createDefaultDecisionTwin,
  simulateDeterministicDecisionTwin,
  updateDecisionTwinResources,
  updateDecisionTwinPriorities,
  normalizePriorities
} from "@/lib/decision-twin";

interface DecisionTwinSimulationPanelProps {
  initialPlace?: string;
  onDecisionTwinChange?: (twin: DecisionTwin, result: SimulationResult) => void;
  onSelectRoute?: (routeIndex: number) => void;
}

export function DecisionTwinSimulationPanel({
  initialPlace = "Velachery, Chennai",
  onDecisionTwinChange,
  onSelectRoute
}: DecisionTwinSimulationPanelProps) {
  // Preset scenarios
  const PRESETS = [
    {
      label: "Velachery Flood (Acceptance Test)",
      place: "Velachery, Chennai",
      pop: 3500,
      buses: 10,
      boats: 3,
      ambulances: 5,
      teams: 20,
      budget: 100000,
      priorities: { safety: 60, speed: 30, cost: 10, coverage: 0, reliability: 0 }
    },
    {
      label: "Chennai Central Transit Corridor",
      place: "Chennai Central",
      pop: 5000,
      buses: 12,
      boats: 2,
      ambulances: 6,
      teams: 25,
      budget: 150000,
      priorities: { safety: 50, speed: 40, cost: 10, coverage: 0, reliability: 0 }
    },
    {
      label: "Tambaram High Ground Basin",
      place: "Tambaram, Chennai",
      pop: 4200,
      buses: 8,
      boats: 4,
      ambulances: 4,
      teams: 18,
      budget: 120000,
      priorities: { safety: 70, speed: 20, cost: 10, coverage: 0, reliability: 0 }
    }
  ];

  // Active Decision Twin State
  const [twin, setTwin] = useState<DecisionTwin>(() =>
    createDefaultDecisionTwin({
      placeName: "Velachery, Chennai",
      lat: 12.9815,
      lng: 80.218,
      population: 3500,
      buses: 10,
      boats: 3,
      ambulances: 5,
      rescueTeams: 20,
      budget: 100000,
      priorities: { safety: 60, speed: 30, cost: 10, coverage: 0, reliability: 0 }
    })
  );

  // Deterministic Simulation result (pure client recalculation in 0ms)
  const result: SimulationResult = useMemo(() => {
    return simulateDeterministicDecisionTwin(twin);
  }, [twin]);

  // Sync to parent when twin or result updates
  useEffect(() => {
    onDecisionTwinChange?.(twin, result);
  }, [twin, result, onDecisionTwinChange]);

  const [activeTab, setActiveTab] = useState<"simulation" | "decision-twin" | "routes" | "transparency">("simulation");
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // What-If handler: Instant resource changes
  function handleResourceChange(key: "buses" | "boats" | "ambulances" | "rescueTeams" | "budget", value: number) {
    const updated = updateDecisionTwinResources(twin, { [key]: value });
    setTwin(updated);
  }

  // What-If handler: Priority changes
  function handlePriorityChange(key: keyof PrioritiesWeights, value: number) {
    const nextPriorities = { ...twin.priorities, [key]: Math.max(0, Math.min(100, value)) };
    // Auto-normalize so sum is 100%
    const normalized = normalizePriorities(nextPriorities);
    const updated = updateDecisionTwinPriorities(twin, normalized);
    setTwin(updated);
  }

  // Set predefined priority profiles
  function applyPriorityProfile(profile: "safety" | "speed" | "cost" | "balanced") {
    let p: PrioritiesWeights;
    if (profile === "safety") p = { safety: 60, speed: 30, cost: 10, coverage: 0, reliability: 0 };
    else if (profile === "speed") p = { safety: 30, speed: 60, cost: 10, coverage: 0, reliability: 0 };
    else if (profile === "cost") p = { safety: 40, speed: 10, cost: 50, coverage: 0, reliability: 0 };
    else p = { safety: 20, speed: 20, cost: 20, coverage: 20, reliability: 20 };
    setTwin(updateDecisionTwinPriorities(twin, p));
  }

  // Fetch real GIS, weather & routes from backend for a specific place
  async function loadScenarioFromBackend(placeName: string, pop = 3500, buses = 10, boats = 3, ambulances = 5) {
    setLoadingBackend(true);
    try {
      const res = await fetch("/api/decision/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place: placeName,
          population: pop,
          buses,
          boats,
          ambulances,
          budget: twin.resources.budget.value,
          priorities: twin.priorities
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.decisionTwin) {
          setTwin(data.decisionTwin);
        }
      }
    } catch (e) {
      console.error("Failed to load backend scenario data", e);
    } finally {
      setLoadingBackend(false);
    }
  }

  // On mount, pull live backend data for default location
  useEffect(() => {
    loadScenarioFromBackend("Velachery, Chennai", 3500, 10, 3, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-6 shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#23354d] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#39d4b4]/20 text-sm">
              ⚙️
            </span>
            <span className="text-xs font-bold tracking-[.18em] text-[#39d4b4]">
              PHASE 8 · DECISION TWIN & DETERMINISTIC SIMULATION
            </span>
          </div>
          <h2 className="mt-1.5 text-2xl font-bold text-[#e6edf7]">
            {twin.location.name} — Real-Time Emergency Engine
          </h2>
          <p className="mt-0.5 text-xs text-[#9aabc1]">
            Mathematical simulation engine (100% deterministic) evaluating wave evacuation times, fleet capacities, OSRM road corridors, and bottlenecks.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-bold ${
              result.feasible
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border border-red-500/40 bg-red-500/10 text-red-300 animate-pulse"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${result.feasible ? "bg-emerald-400" : "bg-red-400"}`} />
            {result.feasible ? "FEASIBLE" : "INFEASIBLE"}
          </span>

          <span className="rounded-full border border-[#39d4b4]/40 bg-[#113c3d] px-3.5 py-1 font-mono text-xs font-bold text-[#69e8d1]">
            Score: {result.score}/100
          </span>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[#9aabc1]">Scenario Presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              loadScenarioFromBackend(p.place, p.pop, p.buses, p.boats, p.ambulances);
            }}
            disabled={loadingBackend}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              twin.location.name.toLowerCase().includes(p.place.toLowerCase())
                ? "border-[#39d4b4] bg-[#39d4b4]/20 text-[#69e8d1]"
                : "border-[#39506e] bg-[#07111f] text-[#9aabc1] hover:border-[#39d4b4]/50"
            }`}
          >
            {p.label}
          </button>
        ))}
        {loadingBackend && <span className="text-xs text-[#39d4b4] animate-pulse">Syncing GIS & routes…</span>}
      </div>

      {/* Navigation Tabs */}
      <div className="mt-5 flex border-b border-[#23354d]">
        {[
          { id: "simulation", label: "⚡ Simulation & What-If" },
          { id: "decision-twin", label: "🧬 Decision Twin Spec" },
          { id: "routes", label: `🛣️ Route Candidates (${result.selectedRoutes.length})` },
          { id: "transparency", label: "🔍 Data Transparency & Status" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
              activeTab === tab.id
                ? "border-[#39d4b4] text-[#39d4b4]"
                : "border-transparent text-[#9aabc1] hover:text-[#e6edf7]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: SIMULATION & WHAT-IF ENGINE */}
      {activeTab === "simulation" && (
        <div className="mt-6 space-y-6">
          {/* Top Row: Core Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              label="Evacuation Time"
              value={`${result.evacuationTimeMinutes} min`}
              subtext={`${result.wavesRequired} wave(s) needed`}
              color="teal"
            />
            <MetricCard
              label="Corridor Distance"
              value={`${result.totalDistanceKm} km`}
              subtext="VIT Base → Incident"
              color="blue"
            />
            <MetricCard
              label="Estimated Cost"
              value={`₹${result.estimatedCostInr.toLocaleString()}`}
              subtext={`Limit: ₹${twin.constraints.maxBudget.allowedValue.toLocaleString()}`}
              color={result.estimatedCostInr > twin.constraints.maxBudget.allowedValue ? "red" : "teal"}
            />
            <MetricCard
              label="Flood Risk Score"
              value={`${result.riskScore}/100`}
              subtext={twin.historicalContext.localityRiskLevel + " locality"}
              color={result.riskScore > 60 ? "red" : "teal"}
            />
            <MetricCard
              label="Single Wave Cap."
              value={`${result.singleWaveCapacity} ppl`}
              subtext={`Fleet total: ${result.totalCapacity}`}
              color="teal"
            />
            <MetricCard
              label="Affected Population"
              value={`${twin.estimatedPopulation.value.toLocaleString()}`}
              subtext={`Uncertainty ${twin.uncertainties.planningRange}`}
              color="blue"
            />
          </div>

          {/* Critical Constraint Violations Alert */}
          {result.constraintViolations.length > 0 && (
            <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-lg">⚠️</span>
                <h4 className="text-sm font-bold tracking-wide">
                  {result.constraintViolations.length} Constraint Violation(s) Detected
                </h4>
              </div>
              <div className="mt-2.5 space-y-2">
                {result.constraintViolations.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-[#07111f]/60 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-red-200">{v.constraint}:</span>{" "}
                      <span className="text-[#9aabc1]">{v.message}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-red-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-red-300">
                        {v.severity}
                      </span>
                      <span className="font-mono text-[11px] text-[#9aabc1]">
                        Actual: <b className="text-white">{v.actualValue}</b> / Allowed:{" "}
                        <b className="text-white">{v.allowedValue}</b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottlenecks Callout */}
          {result.bottlenecks.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="text-base">🚨</span>
                <h4 className="text-sm font-bold tracking-wide">Primary Operational Bottlenecks</h4>
              </div>
              <div className="mt-2.5 space-y-2">
                {result.bottlenecks.map((b, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-amber-500/20 bg-[#07111f]/70 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">{b.resourceOrFactor}</span>
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] text-amber-300 font-semibold">
                        {b.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[#e6edf7]">{b.message}</p>
                    <p className="mt-1 text-[11px] text-[#9aabc1]">
                      <b>Impact:</b> {b.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DYNAMIC WHAT-IF CONTROLS: RESOURCES & PRIORITIES */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Box: Dynamic Resources */}
            <div className="rounded-xl border border-[#39506e] bg-[#10233a] p-5">
              <div className="flex items-center justify-between border-b border-[#23354d] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#e6edf7]">Dynamic Resources Allocation</h3>
                  <p className="text-xs text-[#9aabc1]">Instant what-if: tweak numbers to rerun the simulation in 0ms.</p>
                </div>
                <span className="rounded-full bg-[#39d4b4]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#39d4b4]">
                  LIVE WHAT-IF
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {/* Buses */}
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-[#e6edf7]">
                      🚌 Buses (50 cap / ₹1,200/hr)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResourceChange("buses", Math.max(0, twin.resources.buses.value - 1))}
                        className="h-6 w-6 rounded bg-[#07111f] text-sm hover:bg-[#23354d]"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={twin.resources.buses.value}
                        onChange={(e) => handleResourceChange("buses", Number(e.target.value))}
                        className="w-16 rounded border border-[#39506e] bg-[#07111f] px-2 py-0.5 text-center font-mono text-sm font-bold text-[#39d4b4]"
                      />
                      <button
                        type="button"
                        onClick={() => handleResourceChange("buses", twin.resources.buses.value + 1)}
                        className="h-6 w-6 rounded bg-[#07111f] text-sm hover:bg-[#23354d]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={twin.resources.buses.value}
                    onChange={(e) => handleResourceChange("buses", Number(e.target.value))}
                    className="mt-2 w-full accent-[#39d4b4]"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-[#9aabc1]">
                    <span>Single-wave bus throughput: {twin.resources.buses.value * 50} persons</span>
                    <span>Utilization: {result.resourceUtilization.buses.utilizationPercent}%</span>
                  </div>
                </div>

                {/* Boats */}
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-[#e6edf7]">
                      🚤 Rescue Boats (20 cap / ₹2,000/hr)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResourceChange("boats", Math.max(0, twin.resources.boats.value - 1))}
                        className="h-6 w-6 rounded bg-[#07111f] text-sm hover:bg-[#23354d]"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={twin.resources.boats.value}
                        onChange={(e) => handleResourceChange("boats", Number(e.target.value))}
                        className="w-16 rounded border border-[#39506e] bg-[#07111f] px-2 py-0.5 text-center font-mono text-sm font-bold text-[#39d4b4]"
                      />
                      <button
                        type="button"
                        onClick={() => handleResourceChange("boats", twin.resources.boats.value + 1)}
                        className="h-6 w-6 rounded bg-[#07111f] text-sm hover:bg-[#23354d]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={twin.resources.boats.value}
                    onChange={(e) => handleResourceChange("boats", Number(e.target.value))}
                    className="mt-2 w-full accent-[#39d4b4]"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-[#9aabc1]">
                    <span>Single-wave boat capacity: {twin.resources.boats.value * 20} persons</span>
                    <span>Utilization: {result.resourceUtilization.boats.utilizationPercent}%</span>
                  </div>
                </div>

                {/* Ambulances */}
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-[#e6edf7]">
                      🚑 Ambulances (2 cap / ₹2,500/hr)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResourceChange("ambulances", Math.max(0, twin.resources.ambulances.value - 1))}
                        className="h-6 w-6 rounded bg-[#07111f] text-sm hover:bg-[#23354d]"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={twin.resources.ambulances.value}
                        onChange={(e) => handleResourceChange("ambulances", Number(e.target.value))}
                        className="w-16 rounded border border-[#39506e] bg-[#07111f] px-2 py-0.5 text-center font-mono text-sm font-bold text-[#39d4b4]"
                      />
                      <button
                        type="button"
                        onClick={() => handleResourceChange("ambulances", twin.resources.ambulances.value + 1)}
                        className="h-6 w-6 rounded bg-[#07111f] text-sm hover:bg-[#23354d]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={twin.resources.ambulances.value}
                    onChange={(e) => handleResourceChange("ambulances", Number(e.target.value))}
                    className="mt-2 w-full accent-[#39d4b4]"
                  />
                </div>

                {/* Rescue Teams & Budget */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-[#e6edf7]">Rescue Teams</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={twin.resources.rescueTeams.value}
                      onChange={(e) => handleResourceChange("rescueTeams", Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-[#39506e] bg-[#07111f] p-2 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#e6edf7]">Max Budget (₹)</label>
                    <input
                      type="number"
                      step="10000"
                      value={twin.resources.budget.value}
                      onChange={(e) => handleResourceChange("budget", Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-[#39506e] bg-[#07111f] p-2 font-mono text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Priority Weights (Strict 100% sum) */}
            <div className="rounded-xl border border-[#39506e] bg-[#10233a] p-5">
              <div className="flex items-center justify-between border-b border-[#23354d] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#e6edf7]">Priorities Weights (Sum = 100%)</h3>
                  <p className="text-xs text-[#9aabc1]">Adjust weightings to alter the simulation ranking criteria.</p>
                </div>
                <span className="rounded-full bg-[#39d4b4]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#39d4b4]">
                  Total: {twin.priorities.safety + twin.priorities.speed + twin.priorities.cost + twin.priorities.coverage + twin.priorities.reliability}%
                </span>
              </div>

              {/* Priority Profiles */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPriorityProfile("safety")}
                  className="rounded border border-[#39506e] bg-[#07111f] px-2.5 py-1 text-[11px] font-medium text-[#69e8d1] hover:border-[#39d4b4]"
                >
                  🛡️ Safety-First (60/30/10)
                </button>
                <button
                  type="button"
                  onClick={() => applyPriorityProfile("speed")}
                  className="rounded border border-[#39506e] bg-[#07111f] px-2.5 py-1 text-[11px] font-medium text-[#69e8d1] hover:border-[#39d4b4]"
                >
                  ⚡ Speed-First (30/60/10)
                </button>
                <button
                  type="button"
                  onClick={() => applyPriorityProfile("cost")}
                  className="rounded border border-[#39506e] bg-[#07111f] px-2.5 py-1 text-[11px] font-medium text-[#69e8d1] hover:border-[#39d4b4]"
                >
                  💰 Cost-Conscious (40/10/50)
                </button>
                <button
                  type="button"
                  onClick={() => applyPriorityProfile("balanced")}
                  className="rounded border border-[#39506e] bg-[#07111f] px-2.5 py-1 text-[11px] font-medium text-[#69e8d1] hover:border-[#39d4b4]"
                >
                  ⚖️ Balanced (20% each)
                </button>
              </div>

              <div className="mt-4 space-y-3.5">
                <PrioritySlider
                  label="Safety Priority"
                  weight={twin.priorities.safety}
                  subtext="Avoids inundated canals & high-risk corridors"
                  onChange={(v) => handlePriorityChange("safety", v)}
                />
                <PrioritySlider
                  label="Speed Priority"
                  weight={twin.priorities.speed}
                  subtext="Prioritizes shortest turnaround & fastest evacuation waves"
                  onChange={(v) => handlePriorityChange("speed", v)}
                />
                <PrioritySlider
                  label="Cost Priority"
                  weight={twin.priorities.cost}
                  subtext="Conserves vehicle fleet operational hours & fuel expenditure"
                  onChange={(v) => handlePriorityChange("cost", v)}
                />
                <PrioritySlider
                  label="Coverage Priority"
                  weight={twin.priorities.coverage}
                  subtext="Ensures total affected population coverage in minimal waves"
                  onChange={(v) => handlePriorityChange("coverage", v)}
                />
                <PrioritySlider
                  label="Reliability Priority"
                  weight={twin.priorities.reliability}
                  subtext="Penalizes routes near known stormwater drains"
                  onChange={(v) => handlePriorityChange("reliability", v)}
                />
              </div>
            </div>
          </div>

          {/* Operational Briefing / Explanation */}
          <div className="rounded-xl border border-[#39d4b4]/40 bg-[#0b292d] p-4 text-xs leading-relaxed text-[#c5d7e9]">
            <p className="font-bold text-[#69e8d1] tracking-wide">DECISION TWIN OPERATIONAL BRIEFING</p>
            <p className="mt-1.5">{result.explanation}</p>
          </div>
        </div>
      )}

      {/* TAB 2: DECISION TWIN SPECIFICATION */}
      {activeTab === "decision-twin" && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SpecCard title="Scenario Identification">
              <p><b>ID:</b> <span className="font-mono text-[#39d4b4]">{twin.scenarioId}</span></p>
              <p><b>Name:</b> {twin.scenarioName}</p>
              <p><b>Type:</b> {twin.scenarioType}</p>
              <p><b>Hazard:</b> {twin.hazard.description}</p>
              <p><b>Water Depth:</b> {twin.hazard.waterLevel.value} ({twin.hazard.waterLevel.status})</p>
            </SpecCard>

            <SpecCard title="Geographic & Environmental Context">
              <p><b>Location:</b> {twin.location.name}</p>
              <p><b>Coordinates:</b> {twin.location.lat.toFixed(4)}, {twin.location.lng.toFixed(4)}</p>
              <p><b>Storm Drains in Area:</b> {twin.geographicContext?.drains ?? "0"} (GCC GIS)</p>
              <p><b>Rivers in Area:</b> {twin.geographicContext?.rivers ?? "0"} (GCC GIS)</p>
              <p><b>Recorded Rainfall:</b> {twin.weatherContext?.rainfallMm ?? 0} mm (Open-Meteo)</p>
            </SpecCard>

            <SpecCard title="Historical Disaster Record">
              <p><b>Locality Risk:</b> <span className="font-bold text-amber-400">{twin.historicalContext.localityRiskLevel}</span></p>
              <p><b>Historical Match:</b> {twin.historicalContext.matchedEvent ? twin.historicalContext.matchedEvent.name : "None specific"}</p>
              <p className="text-[11px] leading-relaxed text-[#9aabc1]">{twin.historicalContext.historicalInundationNotes}</p>
            </SpecCard>
          </div>

          <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-4 text-xs">
            <h4 className="font-bold text-[#e6edf7]">Active Constraints Enforced</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded bg-[#07111f] p-2.5">
                <p className="text-[#9aabc1]">Max Response Window</p>
                <p className="font-mono font-bold text-white">{twin.constraints.maxResponseTimeMinutes.allowedValue} min</p>
              </div>
              <div className="rounded bg-[#07111f] p-2.5">
                <p className="text-[#9aabc1]">Max Operating Budget</p>
                <p className="font-mono font-bold text-white">₹{twin.constraints.maxBudget.allowedValue.toLocaleString()}</p>
              </div>
              <div className="rounded bg-[#07111f] p-2.5">
                <p className="text-[#9aabc1]">Min Boat Requirement</p>
                <p className="font-mono font-bold text-white">≥ {twin.constraints.minBoatsRequired.allowedValue} boats</p>
              </div>
              <div className="rounded bg-[#07111f] p-2.5">
                <p className="text-[#9aabc1]">Min Bus Requirement</p>
                <p className="font-mono font-bold text-white">≥ {twin.constraints.minBusesRequired.allowedValue} buses</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CANDIDATE ROUTES */}
      {activeTab === "routes" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#9aabc1]">
              Routes calculated from <b>VIT Chennai Base</b> to <b>{twin.location.name}</b> and scored deterministically.
            </p>
            <span className="text-xs text-[#39d4b4]">Click route to highlight on map</span>
          </div>

          <div className="space-y-3">
            {result.selectedRoutes.map((r, idx) => (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedRouteIdx(idx);
                  onSelectRoute?.(idx);
                }}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  r.isRecommended
                    ? "border-[#39d4b4] bg-[#102d35]"
                    : "border-[#23354d] bg-[#10233a] hover:border-[#39506e]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#07111f] text-xs font-bold text-[#39d4b4]">
                      {idx + 1}
                    </span>
                    <h4 className="font-bold text-sm text-[#e6edf7]">{r.name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.isRecommended && (
                      <span className="rounded bg-[#39d4b4]/20 px-2 py-0.5 text-[11px] font-bold text-[#69e8d1]">
                        ★ RECOMMENDED (HIGHEST SCORE)
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-white">
                      Score: {r.score}/100
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded bg-[#07111f]/60 p-2">
                    <p className="text-[#9aabc1]">One-Way Time</p>
                    <p className="font-semibold text-white">{r.travelMinutes} min</p>
                  </div>
                  <div className="rounded bg-[#07111f]/60 p-2">
                    <p className="text-[#9aabc1]">Distance</p>
                    <p className="font-semibold text-white">{r.distanceKm} km</p>
                  </div>
                  <div className="rounded bg-[#07111f]/60 p-2">
                    <p className="text-[#9aabc1]">Flood Risk Index</p>
                    <p className="font-semibold text-amber-300">{r.riskScore}/100</p>
                  </div>
                  <div className="rounded bg-[#07111f]/60 p-2">
                    <p className="text-[#9aabc1]">Safety Score</p>
                    <p className="font-semibold text-emerald-300">{r.safetyScore}/100</p>
                  </div>
                </div>

                <p className="mt-2 text-xs text-[#b6c4d5]">{r.tradeoffRationale}</p>

                {/* Available vs Unavailable Factors */}
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="text-[#9aabc1]">Available:</span>
                  {r.availableFactors.map((f, i) => (
                    <span key={i} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                      ✓ {f}
                    </span>
                  ))}
                  <span className="ml-2 text-[#9aabc1]">Unavailable:</span>
                  {r.unavailableFactors.map((f, i) => (
                    <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[#9aabc1]">
                      ✗ {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DATA TRANSPARENCY */}
      {activeTab === "transparency" && (
        <div className="mt-6 space-y-3">
          <p className="text-xs text-[#9aabc1]">
            Every input and metric retains provenance metadata. No fictitious geographic or hospital numbers are fabricated.
          </p>
          <div className="space-y-2">
            {twin.dataSources.map((ds, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#23354d] bg-[#10233a] p-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#e6edf7]">{ds.label}</p>
                  <p className="text-[11px] text-[#9aabc1]">
                    Source: <span className="text-[#69e8d1]">{ds.source}</span> ({ds.sourceType})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                      ds.status === "VERIFIED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : ds.status === "LIVE_OR_NEAR_LIVE"
                        ? "bg-blue-500/20 text-blue-300"
                        : ds.status === "HISTORICAL"
                        ? "bg-purple-500/20 text-purple-300"
                        : ds.status === "UNAVAILABLE"
                        ? "bg-zinc-800 text-zinc-400"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {ds.status}
                  </span>
                  <span className="font-mono text-[11px] text-[#9aabc1]">
                    Confidence: {Math.round((ds.confidence ?? 0.8) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  color = "teal"
}: {
  label: string;
  value: string;
  subtext: string;
  color?: "teal" | "blue" | "red";
}) {
  const bgClass =
    color === "red"
      ? "bg-red-500/10 border-red-500/30"
      : color === "blue"
      ? "bg-blue-500/10 border-blue-500/30"
      : "bg-[#113c3d] border-[#39d4b4]/30";
  const valColor =
    color === "red" ? "text-red-300" : color === "blue" ? "text-blue-200" : "text-[#69e8d1]";

  return (
    <div className={`rounded-xl border p-3.5 ${bgClass}`}>
      <p className="text-[11px] text-[#9aabc1]">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${valColor}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-[#9aabc1] truncate">{subtext}</p>
    </div>
  );
}

function PrioritySlider({
  label,
  weight,
  subtext,
  onChange
}: {
  label: string;
  weight: number;
  subtext: string;
  onChange: (val: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#e6edf7]">{label}</span>
        <span className="font-mono font-bold text-[#39d4b4]">{weight}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={weight}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[#39d4b4]"
      />
      <p className="text-[10px] text-[#9aabc1]">{subtext}</p>
    </div>
  );
}

function SpecCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-4 text-xs space-y-1.5">
      <h4 className="font-bold text-[#e6edf7] border-b border-[#23354d] pb-2">{title}</h4>
      <div className="space-y-1 text-[#b6c4d5]">{children}</div>
    </div>
  );
}
