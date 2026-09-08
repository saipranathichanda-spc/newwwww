"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChennaiMap } from "@/components/map/chennai-map";
import { WeatherContextPanel } from "@/components/dashboard/weather-context";
import { ScenarioComposer, type Result } from "@/components/scenario/scenario-composer";
import { CitizenReportsPanel } from "@/components/dashboard/citizen-reports-panel";
import { DecisionTwinSimulationPanel } from "@/components/dashboard/decision-twin-simulation-panel";
import type { CitizenReport } from "@/lib/reports-store";
import type { RouteOption } from "@/lib/data-sources/routing";
import type { DecisionTwin, SimulationResult } from "@/lib/decision-twin";

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [officerName, setOfficerName] = useState("Incident Commander");
  const [floodLocation, setFloodLocation] = useState("Velachery, Chennai");
  const [focusedReport, setFocusedReport] = useState<CitizenReport | null>(null);
  const [simulationRoutes, setSimulationRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  // Enforce secure administrative authorization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("astra_admin_token");
      if (!token) {
        setIsAuthenticated(false);
        router.replace("/admin/login");
        return;
      }
      setIsAuthenticated(true);
      const officer = sessionStorage.getItem("astra_admin_officer");
      if (officer) setOfficerName(officer);
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("astra_admin_token");
    sessionStorage.removeItem("astra_admin_officer");
    document.cookie = "astra_admin_auth=; path=/; max-age=0";
    router.replace("/admin/login");
  }

  // Prevent flash of administrative controls if unauthorized
  if (isAuthenticated === null || isAuthenticated === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-[#e6edf7]">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#39d4b4] border-t-transparent" />
          <p className="text-xs tracking-wider text-[#9aabc1]">Verifying Administrative Authorization…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07111f] px-6 py-8 text-[#e6edf7]">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Admin Navigation Bar with Session Lock */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#23354d] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#39d4b4]/20 text-sm">
              🛡️
            </span>
            <span className="font-bold tracking-tight text-base text-[#e6edf7]">
              ASTRA · COMMAND OPS
            </span>
            <span className="text-[#39506e]">|</span>
            <span className="rounded-full bg-[#113c3d] px-3 py-1 text-xs font-bold text-[#69e8d1] border border-[#39d4b4]/30">
              OFFICIAL EMERGENCY DISPATCH
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#9aabc1] hidden sm:inline">
              Officer: <b className="text-[#e6edf7]">{officerName}</b>
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
            >
              🔒 Logout / Lock
            </button>
          </div>
        </div>

        {/* Hero Header */}
        <div>
          <p className="text-sm font-medium tracking-[.16em] text-[#39d4b4]">CHENNAI FLOOD COMMAND & DECISION TWIN</p>
          <h1 className="mt-2 text-3xl font-semibold">City-Scale Emergency Response & Resource Orchestration</h1>
          <p className="mt-1 text-xs text-[#9aabc1]">
            Deterministic AI decision twin simulating staging corridors from VIT Chennai Hub, synchronized with live citizen distress signals and GCC GIS layers.
          </p>
        </div>

        {/* Phase 8: Core Decision Twin & Deterministic Simulation Engine */}
        <DecisionTwinSimulationPanel
          initialPlace={floodLocation}
          onDecisionTwinChange={(twin, sim) => {
            if (twin.location?.name && twin.location.name !== floodLocation) {
              setFloodLocation(twin.location.name);
            }
            if (twin.routes && twin.routes.length > 0) {
              setSimulationRoutes(twin.routes);
            }
          }}
          onSelectRoute={(idx) => {
            setSelectedRouteIndex(idx);
            const mapEl = document.getElementById("admin-chennai-map");
            mapEl?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Live Citizen Reports & Emergency Alerts Feed */}
        <CitizenReportsPanel
          onSelectReport={(report) => {
            setFocusedReport(report);
            // Scroll smoothly to the map
            const mapEl = document.getElementById("admin-chennai-map");
            mapEl?.scrollIntoView({ behavior: "smooth" });
          }}
          selectedReportId={focusedReport?.id}
        />

        {/* Quick Scenario Natural Language Composer */}
        <ScenarioComposer
          onScenarioBuilt={(result: Result) => {
            if (result.place) setFloodLocation(result.place);
            if (result.routes && result.routes.length > 0) {
              setSimulationRoutes(result.routes);
            }
          }}
        />

        {/* Weather Context Panel */}
        <WeatherContextPanel />

        {/* Interactive Map with Base Hub & Focused Citizen Inspection */}
        <div id="admin-chennai-map" className="scroll-mt-6">
          <ChennaiMap
            floodDestination={floodLocation}
            onDestinationChange={setFloodLocation}
            focusedReport={focusedReport}
            onClearFocusedReport={() => setFocusedReport(null)}
            simulationRoutes={simulationRoutes}
            selectedSimulationRouteIndex={selectedRouteIndex}
          />
        </div>

        {/* Operational Status Footer */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Fixed Base Hub" status="VIT Chennai (Permanent Dispatch)" />
          <Card title="Citizen Emergency Stream" status="Live Synchronized" />
          <Card title="Decision Twin Simulation" status="Active Operational" />
        </div>
      </div>
    </main>
  );
}

function Card({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-5">
      <p className="font-medium text-sm text-[#e6edf7]">{title}</p>
      <p className="mt-1.5 text-xs text-[#39d4b4]">{status}</p>
    </div>
  );
}
