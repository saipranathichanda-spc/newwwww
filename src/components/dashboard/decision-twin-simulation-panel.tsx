"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  type DecisionTwin,
  type SimulationResult,
  type PrioritiesWeights,
  createDefaultDecisionTwin,
  simulateDeterministicDecisionTwin,
  updateDecisionTwinResources,
  updateDecisionTwinPriorities,
  updateDecisionTwinRoadClosure,
  updateDecisionTwinWeatherDelta,
  normalizePriorities,
  KNOWN_PLACES
} from "@/lib/decision-twin";
import {
  SCENARIO_PRESETS,
  getScenarioPreset,
  resolveBestDestination,
  type ScenarioPreset,
  type VerifiedDestination
} from "@/lib/scenario-presets";
import {
  runMonteCarloSimulation,
  getDefaultUncertainties,
  type ProbabilisticSimulationResult,
  type UncertaintyVariable
} from "@/lib/probabilistic-simulation";

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
  // Active Preset Selection
  const [selectedPresetId, setSelectedPresetId] = useState<string>("velachery-flood");

  // Active Decision Twin State (initialized with Velachery Flood preset)
  const [twin, setTwin] = useState<DecisionTwin>(() => {
    const preset = SCENARIO_PRESETS[0];
    return createDefaultDecisionTwin({
      placeName: preset.locationName,
      lat: preset.coords.lat,
      lng: preset.coords.lng,
      population: preset.defaultPopulation,
      buses: preset.defaultResources.buses,
      boats: preset.defaultResources.boats,
      ambulances: preset.defaultResources.ambulances,
      rescueTeams: preset.defaultResources.rescueTeams,
      budget: preset.defaultResources.budget,
      priorities: preset.defaultPriorities
    });
  });

  const [customLocationInput, setCustomLocationInput] = useState("");
  const [customPopulation, setCustomPopulation] = useState(3500);

  // Dynamic Vehicle / Resource Input Mode (Mode B = Dynamic AI, Mode A = User Predefined)
  const [resourceMode, setResourceMode] = useState<"MODE_B_DYNAMIC" | "MODE_A_PREDEFINED">("MODE_B_DYNAMIC");
  const [customBuses, setCustomBuses] = useState(10);
  const [customBoats, setCustomBoats] = useState(3);
  const [customAmbulances, setCustomAmbulances] = useState(5);
  const [customTeams, setCustomTeams] = useState(20);
  const [customBudget, setCustomBudget] = useState(350000);

  // Dynamic Destination Selection
  const currentPreset = useMemo(() => {
    return getScenarioPreset(twin.location.name) || SCENARIO_PRESETS[0];
  }, [twin.location.name]);

  const bestDestinationInfo = useMemo(() => {
    return resolveBestDestination(currentPreset, twin.priorities);
  }, [currentPreset, twin.priorities]);

  // Deterministic Simulation result (pure client recalculation in 0ms)
  const result: SimulationResult = useMemo(() => {
    return simulateDeterministicDecisionTwin(twin);
  }, [twin]);

  // Phase 9: Monte Carlo Probabilistic Simulation State
  const [mcIterations, setMcIterations] = useState<100 | 500 | 1000 | 5000>(1000);
  const [mcSeed, setMcSeed] = useState<number>(424242);
  const [uncertainties, setUncertainties] = useState<Record<string, UncertaintyVariable>>(() =>
    getDefaultUncertainties(twin)
  );

  // Dynamic Re-evaluation Scenario Toggles
  const [isSurgeRainfall, setIsSurgeRainfall] = useState(false);
  const [isRoute1Closed, setIsRoute1Closed] = useState(false);

  // Probabilistic Simulation Result
  const [probResult, setProbResult] = useState<ProbabilisticSimulationResult>(() =>
    runMonteCarloSimulation(twin, {
      iterations: 1000,
      seed: 424242,
      uncertainties: getDefaultUncertainties(twin)
    })
  );

  // Re-run Monte Carlo when deterministic twin, iterations, or seed change
  const executeMonteCarlo = useCallback(
    (targetTwin: DecisionTwin, iters = mcIterations, seedVal = mcSeed, customUncerts?: Record<string, UncertaintyVariable>) => {
      const activeUncerts = customUncerts ?? getDefaultUncertainties(targetTwin);
      const res = runMonteCarloSimulation(targetTwin, {
        iterations: iters,
        seed: seedVal,
        uncertainties: activeUncerts
      });
      setProbResult(res);
    },
    [mcIterations, mcSeed]
  );

  // Prevent infinite simulation loops: only run Monte Carlo when twin parameters actually change
  const lastExecutedKeyRef = useRef<string>("");
  const currentTwinFingerprint = `${twin.scenarioId}-${twin.estimatedPopulation.value}-${twin.resources.buses.value}-${twin.resources.boats.value}-${twin.resources.ambulances.value}-${twin.resources.rescueTeams.value}-${twin.resources.budget.value}-${twin.constraints.roadClosures.allowedValue?.join(",")}-${twin.weatherContext?.rainfallMm}-${mcIterations}-${mcSeed}`;

  useEffect(() => {
    if (lastExecutedKeyRef.current === currentTwinFingerprint) return;
    lastExecutedKeyRef.current = currentTwinFingerprint;

    const uncerts = getDefaultUncertainties(twin);
    setUncertainties(uncerts);
    executeMonteCarlo(twin, mcIterations, mcSeed, uncerts);
  }, [currentTwinFingerprint, twin, mcIterations, mcSeed, executeMonteCarlo]);

  // Sync to parent dashboard & map with guard to prevent infinite render ping-pong
  const onDecisionTwinChangeRef = useRef(onDecisionTwinChange);
  onDecisionTwinChangeRef.current = onDecisionTwinChange;
  const lastSyncedKeyRef = useRef<string>("");

  useEffect(() => {
    const syncKey = `${twin.scenarioId}-${twin.location.name}-${twin.routes?.length ?? 0}-${result.score}-${result.feasible}`;
    if (lastSyncedKeyRef.current === syncKey) return;
    lastSyncedKeyRef.current = syncKey;
    onDecisionTwinChangeRef.current?.(twin, result);
  }, [twin, result]);

  const [activeTab, setActiveTab] = useState<"deterministic" | "probabilistic" | "routes" | "twin-spec" | "transparency">("probabilistic");
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [isAssumptionsExpanded, setIsAssumptionsExpanded] = useState(false);

  // Human Dispatch Confirmation & Audit Log states
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchReason, setDispatchReason] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState("");

  async function handleConfirmDispatch() {
    if (!dispatchReason.trim()) {
      setDispatchError("Please enter the operational reason.");
      return;
    }
    setDispatching(true);
    setDispatchError("");
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName: twin.location.name,
          locationCoordinates: { lat: twin.location.lat, lng: twin.location.lng },
          resources: {
            buses: twin.resources.buses.value,
            boats: twin.resources.boats.value,
            ambulances: twin.resources.ambulances.value,
            rescueTeams: twin.resources.rescueTeams.value,
          },
          corridor: bestRoute?.name || "Primary Corridor",
          distanceKm: bestRoute?.distanceKm || 20,
          reason: dispatchReason.trim(),
          operationalRationale: dispatchReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchSuccess(`Officially Authorized & Dispatched! Audit ID: ${data.record.id}`);
        setTimeout(() => {
          setShowDispatchModal(false);
          setDispatchSuccess(null);
          setDispatchReason("");
        }, 3000);
      } else {
        setDispatchError(data.error || "Failed to submit official dispatch authorization.");
      }
    } catch {
      setDispatchError("Network error while recording official dispatch.");
    } finally {
      setDispatching(false);
    }
  }

  // What-If handler: Instant resource changes
  function handleResourceChange(key: "buses" | "boats" | "ambulances" | "rescueTeams" | "budget", value: number) {
    const updated = updateDecisionTwinResources(twin, { [key]: value });
    setTwin(updated);
  }

  // What-If handler: Priority changes
  function handlePriorityChange(key: keyof PrioritiesWeights, value: number) {
    const nextPriorities = { ...twin.priorities, [key]: Math.max(0, Math.min(100, value)) };
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

  // Dynamic Route Re-evaluation: Toggle Road Closure
  function toggleRouteClosure() {
    const nextState = !isRoute1Closed;
    setIsRoute1Closed(nextState);
    const closures = nextState ? ["Route 1 GST / Arterial Canal Bridge Inundated"] : [];
    const updated = updateDecisionTwinRoadClosure(twin, closures);
    setTwin(updated);
  }

  // Dynamic Route Re-evaluation: Toggle +30% Rainfall Surge
  function toggleRainfallSurge() {
    const nextState = !isSurgeRainfall;
    setIsSurgeRainfall(nextState);
    const multiplier = nextState ? 1.3 : 1.0;
    const updated = updateDecisionTwinWeatherDelta(twin, multiplier);
    setTwin(updated);
  }

  // Re-roll Monte Carlo Seed
  function handleRerollSeed() {
    const newSeed = Math.floor(Math.random() * 900000) + 100000;
    setMcSeed(newSeed);
    executeMonteCarlo(twin, mcIterations, newSeed);
  }

  // Universal Scenario Builder for ANY Chennai Location (e.g. Marina Mall, T Nagar, Velachery, Central, Adyar...)
  async function handleBuildScenario(
    placeName: string,
    pop: number = customPopulation,
    modeOverride?: "MODE_B_DYNAMIC" | "MODE_A_PREDEFINED"
  ) {
    const trimmed = placeName.trim();
    if (!trimmed) return;
    setLoadingBackend(true);
    setIsRoute1Closed(false);
    setIsSurgeRainfall(false);

    const activeMode = modeOverride ?? resourceMode;

    try {
      const payload: Record<string, unknown> = {
        place: trimmed,
        population: pop,
        mode: activeMode,
        priorities: twin.priorities
      };

      if (activeMode === "MODE_A_PREDEFINED") {
        payload.buses = customBuses;
        payload.boats = customBoats;
        payload.ambulances = customAmbulances;
        payload.rescueTeams = customTeams;
        payload.budget = customBudget;
      }

      const res = await fetch("/api/decision/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.decisionTwin) {
          setTwin(data.decisionTwin);
          executeMonteCarlo(data.decisionTwin, mcIterations, mcSeed);
          return;
        }
      }

      // Offline / network fallback with known place resolution
      const lower = trimmed.toLowerCase();
      const match = Object.entries(KNOWN_PLACES).find(([k]) => lower.includes(k));
      const lat = match ? match[1].lat : 13.0418;
      const lng = match ? match[1].lng : 80.2341;

      const autoBuses = activeMode === "MODE_A_PREDEFINED" ? customBuses : Math.min(25, Math.max(4, Math.ceil(pop / 350)));
      const autoBoats = activeMode === "MODE_A_PREDEFINED" ? customBoats : Math.min(12, Math.max(2, Math.ceil(pop / 800)));
      const autoAmbulances = activeMode === "MODE_A_PREDEFINED" ? customAmbulances : Math.min(12, Math.max(3, Math.ceil(pop / 600)));
      const autoTeams = activeMode === "MODE_A_PREDEFINED" ? customTeams : Math.min(30, Math.max(6, Math.ceil(pop / 200)));
      const autoBudget = activeMode === "MODE_A_PREDEFINED" ? customBudget : Math.max(500000, Math.ceil(pop * 180));

      const fallbackTwin = createDefaultDecisionTwin({
        placeName: match ? match[1].label : `${trimmed}, Chennai`,
        lat,
        lng,
        population: pop,
        buses: autoBuses,
        boats: autoBoats,
        ambulances: autoAmbulances,
        rescueTeams: autoTeams,
        budget: autoBudget,
        resourceMode: activeMode,
        priorities: twin.priorities
      });
      setTwin(fallbackTwin);
      executeMonteCarlo(fallbackTwin, mcIterations, mcSeed);
    } catch (e) {
      console.error("Failed to build scenario for " + trimmed, e);
    } finally {
      setLoadingBackend(false);
    }
  }

  // Automatic Scenario Preset Loader
  async function selectPreset(preset: ScenarioPreset) {
    setSelectedPresetId(preset.id);
    handleBuildScenario(preset.locationName, preset.defaultPopulation);
  }

  const bestRoute = result.selectedRoutes[0];

  return (
    <section className="rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-6 shadow-2xl shadow-black/50">
      {/* 1. UNIFIED CHENNAI SCENARIO & LOCATION INPUT BAR */}
      <div className="border-b border-[#23354d] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#39d4b4]/20 text-sm">
                🌐
              </span>
              <span className="text-xs font-bold tracking-[.18em] text-[#39d4b4]">
                DECISION TWIN & DETERMINISTIC + MONTE CARLO SIMULATION
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-[#e6edf7]">
              City-Scale Emergency Response & Resource Orchestration
            </h2>
            <p className="mt-0.5 text-xs text-[#9aabc1]">
              Enter ANY location in Chennai (e.g. Marina Mall, T Nagar, Velachery, Central, Tambaram, Adyar...) or scenario prompt.
              Routes and distances are dynamically evaluated from permanent <b>VIT Chennai Base Hub</b>.
            </p>
          </div>

          {/* Feasibility & Score Badges */}
          <div className="flex items-center gap-2.5">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-bold ${
                result.feasible
                  ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border border-red-500/40 bg-red-500/10 text-red-300 animate-pulse"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${result.feasible ? "bg-emerald-400" : "bg-red-400"}`} />
              {result.feasible ? "FEASIBLE" : "CONSTRAINTS EXCEEDED"}
            </span>

            <span className="rounded-full border border-[#39d4b4]/40 bg-[#113c3d] px-3 py-1 font-mono text-xs font-bold text-[#69e8d1]">
              Score: {result.score}/100
            </span>

            <span className="rounded-full border border-blue-500/40 bg-blue-950/40 px-3 py-1 font-mono text-xs font-bold text-blue-300">
              {resourceMode === "MODE_B_DYNAMIC" ? "Mode B: AI Fleet Sizing" : "Mode A: Custom Fleet"}
            </span>
          </div>
        </div>

        {/* FREEFORM LOCATION / SCENARIO INPUT */}
        <div className="mt-4 rounded-xl border border-[#23354d] bg-[#07111f] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#39d4b4] uppercase tracking-wider flex items-center gap-1.5">
              <span>📍</span> SEARCH ANY REAL-WORLD LOCATION OR EMERGENCY SCENARIO
            </label>
            <span className="text-[11px] text-[#9aabc1]">
              Dispatch Origin: <b>VIT Chennai Base Hub</b> (Permanent Hub · 12.8406° N, 80.1534° E)
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={customLocationInput}
              onChange={(e) => setCustomLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customLocationInput.trim()) {
                  handleBuildScenario(customLocationInput);
                }
              }}
              placeholder="Type ANY location (e.g. Marina Mall, T Nagar, Anna Nagar, Adyar...) or prompt..."
              className="flex-1 min-w-[280px] rounded-xl border border-[#39506e] bg-[#10233a] px-4 py-2.5 text-sm text-white placeholder-[#5a708c] outline-none focus:border-[#39d4b4]"
            />
            <button
              type="button"
              onClick={() => handleBuildScenario(customLocationInput || "Marina Mall")}
              disabled={loadingBackend}
              className="flex items-center gap-2 rounded-xl bg-[#39d4b4] px-5 py-2.5 text-xs font-bold text-[#062019] transition-all hover:bg-[#2ec2a3] disabled:opacity-50 shadow-lg shadow-[#39d4b4]/20"
            >
              <span>{loadingBackend ? "Building Twin…" : "⚡ Build & Simulate"}</span>
            </button>
          </div>

          {/* SIZING MODE SELECTOR TOGGLE */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#1a2d42] pt-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#9aabc1] text-[11px] font-semibold">Fleet Sizing Mode:</span>
              <button
                type="button"
                onClick={() => {
                  setResourceMode("MODE_B_DYNAMIC");
                  if (customLocationInput.trim()) handleBuildScenario(customLocationInput, customPopulation, "MODE_B_DYNAMIC");
                }}
                className={`rounded-lg border px-3 py-1 text-xs font-bold transition-all ${
                  resourceMode === "MODE_B_DYNAMIC"
                    ? "border-[#39d4b4] bg-[#39d4b4]/20 text-[#69e8d1] shadow"
                    : "border-[#39506e]/50 bg-[#10233a] text-[#9aabc1] hover:border-[#39d4b4]/50 hover:text-white"
                }`}
              >
                ⚡ Mode B: AI Dynamic Auto-Sizing (Optimal Fleet from Scratch)
              </button>
              <button
                type="button"
                onClick={() => setResourceMode("MODE_A_PREDEFINED")}
                className={`rounded-lg border px-3 py-1 text-xs font-bold transition-all ${
                  resourceMode === "MODE_A_PREDEFINED"
                    ? "border-amber-400 bg-amber-500/20 text-amber-200 shadow"
                    : "border-[#39506e]/50 bg-[#10233a] text-[#9aabc1] hover:border-amber-400/50 hover:text-white"
                }`}
              >
                🛠️ Mode A: Predefined Fleet (Plan with Custom Vehicle Allocation)
              </button>
            </div>

            {/* Population Input */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#9aabc1] text-[11px]">Affected Population:</span>
              <input
                type="number"
                value={customPopulation}
                onChange={(e) => setCustomPopulation(Math.max(100, Number(e.target.value)))}
                className="w-24 rounded-lg border border-[#39506e] bg-[#10233a] px-2 py-1 text-xs text-white outline-none focus:border-[#39d4b4]"
              />
            </div>
          </div>

          {/* MODE A EXPANDED CONTROLS */}
          {resourceMode === "MODE_A_PREDEFINED" && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-[#1b231c] p-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>🛠️</span> MODE A CUSTOM RESOURCE ALLOCATION (User-Defined Capacity)
                </span>
                <span className="text-[11px] text-[#9aabc1]">
                  AI will evaluate sufficiency, surplus/shortfall, and wave staging using only these vehicles.
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="text-[10px] text-[#9aabc1] block">Buses (50 cap)</label>
                  <input
                    type="number"
                    value={customBuses}
                    onChange={(e) => setCustomBuses(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-[#39506e] bg-[#0d1b2d] px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9aabc1] block">Boats (20 cap)</label>
                  <input
                    type="number"
                    value={customBoats}
                    onChange={(e) => setCustomBoats(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-[#39506e] bg-[#0d1b2d] px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9aabc1] block">Ambulances</label>
                  <input
                    type="number"
                    value={customAmbulances}
                    onChange={(e) => setCustomAmbulances(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-[#39506e] bg-[#0d1b2d] px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9aabc1] block">Rescue Teams</label>
                  <input
                    type="number"
                    value={customTeams}
                    onChange={(e) => setCustomTeams(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-[#39506e] bg-[#0d1b2d] px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9aabc1] block">Budget (₹)</label>
                  <input
                    type="number"
                    value={customBudget}
                    onChange={(e) => setCustomBudget(Math.max(50000, Number(e.target.value)))}
                    className="w-full rounded border border-[#39506e] bg-[#0d1b2d] px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleBuildScenario(customLocationInput || twin.location.name, customPopulation, "MODE_A_PREDEFINED")}
                  disabled={loadingBackend}
                  className="rounded-lg bg-amber-400 px-4 py-1 text-xs font-bold text-black hover:bg-amber-300"
                >
                  ⚡ Re-simulate with Custom Fleet
                </button>
              </div>
            </div>
          )}

          {/* Quick Location Chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#9aabc1] text-[11px]">Quick Shortcuts (Same dynamic pipeline):</span>
            {["T Nagar", "Velachery", "Chennai Central", "Tambaram", "Adyar", "Anna Nagar", "Guindy", "Porur", "Mylapore"].map((place) => {
              const isCurrent = twin.location.name.toLowerCase().includes(place.toLowerCase());
              return (
                <button
                  key={place}
                  type="button"
                  onClick={() => {
                    setCustomLocationInput(place);
                    handleBuildScenario(place, customPopulation, resourceMode);
                  }}
                  disabled={loadingBackend}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    isCurrent
                      ? "border-[#39d4b4] bg-[#39d4b4]/20 text-[#69e8d1]"
                      : "border-[#39506e]/50 bg-[#10233a] text-[#9aabc1] hover:border-[#39d4b4]/60 hover:text-white"
                  }`}
                >
                  📍 {place}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC INCIDENT ASSESSMENT & MISSION OVERVIEW CARD */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Card 1: Target Location & Base Proximity */}
        <div className="rounded-xl border border-[#23354d] bg-[#07111f] p-4 text-xs">
          <div className="flex items-center gap-2 text-[#9aabc1] text-[11px] mb-1">
            <span>📍</span> TARGET INCIDENT LOCATION
          </div>
          <p className="font-bold text-sm text-white truncate" title={twin.location.name}>
            {twin.location.name}
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-[#9aabc1]">
            <p>
              Coords: <b className="text-white">{twin.location.lat.toFixed(4)}° N, {twin.location.lng.toFixed(4)}° E</b>
            </p>
            <p>
              Staging Base: <b className="text-[#39d4b4]">VIT Chennai Base Hub</b>
            </p>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#39d4b4]/40 bg-[#39d4b4]/10 px-2.5 py-1 text-xs font-mono font-bold text-[#69e8d1]">
            <span>📏</span> {result.distanceFromBaseKm ?? bestRoute?.distanceKm} km from VIT Base
          </div>
        </div>

        {/* Card 2: Dynamic Flood Severity & Risk */}
        <div className="rounded-xl border border-[#23354d] bg-[#07111f] p-4 text-xs">
          <div className="flex items-center gap-2 text-[#9aabc1] text-[11px] mb-1">
            <span>🌊</span> FLOOD SEVERITY & POPULATION
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                twin.hazard.severity === "CRITICAL"
                  ? "bg-red-500/20 text-red-300 border border-red-500/40"
                  : twin.hazard.severity === "HIGH"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
              }`}
            >
              {twin.hazard.severity} SEVERITY
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[#9aabc1] space-y-1">
            <p>
              People at Risk: <b className="text-white font-mono text-sm">{twin.estimatedPopulation.value.toLocaleString()}</b>
            </p>
            <p>
              Planning Range: <b className="text-white">{twin.uncertainties.planningRange}</b> ({twin.uncertainties.populationLower.toLocaleString()}–{twin.uncertainties.populationUpper.toLocaleString()})
            </p>
          </div>
        </div>

        {/* Card 3: Priority Level & Feasibility */}
        <div className="rounded-xl border border-[#23354d] bg-[#07111f] p-4 text-xs">
          <div className="flex items-center gap-2 text-[#9aabc1] text-[11px] mb-1">
            <span>🚨</span> DISPATCH PRIORITY LEVEL
          </div>
          <div className="mt-1">
            <span className="rounded bg-red-950/60 border border-red-500/40 px-2 py-0.5 font-mono text-xs font-bold text-red-300">
              {result.deploymentPriority ?? "PRIORITY 1 · CRITICAL"}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[#9aabc1] space-y-1">
            <p>
              Corridor Risk Index: <b className="text-amber-300 font-mono">{bestRoute?.riskScore ?? result.riskScore}/100</b>
            </p>
            <p>
              Feasibility:{" "}
              <b
                className={
                  result.feasibilityStatus === "OPERATIONAL"
                    ? "text-emerald-400"
                    : result.feasibilityStatus === "OPERATIONAL_WITH_SHORTAGE"
                    ? "text-amber-400"
                    : "text-red-400"
                }
              >
                {result.feasibilityStatusLabel}
              </b>
            </p>
          </div>
        </div>

        {/* Card 4: Mission Timeline & Budget */}
        <div className="rounded-xl border border-[#23354d] bg-[#07111f] p-4 text-xs">
          <div className="flex items-center gap-2 text-[#9aabc1] text-[11px] mb-1">
            <span>⏱️</span> LOGISTICS & FINANCIALS
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-white">{result.evacuationTimeMinutes} min</span>
            <span className="text-[11px] text-[#9aabc1]">({(result.evacuationTimeMinutes / 60).toFixed(1)} hrs)</span>
          </div>
          <div className="mt-2 text-[11px] text-[#9aabc1] space-y-1">
            <p>
              Evacuation Waves: <b className="text-white font-mono">{result.wavesRequired} wave(s)</b>
            </p>
            <p>
              Estimated Cost: <b className="text-emerald-300 font-mono">₹{result.estimatedCostInr.toLocaleString()}</b>
            </p>
          </div>
        </div>
      </div>

      {/* MANDATORY SIMULATION ONLY BANNER & HUMAN DISPATCH ACTION */}
      <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-950/40 p-4 text-xs text-amber-200 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">⚠️</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 font-mono text-[11px] font-extrabold text-amber-300 tracking-wider">
                SIMULATION ONLY · PENDING HUMAN COMMAND APPROVAL
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-100/90 leading-relaxed">
              All routes, travel times, and fleet sizes remain theoretical decision-twin projections until an authorized disaster officer reviews and confirms deployment.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDispatchModal(true)}
          className="rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] px-4 py-2.5 text-xs font-extrabold text-[#062019] shadow-lg shadow-[#39d4b4]/30 hover:scale-105 active:scale-95 transition-all"
        >
          ✍️ Review & Authorize Dispatch →
        </button>
      </div>

      {/* 5-FACTOR RISK DECOMPOSITION & TELEMETRY PROVENANCE */}
      <div className="mt-4 rounded-2xl border border-[#23354d] bg-[#07111f] p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#23354d] pb-2.5 mb-3">
          <div>
            <span className="text-xs font-bold tracking-wider text-[#39d4b4] flex items-center gap-1.5">
              <span>📊</span> 5-FACTOR RISK DECOMPOSITION & DATA PROVENANCE
            </span>
            <p className="text-[10px] text-[#9aabc1] mt-0.5">
              Disaggregating localized citizen hazard, transit corridor danger, rescue crew exposure, capacity shortfall, and telemetry confidence.
            </p>
          </div>
          <span className="rounded-full bg-[#10233a] border border-[#39506e] px-2.5 py-0.5 font-mono text-[11px] text-[#69e8d1]">
            Telemetry Confidence: <b>{result.riskDecomposition.dataConfidence}%</b>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <RiskMetricCard
            label="1. Citizen Flood Danger"
            value={result.riskDecomposition.citizenFloodDanger}
            source="Inundation Depth & Velocity"
            detail="Immediate life-safety threat to civilians at incident site"
          />
          <RiskMetricCard
            label="2. Road Corridor Risk"
            value={result.riskDecomposition.roadCorridorRisk}
            source="OSRM & GCC Bridge Crossings"
            detail="Route inundation risk and canal bridge clearance"
          />
          <RiskMetricCard
            label="3. Rescue Mission Risk"
            value={result.riskDecomposition.rescueMissionRisk}
            source="Hydrology Current & Access"
            detail="Operational hazard to extraction crews & equipment"
          />
          <RiskMetricCard
            label="4. Capacity Shortfall Risk"
            value={result.riskDecomposition.capacityRisk}
            source="Fleet Deficit vs Population"
            detail="Exposure delay caused by multi-wave turnaround lag"
          />
          <RiskMetricCard
            label="5. Telemetry Confidence"
            value={result.riskDecomposition.dataConfidence}
            source="ArcGIS + Open-Meteo Live"
            detail="Data freshness and sensor verification rating"
            isConfidence
          />
        </div>
      </div>

      {/* VERIFIED DISPATCH CAPACITY FORMULATION */}
      <div className="mt-4 rounded-2xl border border-[#23354d] bg-[#07111f] p-4 text-xs">
        <div className="border-b border-[#23354d] pb-2.5 mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold tracking-wider text-[#39d4b4] flex items-center gap-1.5">
              <span>📐</span> VERIFIED DISPATCH CAPACITY FORMULATION
            </span>
            <p className="text-[10px] text-[#9aabc1] mt-0.5">
              Exact mathematical multipliers and multi-wave evacuation throughput equations.
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-white">
            Shortfall Status:{" "}
            <b className={result.capacityBreakdown.shortfallStatus === "DEFICIT" ? "text-red-400" : "text-emerald-400"}>
              {result.capacityBreakdown.shortfallStatus === "DEFICIT"
                ? `-${result.capacityBreakdown.shortfallOrSurplus} Seat Deficit`
                : `+${result.capacityBreakdown.shortfallOrSurplus} Seat Surplus`}
            </b>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-[#1b2b3e] bg-[#0d1b2d] p-3">
            <span className="text-[10px] text-[#9aabc1] block">Bus Passenger Equation:</span>
            <p className="font-mono text-xs font-semibold text-white mt-1">{result.capacityBreakdown.busFormula}</p>
          </div>
          <div className="rounded-xl border border-[#1b2b3e] bg-[#0d1b2d] p-3">
            <span className="text-[10px] text-[#9aabc1] block">Rescue Boat Equation:</span>
            <p className="font-mono text-xs font-semibold text-cyan-300 mt-1">{result.capacityBreakdown.boatFormula}</p>
          </div>
          <div className="rounded-xl border border-[#1b2b3e] bg-[#0d1b2d] p-3">
            <span className="text-[10px] text-[#9aabc1] block">Ambulance Triage Equation:</span>
            <p className="font-mono text-xs font-semibold text-red-300 mt-1">{result.capacityBreakdown.ambulanceFormula}</p>
          </div>
          <div className="rounded-xl border border-[#1b2b3e] bg-[#0d1b2d] p-3">
            <span className="text-[10px] text-[#9aabc1] block">Rescue Team Equation:</span>
            <p className="font-mono text-xs font-semibold text-emerald-300 mt-1">{result.capacityBreakdown.rescueTeamFormula}</p>
          </div>
        </div>

        <div className="mt-2.5 rounded-xl border border-[#23354d] bg-[#10233a] p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[#e6edf7] text-[11px]">
            <b>Sequential Evacuation Waves Formula:</b> <code className="font-mono text-[#39d4b4] ml-1">{result.capacityBreakdown.wavesFormula}</code>
          </span>
          <span className="text-[11px] text-[#9aabc1]">
            Single-Wave Total: <b className="text-white font-mono">{result.capacityBreakdown.totalSingleWaveCapacity} seats</b>
          </span>
        </div>
      </div>

      {/* 3. DYNAMIC RESOURCE DIRECTIVE & CAPACITY CARD */}
      <div className="mt-4 rounded-xl border border-[#39d4b4]/30 bg-[#0a232b] p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-[#39d4b4] flex items-center gap-1.5">
              <span>🛡️</span>
              {twin.resourceMode === "MODE_A_PREDEFINED" ? "MODE A ALLOCATED FLEET & CAPACITY DIRECTIVE:" : "MODE B AI OPTIMAL FLEET & DISPATCH DIRECTIVE:"}
            </p>
            <p className="mt-1 text-sm font-bold text-white">
              Deploy from VIT Base:{" "}
              <span className="text-[#39d4b4]">{twin.resources.buses.value} Buses</span> ·{" "}
              <span className="text-cyan-300">{twin.resources.boats.value} Rescue Boats</span> ·{" "}
              <span className="text-red-300">{twin.resources.ambulances.value} Ambulances</span> ·{" "}
              <span className="text-emerald-300">{twin.resources.rescueTeams.value} Rescue Teams</span>
            </p>
            <p className="mt-0.5 text-xs text-[#b6c4d5]">
              Single-wave capacity: <b>{result.singleWaveCapacity} citizens/wave</b> · Total mission throughput: <b>{result.totalCapacity.toLocaleString()} citizens</b> across <b>{result.wavesRequired} wave(s)</b>.
            </p>
          </div>

          {/* Mode A / Mode B status indicator */}
          <div className="text-right">
            {result.resourceAnalysis?.status === "SURPLUS" && (
              <span className="rounded-full bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 text-xs font-mono font-bold text-emerald-300">
                ✅ Fleet Capacity Surplus (+{result.resourceAnalysis.unusedCapacity} seats)
              </span>
            )}
            {result.resourceAnalysis?.status === "DEFICIT" && (
              <span className="rounded-full bg-red-950/60 border border-red-500/40 px-3 py-1 text-xs font-mono font-bold text-red-300">
                ⚠️ Capacity Shortfall ({result.resourceAnalysis.shortfallCapacity} unevacuated in wave 1)
              </span>
            )}
            {result.resourceAnalysis?.status === "BALANCED" && (
              <span className="rounded-full bg-blue-950/60 border border-blue-500/40 px-3 py-1 text-xs font-mono font-bold text-blue-300">
                ⚖️ Balanced Fleet Throughput
              </span>
            )}
          </div>
        </div>

        {/* Mode A Comparative Breakdown */}
        {twin.resourceMode === "MODE_A_PREDEFINED" && result.resourceAnalysis && (
          <div className="mt-3 border-t border-[#1a3c42] pt-2.5 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded bg-[#071f25] p-2">
              <span className="text-[#9aabc1] block text-[10px]">Buses: Allocated vs Needed</span>
              <span className="font-bold text-white">{twin.resources.buses.value} allocated</span> /{" "}
              <span className="text-[#39d4b4]">{result.resourceAnalysis.busesNeeded} needed</span>
              <span className="block text-[10px] text-cyan-300 mt-0.5">
                {result.resourceAnalysis.busesDiff >= 0 ? `+${result.resourceAnalysis.busesDiff} surplus` : `${result.resourceAnalysis.busesDiff} deficit`}
              </span>
            </div>
            <div className="rounded bg-[#071f25] p-2">
              <span className="text-[#9aabc1] block text-[10px]">Boats: Allocated vs Needed</span>
              <span className="font-bold text-white">{twin.resources.boats.value} allocated</span> /{" "}
              <span className="text-[#39d4b4]">{result.resourceAnalysis.boatsNeeded} needed</span>
              <span className="block text-[10px] text-cyan-300 mt-0.5">
                {result.resourceAnalysis.boatsDiff >= 0 ? `+${result.resourceAnalysis.boatsDiff} surplus` : `${result.resourceAnalysis.boatsDiff} deficit`}
              </span>
            </div>
            <div className="rounded bg-[#071f25] p-2">
              <span className="text-[#9aabc1] block text-[10px]">Ambulances: Allocated vs Needed</span>
              <span className="font-bold text-white">{twin.resources.ambulances.value} allocated</span> /{" "}
              <span className="text-[#39d4b4]">{result.resourceAnalysis.ambulancesNeeded} needed</span>
              <span className="block text-[10px] text-cyan-300 mt-0.5">
                {result.resourceAnalysis.ambulancesDiff >= 0 ? `+${result.resourceAnalysis.ambulancesDiff} surplus` : `${result.resourceAnalysis.ambulancesDiff} deficit`}
              </span>
            </div>
            <div className="rounded bg-[#071f25] p-2">
              <span className="text-[#9aabc1] block text-[10px]">Unused Seat Margin</span>
              <span className="font-bold text-emerald-300">{result.resourceAnalysis.unusedCapacity.toLocaleString()} seats</span>
              <span className="block text-[10px] text-[#9aabc1] mt-0.5">Across {result.wavesRequired} waves</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. AUTOMATIC BEST-ROUTE & OPERATIONAL PLAN SUMMARY */}
      <div className="mt-4 rounded-xl border border-[#39d4b4]/30 bg-[#0a232b] p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#39d4b4]/20 text-base">
              🛣️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wide text-[#69e8d1]">RECOMMENDED TRANSIT CORRIDOR:</span>
                <span className="rounded bg-[#39d4b4]/20 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                  {bestRoute?.name || "Route 1"}
                </span>
                <span className="text-[11px] text-[#39d4b4]">★ Dynamic Best Fit</span>
              </div>
              <p className="mt-0.5 text-[#b6c4d5]">
                {bestRoute?.tradeoffRationale}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[#9aabc1] block text-[10px]">One-Way Transit</span>
              <span className="font-mono text-sm font-bold text-white">{bestRoute?.travelMinutes} min</span>
            </div>
            <div className="text-right">
              <span className="text-[#9aabc1] block text-[10px]">Corridor Distance</span>
              <span className="font-mono text-sm font-bold text-white">{bestRoute?.distanceKm} km</span>
            </div>
            <div className="text-right">
              <span className="text-[#9aabc1] block text-[10px]">Risk Index</span>
              <span className="font-mono text-sm font-bold text-amber-300">{bestRoute?.riskScore}/100</span>
            </div>
          </div>
        </div>

        {/* Dynamic Operational Response Plan Narrative */}
        {result.recommendedPlan && (
          <div className="mt-3 rounded-lg border border-[#23354d] bg-[#07111f] p-3 text-[11px] text-[#cbd5e1] leading-relaxed">
            <span className="font-bold text-[#39d4b4] block mb-1">📋 RECOMMENDED OPERATIONAL RESPONSE PLAN:</span>
            {result.recommendedPlan}
          </div>
        )}

        {/* Destination & Transparency metadata */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#1a3c42] pt-2.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-[#9aabc1]">Evacuation Destination:</span>
            <span className="font-semibold text-emerald-300">
              {bestDestinationInfo.destination ? bestDestinationInfo.destination.name : "No verified destination available."}
            </span>
            <span className="text-[#9aabc1]">({bestDestinationInfo.rationale})</span>
          </div>

          {/* Quick Dynamic Re-evaluation Toggles */}
          <div className="flex items-center gap-2">
            <span className="text-[#9aabc1]">Dynamic Route Stress:</span>
            <button
              type="button"
              onClick={toggleRainfallSurge}
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                isSurgeRainfall
                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                  : "border-[#39506e] bg-[#07111f] text-[#9aabc1] hover:border-blue-400"
              }`}
            >
              🌧️ Rainfall +30% {isSurgeRainfall ? "(ON)" : ""}
            </button>
            <button
              type="button"
              onClick={toggleRouteClosure}
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                isRoute1Closed
                  ? "border-red-400 bg-red-500/20 text-red-200"
                  : "border-[#39506e] bg-[#07111f] text-[#9aabc1] hover:border-red-400"
              }`}
            >
              🚧 Close Route 1 {isRoute1Closed ? "(BLOCKED)" : ""}
            </button>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="mt-5 flex border-b border-[#23354d]">
        {[
          { id: "probabilistic", label: "🎲 Phase 9: Monte Carlo Probabilistic" },
          { id: "deterministic", label: "⚡ Deterministic & What-If" },
          { id: "routes", label: `🛣️ Route Candidates (${result.selectedRoutes.length})` },
          { id: "twin-spec", label: "🧬 Decision Twin Specification" },
          { id: "transparency", label: "🔍 Provenance & Transparency" }
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

      {/* ==================================================== */}
      {/* TAB 1: PHASE 9 MONTE CARLO PROBABILISTIC SIMULATION  */}
      {/* ==================================================== */}
      {activeTab === "probabilistic" && (
        <div className="mt-6 space-y-6">
          {/* Controls Bar: Iterations & PRNG Seed */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#23354d] bg-[#10233a] p-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#e6edf7]">Monte Carlo Iterations:</span>
              <div className="flex items-center gap-1.5">
                {([100, 500, 1000, 5000] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      setMcIterations(count);
                      executeMonteCarlo(twin, count, mcSeed);
                    }}
                    className={`rounded-lg border px-3 py-1 font-mono text-xs font-bold transition-all ${
                      mcIterations === count
                        ? "border-[#39d4b4] bg-[#39d4b4]/20 text-[#69e8d1]"
                        : "border-[#39506e] bg-[#07111f] text-[#9aabc1] hover:border-[#39d4b4]/50"
                    }`}
                  >
                    {count.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[#9aabc1]">
                PRNG Seed: <b className="text-white">{mcSeed}</b>
              </span>
              <button
                type="button"
                onClick={handleRerollSeed}
                className="rounded-lg border border-[#39506e] bg-[#07111f] px-3 py-1 text-xs font-semibold text-[#69e8d1] transition-colors hover:border-[#39d4b4]"
              >
                🎲 Re-roll Seed
              </button>
              <button
                type="button"
                onClick={() => executeMonteCarlo(twin, mcIterations, mcSeed)}
                className="rounded-lg bg-[#39d4b4] px-4 py-1.5 text-xs font-bold text-[#062019] shadow-md shadow-[#39d4b4]/20 hover:opacity-90"
              >
                Run Monte Carlo ({mcIterations})
              </button>
            </div>
          </div>

          {/* Key Probabilistic Gauges Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ProbMetricCard
              label="Success Probability"
              value={`${probResult.successProbability}%`}
              subtext={`${probResult.successCount} of ${probResult.totalIterations} passed`}
              badge={probResult.successProbability >= 70 ? "HIGH CONFIDENCE" : "RISK BREACH"}
              color={probResult.successProbability >= 70 ? "emerald" : "red"}
            />
            <ProbMetricCard
              label="Failure Probability"
              value={`${probResult.failureProbability}%`}
              subtext="Over budget or window"
              color={probResult.failureProbability > 30 ? "red" : "blue"}
            />
            <ProbMetricCard
              label="Median Time (P50)"
              value={`${probResult.timeStats.median} min`}
              subtext={`Mean: ${probResult.timeStats.mean} min`}
              color="teal"
            />
            <ProbMetricCard
              label="P90 Conservative Time"
              value={`${probResult.timeStats.p90} min`}
              subtext="90% of scenarios finish within"
              color="amber"
            />
            <ProbMetricCard
              label="P10 Optimistic Time"
              value={`${probResult.timeStats.p10} min`}
              subtext="Best 10% conditions"
              color="teal"
            />
            <ProbMetricCard
              label="Time Std Deviation"
              value={`±${probResult.timeStats.stdDev} min`}
              subtext={`Min ${probResult.timeStats.min} · Max ${probResult.timeStats.max}`}
              color="blue"
            />
          </div>

          {/* Statistical Percentiles Breakdown Table */}
          <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-5">
            <div className="flex items-center justify-between border-b border-[#23354d] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#e6edf7]">
                  Monte Carlo Percentile Statistics ({probResult.totalIterations.toLocaleString()} Iterations)
                </h3>
                <p className="text-xs text-[#9aabc1]">
                  Calculated from stochastic variation of population, cloudburst rainfall, urban traffic, and turnaround delays.
                </p>
              </div>
              <span className="font-mono text-xs text-[#69e8d1]">
                Seed: {probResult.seed} (Deterministic)
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#23354d] text-[#9aabc1]">
                    <th className="pb-2 font-medium">Metric Dimension</th>
                    <th className="pb-2 font-medium">Mean (μ)</th>
                    <th className="pb-2 font-medium">Median (P50)</th>
                    <th className="pb-2 font-medium">P10 (Optimistic)</th>
                    <th className="pb-2 font-medium">P25</th>
                    <th className="pb-2 font-medium">P75</th>
                    <th className="pb-2 font-medium">P90 (Conservative)</th>
                    <th className="pb-2 font-medium">Std Dev (σ)</th>
                    <th className="pb-2 font-medium">Observed Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2b3f] text-[#e6edf7]">
                  <tr>
                    <td className="py-2.5 font-bold text-[#39d4b4]">Evacuation Time</td>
                    <td className="py-2.5 font-mono">{probResult.timeStats.mean} min</td>
                    <td className="py-2.5 font-mono font-bold text-white">{probResult.timeStats.median} min</td>
                    <td className="py-2.5 font-mono text-emerald-300">{probResult.timeStats.p10} min</td>
                    <td className="py-2.5 font-mono">{probResult.timeStats.p25} min</td>
                    <td className="py-2.5 font-mono">{probResult.timeStats.p75} min</td>
                    <td className="py-2.5 font-mono font-bold text-amber-300">{probResult.timeStats.p90} min</td>
                    <td className="py-2.5 font-mono">±{probResult.timeStats.stdDev} min</td>
                    <td className="py-2.5 font-mono text-[#9aabc1]">{probResult.timeStats.min} – {probResult.timeStats.max} min</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-blue-300">Estimated Cost</td>
                    <td className="py-2.5 font-mono">₹{Math.round(probResult.costStats.mean).toLocaleString()}</td>
                    <td className="py-2.5 font-mono font-bold text-white">₹{Math.round(probResult.costStats.median).toLocaleString()}</td>
                    <td className="py-2.5 font-mono text-emerald-300">₹{Math.round(probResult.costStats.p10).toLocaleString()}</td>
                    <td className="py-2.5 font-mono">₹{Math.round(probResult.costStats.p25).toLocaleString()}</td>
                    <td className="py-2.5 font-mono">₹{Math.round(probResult.costStats.p75).toLocaleString()}</td>
                    <td className="py-2.5 font-mono font-bold text-amber-300">₹{Math.round(probResult.costStats.p90).toLocaleString()}</td>
                    <td className="py-2.5 font-mono">±₹{Math.round(probResult.costStats.stdDev).toLocaleString()}</td>
                    <td className="py-2.5 font-mono text-[#9aabc1]">₹{Math.round(probResult.costStats.min).toLocaleString()} – ₹{Math.round(probResult.costStats.max).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-amber-300">Flood Risk Index</td>
                    <td className="py-2.5 font-mono">{probResult.riskStats.mean}/100</td>
                    <td className="py-2.5 font-mono font-bold text-white">{probResult.riskStats.median}/100</td>
                    <td className="py-2.5 font-mono text-emerald-300">{probResult.riskStats.p10}/100</td>
                    <td className="py-2.5 font-mono">{probResult.riskStats.p25}/100</td>
                    <td className="py-2.5 font-mono">{probResult.riskStats.p75}/100</td>
                    <td className="py-2.5 font-mono font-bold text-amber-300">{probResult.riskStats.p90}/100</td>
                    <td className="py-2.5 font-mono">±{probResult.riskStats.stdDev}</td>
                    <td className="py-2.5 font-mono text-[#9aabc1]">{probResult.riskStats.min} – {probResult.riskStats.max}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Risk Distribution Bar */}
            <div className="mt-5 border-t border-[#23354d] pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#e6edf7]">Simulated Risk Level Distribution Across Iterations</span>
                <span className="text-[#9aabc1]">Target Threshold: &lt; 60 Moderate</span>
              </div>

              <div className="mt-2 flex h-5 w-full overflow-hidden rounded-lg bg-[#07111f]">
                <div
                  style={{ width: `${probResult.riskDistribution.low.percentage}%` }}
                  className="bg-emerald-500 transition-all"
                  title={`Low (<35): ${probResult.riskDistribution.low.percentage}%`}
                />
                <div
                  style={{ width: `${probResult.riskDistribution.moderate.percentage}%` }}
                  className="bg-teal-500 transition-all"
                  title={`Moderate (35-59): ${probResult.riskDistribution.moderate.percentage}%`}
                />
                <div
                  style={{ width: `${probResult.riskDistribution.high.percentage}%` }}
                  className="bg-amber-500 transition-all"
                  title={`High (60-79): ${probResult.riskDistribution.high.percentage}%`}
                />
                <div
                  style={{ width: `${probResult.riskDistribution.critical.percentage}%` }}
                  className="bg-red-500 transition-all"
                  title={`Critical (≥80): ${probResult.riskDistribution.critical.percentage}%`}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-[#b6c4d5]">Low (&lt;35): <b>{probResult.riskDistribution.low.percentage}%</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />
                  <span className="text-[#b6c4d5]">Moderate (35–59): <b>{probResult.riskDistribution.moderate.percentage}%</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  <span className="text-[#b6c4d5]">High (60–79): <b>{probResult.riskDistribution.high.percentage}%</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                  <span className="text-[#b6c4d5]">Critical (≥80): <b>{probResult.riskDistribution.critical.percentage}%</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. EXPANDABLE SIMULATION ASSUMPTIONS DRAWER */}
          <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-4 text-xs">
            <button
              type="button"
              onClick={() => setIsAssumptionsExpanded(!isAssumptionsExpanded)}
              className="flex w-full items-center justify-between font-bold text-[#e6edf7] transition-colors hover:text-[#39d4b4]"
            >
              <span className="flex items-center gap-2">
                <span>📋</span>
                <span>SIMULATION ASSUMPTIONS & STOCHASTIC DISTRIBUTIONS ({probResult.assumptions.length} Variables)</span>
              </span>
              <span>{isAssumptionsExpanded ? "▲ Collapse Assumptions" : "▼ Expand Assumptions"}</span>
            </button>

            {isAssumptionsExpanded && (
              <div className="mt-4 space-y-3 border-t border-[#23354d] pt-3">
                <p className="text-[11px] text-[#9aabc1]">
                  All variables below are sampled per iteration using the seeded Mulberry32 pseudo-random generator. Labels marked <span className="text-[#69e8d1]">SIMULATED</span> reflect mathematical stochastic modeling.
                </p>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {probResult.assumptions.map((u) => (
                    <div key={u.id} className="rounded-lg border border-[#23354d] bg-[#07111f] p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white truncate">{u.name}</span>
                        <span className="rounded bg-[#113c3d] px-1.5 py-0.5 font-mono text-[9px] text-[#69e8d1] font-bold">
                          {u.distribution}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-[#39d4b4]">
                        Range: {u.min} – {u.max} {u.unit}
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#9aabc1]">
                        {u.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* 4. MONTE CARLO STOCHASTIC ITERATION AUDIT TABLE */}
          <div className="rounded-xl border border-[#23354d] bg-[#0d1b2d] p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#23354d] pb-3 mb-3">
              <div>
                <span className="font-bold text-[#39d4b4] tracking-wider flex items-center gap-1.5">
                  <span>🎲</span> MONTE CARLO ITERATION VARIANCE INSPECTION (Sample of 15 / {probResult.totalIterations})
                </span>
                <p className="text-[11px] text-[#9aabc1] mt-0.5">
                  Auditing statistical variance: Risk, Rainfall, Traffic Multiplier, Fleet Capacity, and Evacuation Duration dynamically vary per iteration.
                </p>
              </div>
              <span className="rounded-full bg-[#10233a] border border-[#39506e] px-2.5 py-0.5 text-[11px] font-mono text-[#69e8d1]">
                Seed #{probResult.seed}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-[#23354d] text-[#9aabc1]">
                    <th className="pb-2"># Run</th>
                    <th className="pb-2">Rainfall</th>
                    <th className="pb-2">Traffic Mult.</th>
                    <th className="pb-2">Sampled Pop</th>
                    <th className="pb-2">Capacity</th>
                    <th className="pb-2">Duration</th>
                    <th className="pb-2">Risk Score</th>
                    <th className="pb-2">Cost</th>
                    <th className="pb-2">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2b3e]">
                  {probResult.sampledIterationsPreview.map((iter) => (
                    <tr key={iter.iteration} className="hover:bg-[#10233a]">
                      <td className="py-2 text-[#9aabc1]">Run {iter.iteration}</td>
                      <td className="py-2 text-cyan-300">{iter.sampledRainfallMm} mm</td>
                      <td className="py-2 text-amber-300">{iter.sampledTraffic}x</td>
                      <td className="py-2 text-white">{iter.sampledPopulation.toLocaleString()}</td>
                      <td className="py-2 text-[#39d4b4]">{iter.sampledCapacity} seats</td>
                      <td className="py-2 font-bold text-white">{iter.evacuationTimeMinutes} min</td>
                      <td className="py-2 font-bold text-amber-300">{iter.riskScore}/100</td>
                      <td className="py-2 text-emerald-300">₹{iter.estimatedCostInr.toLocaleString()}</td>
                      <td className="py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${iter.feasible ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40" : "bg-red-950/60 text-red-300 border border-red-500/40"}`}>
                          {iter.feasible ? "SUCCESS" : "WINDOW EXCEEDED"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: DETERMINISTIC WHAT-IF ENGINE                   */}
      {/* ==================================================== */}
      {activeTab === "deterministic" && (
        <div className="mt-6 space-y-6">
          {/* Core Metrics */}
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

          {/* DYNAMIC WHAT-IF CONTROLS */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Box: Resources */}
            <div className="rounded-xl border border-[#39506e] bg-[#10233a] p-5">
              <div className="flex items-center justify-between border-b border-[#23354d] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#e6edf7]">Dynamic Resources (What-If)</h3>
                  <p className="text-xs text-[#9aabc1]">Tweak fleet sizes to test instant recalculation in 0ms.</p>
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
                    <span>Capacity: {twin.resources.buses.value * 50} persons</span>
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
                    <span>Capacity: {twin.resources.boats.value * 20} persons</span>
                    <span>Utilization: {result.resourceUtilization.boats.utilizationPercent}%</span>
                  </div>
                </div>

                {/* Ambulances & Teams */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-[#e6edf7]">Ambulances</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={twin.resources.ambulances.value}
                      onChange={(e) => handleResourceChange("ambulances", Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-[#39506e] bg-[#07111f] p-2 font-mono text-xs text-white"
                    />
                  </div>
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
                </div>
              </div>
            </div>

            {/* Right Box: Priority Weights */}
            <div className="rounded-xl border border-[#39506e] bg-[#10233a] p-5">
              <div className="flex items-center justify-between border-b border-[#23354d] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#e6edf7]">Priorities Weights (Sum = 100%)</h3>
                  <p className="text-xs text-[#9aabc1]">Alter weights to re-rank candidate routes dynamically.</p>
                </div>
                <span className="rounded-full bg-[#39d4b4]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#39d4b4]">
                  Total: {twin.priorities.safety + twin.priorities.speed + twin.priorities.cost + twin.priorities.coverage + twin.priorities.reliability}%
                </span>
              </div>

              {/* Profiles */}
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
                  subtext="Penalizes flood-prone bridges and waterlogged underpasses"
                  onChange={(v) => handlePriorityChange("safety", v)}
                />
                <PrioritySlider
                  label="Speed Priority"
                  weight={twin.priorities.speed}
                  subtext="Prioritizes shortest driving minutes and rapid transit waves"
                  onChange={(v) => handlePriorityChange("speed", v)}
                />
                <PrioritySlider
                  label="Cost Priority"
                  weight={twin.priorities.cost}
                  subtext="Conserves vehicle operational hours and fuel surcharge"
                  onChange={(v) => handlePriorityChange("cost", v)}
                />
              </div>
            </div>
          </div>

          {/* Bottlenecks Callout */}
          {result.bottlenecks.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="text-base">🚨</span>
                <h4 className="text-sm font-bold tracking-wide">Primary Operational Bottlenecks</h4>
              </div>
              <div className="mt-2.5 space-y-2">
                {result.bottlenecks.map((b, idx) => (
                  <div key={idx} className="rounded-lg border border-amber-500/20 bg-[#07111f]/70 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">{b.resourceOrFactor}</span>
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] text-amber-300 font-semibold">
                        {b.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[#e6edf7]">{b.message}</p>
                    <p className="mt-1 text-[11px] text-[#9aabc1]"><b>Impact:</b> {b.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: CANDIDATE ROUTES (DYNAMIC SCORING)            */}
      {/* ==================================================== */}
      {activeTab === "routes" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <p className="text-[#9aabc1]">
              Corridors from <b>VIT Chennai Base</b> to <b>{twin.location.name}</b> evaluated dynamically against Safety ({twin.priorities.safety}%), Speed ({twin.priorities.speed}%), and Cost ({twin.priorities.cost}%).
            </p>
            <span className="text-[#39d4b4]">Click route to view on map</span>
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
                        ★ DYNAMIC BEST ROUTE
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-white">Score: {r.score}/100</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded bg-[#07111f]/60 p-2">
                    <p className="text-[#9aabc1]">One-Way Transit</p>
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

                {/* Provenance factors */}
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="text-[#9aabc1]">Available factors:</span>
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

      {/* ==================================================== */}
      {/* TAB 4: DECISION TWIN SPECIFICATION                   */}
      {/* ==================================================== */}
      {activeTab === "twin-spec" && (
        <div className="mt-6 space-y-4 text-xs">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-4 space-y-1.5">
              <h4 className="font-bold text-[#e6edf7] border-b border-[#23354d] pb-2">Scenario Identification</h4>
              <p><b>ID:</b> <span className="font-mono text-[#39d4b4]">{twin.scenarioId}</span></p>
              <p><b>Name:</b> {twin.scenarioName}</p>
              <p><b>Hazard:</b> {twin.hazard.description}</p>
              <p><b>Water Depth:</b> {twin.hazard.waterLevel.value}</p>
            </div>

            <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-4 space-y-1.5">
              <h4 className="font-bold text-[#e6edf7] border-b border-[#23354d] pb-2">Environmental Context</h4>
              <p><b>Location:</b> {twin.location.name}</p>
              <p><b>Storm Drains:</b> {twin.geographicContext?.drains ?? 0} (GCC GIS)</p>
              <p><b>Rivers:</b> {twin.geographicContext?.rivers ?? 0} (GCC GIS)</p>
              <p><b>Rainfall:</b> {twin.weatherContext?.rainfallMm ?? 0} mm (Open-Meteo)</p>
            </div>

            <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-4 space-y-1.5">
              <h4 className="font-bold text-[#e6edf7] border-b border-[#23354d] pb-2">Disaster Profile Match</h4>
              <p><b>Locality Risk:</b> <span className="font-bold text-amber-300">{twin.historicalContext.localityRiskLevel}</span></p>
              <p><b>Matched Event:</b> {twin.historicalContext.matchedEvent ? twin.historicalContext.matchedEvent.name : "South India Monsoon Base"}</p>
              <p className="text-[11px] text-[#9aabc1]">{twin.historicalContext.historicalInundationNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: DATA TRANSPARENCY                             */}
      {/* ==================================================== */}
      {activeTab === "transparency" && (
        <div className="mt-6 space-y-3">
          <p className="text-xs text-[#9aabc1]">
            Every input retains metadata provenance. Simulated parameters are explicitly distinguished from real-world telemetry.
          </p>
          <div className="space-y-2">
            {twin.dataSources.map((ds, idx) => (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#23354d] bg-[#10233a] p-3 text-xs">
                <div>
                  <p className="font-semibold text-[#e6edf7]">{ds.label}</p>
                  <p className="text-[11px] text-[#9aabc1]">Source: <span className="text-[#69e8d1]">{ds.source}</span> ({ds.sourceType})</p>
                </div>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  {ds.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HUMAN DISPATCH CONFIRMATION MODAL */}
      {showDispatchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispatch-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div className="w-full max-w-lg rounded-3xl border border-[#39d4b4]/40 bg-[#0d1b2d] p-6 shadow-2xl text-xs space-y-4 text-[#e6edf7]">
            <div className="flex items-center justify-between border-b border-[#23354d] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <div>
                  <h3 id="dispatch-modal-title" className="text-sm font-bold text-white">
                    HUMAN COMMAND AUTHORIZATION REQUIRED
                  </h3>
                  <p className="text-[10px] text-[#9aabc1]">
                    Disaster Management Protocol: Dispatch must be authorized by an authenticated officer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="text-lg text-[#9aabc1] hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Mission Summary Card */}
            <div className="rounded-xl border border-[#23354d] bg-[#07111f] p-4 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-[#9aabc1]">Incident Target:</span>
                <b className="text-white font-mono">{twin.location.name}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9aabc1]">Target Coordinates:</span>
                <span className="text-[#69e8d1] font-mono">{twin.location.lat.toFixed(4)}, {twin.location.lng.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9aabc1]">Assigned Corridor:</span>
                <span className="text-white">{bestRoute?.name || "Route 1"} ({bestRoute?.distanceKm} km)</span>
              </div>
              <div className="flex justify-between border-t border-[#1b2b3e] pt-2">
                <span className="text-[#9aabc1]">Authorized Fleet:</span>
                <span className="font-bold text-[#39d4b4]">
                  {twin.resources.buses.value} Buses · {twin.resources.boats.value} Boats · {twin.resources.ambulances.value} Ambulances · {twin.resources.rescueTeams.value} Teams
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9aabc1]">Evacuation Waves:</span>
                <span className="text-white">{result.wavesRequired} Wave(s) (Est. {result.evacuationTimeMinutes} min)</span>
              </div>
            </div>

            {/* Officer Reason Input */}
            <div>
              <label htmlFor="dispatch-reason" className="block font-bold text-white mb-1">
                Operational Rationale & Authorization Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                id="dispatch-reason"
                rows={3}
                value={dispatchReason}
                onChange={(e) => setDispatchReason(e.target.value)}
                placeholder="State the operational reason for authorizing this dispatch (e.g. Inundation depth confirmed at 30cm; primary GST route cleared; 8 buses allocated for first wave extraction)…"
                className="w-full rounded-xl border border-[#39506e] bg-[#07111f] p-3 text-xs text-[#e6edf7] outline-none focus:border-[#39d4b4] focus:ring-2 focus:ring-[#39d4b4]/20"
              />
            </div>

            {dispatchError && (
              <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-red-200">
                ⚠️ {dispatchError}
              </div>
            )}

            {dispatchSuccess && (
              <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-emerald-200 font-bold">
                ✅ {dispatchSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="rounded-xl border border-[#39506e] bg-[#10233a] px-4 py-2 text-xs font-semibold text-[#9aabc1] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={dispatching}
                onClick={handleConfirmDispatch}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] px-5 py-2.5 text-xs font-bold text-[#062019] shadow-lg shadow-[#39d4b4]/30 hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {dispatching ? "Recording Official Dispatch…" : "Confirm & Dispatch Fleet →"}
              </button>
            </div>
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

function ProbMetricCard({
  label,
  value,
  subtext,
  badge,
  color = "teal"
}: {
  label: string;
  value: string;
  subtext: string;
  badge?: string;
  color?: "teal" | "blue" | "red" | "emerald" | "amber";
}) {
  const bgClass =
    color === "emerald"
      ? "bg-emerald-500/10 border-emerald-500/30"
      : color === "red"
      ? "bg-red-500/10 border-red-500/30"
      : color === "amber"
      ? "bg-amber-500/10 border-amber-500/30"
      : color === "blue"
      ? "bg-blue-500/10 border-blue-500/30"
      : "bg-[#113c3d] border-[#39d4b4]/30";

  const valColor =
    color === "emerald"
      ? "text-emerald-300"
      : color === "red"
      ? "text-red-300"
      : color === "amber"
      ? "text-amber-300"
      : color === "blue"
      ? "text-blue-200"
      : "text-[#69e8d1]";

  return (
    <div className={`rounded-xl border p-3.5 ${bgClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#9aabc1]">{label}</p>
        {badge && (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-300">
            {badge}
          </span>
        )}
      </div>
      <p className={`mt-1 font-mono text-xl font-bold ${valColor}`}>{value}</p>
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

function RiskMetricCard({
  label,
  value,
  source,
  detail,
  isConfidence = false,
}: {
  label: string;
  value: number;
  source: string;
  detail: string;
  isConfidence?: boolean;
}) {
  const isGood = isConfidence ? value >= 70 : value < 40;
  const isMed = isConfidence ? value >= 50 && value < 70 : value >= 40 && value < 70;

  return (
    <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-3 text-xs">
      <span className="text-[11px] font-bold text-[#b6c4d5] block">{label}</span>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`font-mono text-xl font-bold ${
            isGood ? "text-emerald-400" : isMed ? "text-amber-300" : "text-red-400"
          }`}
        >
          {value}{isConfidence ? "%" : "/100"}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-[#9aabc1] leading-tight">{detail}</p>
      <div className="mt-2 pt-1 border-t border-[#1b2b3e] text-[9px] text-[#69e8d1] truncate">
        Src: {source}
      </div>
    </div>
  );
}
