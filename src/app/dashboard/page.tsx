"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChennaiMap } from "@/components/map/chennai-map";
import { DecisionTwinSimulationPanel } from "@/components/dashboard/decision-twin-simulation-panel";
import { CitizenDispatchInterface } from "@/components/dashboard/citizen-dispatch-interface";
import type { CitizenReport, IncidentStatus } from "@/lib/reports-store";
import type { RouteOption } from "@/lib/data-sources/routing";
import type { DecisionTwin, SimulationResult } from "@/lib/decision-twin";

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [officerName, setOfficerName] = useState("Incident Commander");

  // Active Interface Mode: 'user-interface' (Citizen Distress Signals) vs 'decision-twin' (City-Scale Decision Twin & Simulation)
  const [activeInterface, setActiveInterface] = useState<"user-interface" | "decision-twin">("decision-twin");

  // Citizen Reports Feed & Live Notification State
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [latestAlert, setLatestAlert] = useState<CitizenReport | null>(null);
  const previousCountRef = useRef<number | null>(null);

  // Twin & Corridor State
  const [floodLocation, setFloodLocation] = useState("Velachery, Chennai");
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

  // Audio alert chime when emergency signal arrives from /user
  function triggerEmergencyChime() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // Audio policy fallback
    }
  }

  // Poll live citizen distress signals every 5 seconds
  async function loadReports() {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data: CitizenReport[] = await res.json();
        if (previousCountRef.current !== null && data.length > previousCountRef.current) {
          const newest = data[0];
          setLatestAlert(newest);
          triggerEmergencyChime();
        }
        previousCountRef.current = data.length;
        setReports((prev) => {
          if (
            prev.length === data.length &&
            prev.every((r, idx) => r.id === data[idx]?.id && r.status === data[idx]?.status)
          ) {
            return prev;
          }
          return data;
        });
      }
    } catch {
      // network hiccup fallback
    } finally {
      setReportsLoading(false);
    }
  }

  const handleDecisionTwinChange = useCallback((twin: DecisionTwin, _sim: SimulationResult) => {
    if (twin.location?.name) {
      setFloodLocation((prev) => (prev !== twin.location.name ? twin.location.name : prev));
    }
    if (twin.routes && twin.routes.length > 0) {
      setSimulationRoutes((prev) => {
        if (prev && prev.length === twin.routes.length && prev[0]?.id === twin.routes[0]?.id) {
          return prev;
        }
        return twin.routes;
      });
    }
  }, []);

  useEffect(() => {
    loadReports();
    const interval = setInterval(loadReports, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleStatusUpdate(id: string, status: IncidentStatus) {
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
        if (latestAlert?.id === id && status === "RESOLVED") {
          setLatestAlert(null);
        }
      }
    } catch {
      alert("Failed to update incident status");
    }
  }

  function handleSendToDecisionTwin(locationName: string, population: number) {
    setFloodLocation(locationName);
    setActiveInterface("decision-twin");
  }

  function handleLogout() {
    sessionStorage.removeItem("astra_admin_token");
    sessionStorage.removeItem("astra_admin_officer");
    document.cookie = "astra_admin_auth=; path=/; max-age=0";
    router.replace("/admin/login");
  }

  // Prevent flash of admin controls if unauthorized
  if (isAuthenticated === null || isAuthenticated === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-[#e6edf7]">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#39d4b4] border-t-transparent" />
          <p className="text-xs tracking-wider text-[#9aabc1]">
            Verifying Administrative Authorization…
          </p>
        </div>
      </main>
    );
  }

  const pendingReportsCount = reports.filter((r) => r.status === "PENDING").length;

  return (
    <main className="min-h-screen bg-[#07111f] px-4 sm:px-6 py-6 text-[#e6edf7]">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Emergency Notification Banner (Pops up when a citizen submits distress) */}
        {latestAlert && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-500 bg-red-950/80 p-4 shadow-2xl shadow-red-500/30 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-xl text-white">
                🚨
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-red-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                    INCOMING CITIZEN DISTRESS SIGNAL
                  </span>
                  <span className="text-xs font-mono text-red-300">{latestAlert.id}</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {latestAlert.location.name} ·{" "}
                  <span className="text-red-300">{latestAlert.peopleCount} trapped</span>
                  {latestAlert.notes && ` — “${latestAlert.notes}”`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveInterface("user-interface");
                  setLatestAlert(null);
                }}
                className="rounded-xl bg-red-500 px-4 py-2 text-xs font-extrabold text-white shadow-lg hover:bg-red-400"
              >
                Inspect in User Interface →
              </button>
              <button
                type="button"
                onClick={() => setLatestAlert(null)}
                className="rounded-xl border border-red-400/40 bg-black/40 px-3 py-2 text-xs text-red-200 hover:bg-black/60"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Top Administrative Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#23354d] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#39d4b4]/20 text-base shadow-md shadow-[#39d4b4]/20">
              🛡️
            </span>
            <div>
              <span className="font-bold tracking-tight text-base text-[#e6edf7]">
                ASTRA · COMMAND OPS
              </span>
              <span className="mx-2 text-[#39506e]">|</span>
              <span className="rounded-full bg-[#113c3d] px-2.5 py-0.5 text-[11px] font-bold text-[#69e8d1] border border-[#39d4b4]/30">
                OFFICIAL EMERGENCY DISPATCH
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Switch to Citizen User Portal */}
            <a
              href="/user"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-[#39506e] bg-[#10233a] px-3.5 py-1.5 text-xs font-semibold text-[#69e8d1] hover:border-[#39d4b4] transition-colors"
            >
              <span>👤 User Portal</span>
              <span className="text-[10px] text-[#9aabc1]">↗</span>
            </a>

            {/* Notification Bell / Status */}
            <button
              type="button"
              onClick={() => setActiveInterface("user-interface")}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                pendingReportsCount > 0
                  ? "border-red-500/50 bg-red-500/15 text-red-300"
                  : "border-[#23354d] bg-[#10233a] text-[#9aabc1]"
              }`}
            >
              <span>🔔</span>
              <span>Distress Signals</span>
              {pendingReportsCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {pendingReportsCount}
                </span>
              )}
            </button>

            <span className="font-mono text-xs text-[#9aabc1] hidden md:inline">
              Officer: <b className="text-[#e6edf7]">{officerName}</b>
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
            >
              🔒 Lock / Logout
            </button>
          </div>
        </div>

        {/* Hero Header & Dual Interface Switcher */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-[#39d4b4]">
              CHENNAI FLOOD COMMAND & DECISION TWIN
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-[#e6edf7]">
              City-Scale Emergency Response & Resource Orchestration
            </h1>
            <p className="mt-1 text-xs text-[#9aabc1]">
              Synchronized dispatch origin fixed at <b>VIT Chennai Base Hub</b>. Two integrated operational interfaces: live citizen emergency inbox and unified Decision Twin simulation.
            </p>
          </div>

          {/* TWO PRIMARY INTERFACE TABS */}
          <div className="flex rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => setActiveInterface("user-interface")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                activeInterface === "user-interface"
                  ? "bg-[#39d4b4] text-[#062019] shadow-lg shadow-[#39d4b4]/30"
                  : "text-[#9aabc1] hover:text-[#e6edf7]"
              }`}
            >
              <span>🚨</span>
              <span>1. User Interface (Citizen Distress)</span>
              {pendingReportsCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeInterface === "user-interface"
                      ? "bg-[#062019] text-[#39d4b4]"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {pendingReportsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveInterface("decision-twin")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                activeInterface === "decision-twin"
                  ? "bg-[#39d4b4] text-[#062019] shadow-lg shadow-[#39d4b4]/30"
                  : "text-[#9aabc1] hover:text-[#e6edf7]"
              }`}
            >
              <span>🌐</span>
              <span>2. Decision Twin & Simulation</span>
            </button>
          </div>
        </div>

        {/* INTERFACE 1: CITIZEN DISTRESS & USER REPORTS DESK */}
        {activeInterface === "user-interface" && (
          <CitizenDispatchInterface
            reports={reports}
            loading={reportsLoading}
            onRefresh={loadReports}
            onStatusUpdate={handleStatusUpdate}
            onSendToDecisionTwin={handleSendToDecisionTwin}
          />
        )}

        {/* INTERFACE 2: UNIFIED DECISION TWIN & SIMULATION ENGINE */}
        {activeInterface === "decision-twin" && (
          <div className="space-y-6">
            <DecisionTwinSimulationPanel
              initialPlace={floodLocation}
              onDecisionTwinChange={handleDecisionTwinChange}
              onSelectRoute={(idx) => {
                setSelectedRouteIndex(idx);
                const mapEl = document.getElementById("admin-chennai-map");
                mapEl?.scrollIntoView({ behavior: "smooth" });
              }}
            />

            {/* Embedded Live Map for Decision Twin */}
            <div id="admin-chennai-map" className="rounded-2xl border border-[#23354d] overflow-hidden bg-[#0d1b2d] shadow-xl">
              <div className="border-b border-[#23354d] bg-[#10233a] px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-[#69e8d1]">
                    🗺️ LIVE MAP & CANDIDATE CORRIDORS (VIT CHENNAI → {floodLocation.toUpperCase()})
                  </p>
                  <p className="text-[11px] text-[#9aabc1]">
                    Visualizing fixed dispatch origin at VIT Chennai, selected candidate corridors, and flood destination.
                  </p>
                </div>
              </div>
              <ChennaiMap
                floodDestination={floodLocation}
                onDestinationChange={setFloodLocation}
                simulationRoutes={simulationRoutes}
                selectedSimulationRouteIndex={selectedRouteIndex}
              />
            </div>
          </div>
        )}

        {/* Operational System Status Footer */}
        <div className="grid gap-4 sm:grid-cols-3 border-t border-[#23354d] pt-6">
          <Card title="Fixed Dispatch Base" status="VIT Chennai (Permanent Emergency Hub)" />
          <Card
            title="Citizen Distress Stream"
            status={`Live Synchronized (${reports.length} Total Reports)`}
          />
          <Card
            title="Decision Intelligence"
            status="Deterministic + Monte Carlo (Phase 9 Active)"
          />
        </div>
      </div>
    </main>
  );
}

function Card({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-4">
      <p className="font-medium text-xs text-[#9aabc1]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[#39d4b4]">{status}</p>
    </div>
  );
}
