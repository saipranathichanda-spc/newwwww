"use client";

import { useEffect, useState, useRef } from "react";
import type { CitizenReport, IncidentStatus } from "@/lib/reports-store";

interface CitizenReportsPanelProps {
  onSelectReport?: (report: CitizenReport) => void;
  selectedReportId?: string | null;
}

export function CitizenReportsPanel({ onSelectReport, selectedReportId }: CitizenReportsPanelProps) {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "PENDING">("ALL");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [newAlertBanner, setNewAlertBanner] = useState<CitizenReport | null>(null);
  
  const previousCountRef = useRef<number | null>(null);

  // Play audio alert chime when a new emergency report is detected
  function triggerEmergencyChime() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // Audio autoplay policy fallback
    }
  }

  async function loadReports() {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data: CitizenReport[] = await res.json();
        
        // Detect if a new report arrived
        if (previousCountRef.current !== null && data.length > previousCountRef.current) {
          const newest = data[0];
          setNewAlertBanner(newest);
          triggerEmergencyChime();
        }
        previousCountRef.current = data.length;
        setReports(data);
      }
    } catch {
      // ignore network hiccups
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    const interval = setInterval(loadReports, 7000); // Polling every 7 seconds for live citizen updates
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
      }
    } catch {
      alert("Failed to update status");
    }
  }

  const filtered = reports.filter((r) => {
    if (filter === "CRITICAL") return r.severity === "CRITICAL";
    if (filter === "PENDING") return r.status === "PENDING";
    return true;
  });

  const criticalCount = reports.filter((r) => r.severity === "CRITICAL").length;
  const pendingCount = reports.filter((r) => r.status === "PENDING").length;

  return (
    <section className="mt-8 rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-6 shadow-xl">
      {/* Live Incoming Alert Banner */}
      {newAlertBanner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500 bg-red-500/20 p-4 shadow-lg shadow-red-500/20 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="text-xs font-bold tracking-wider text-red-300">
                NEW USER EMERGENCY REPORT DETECTED!
              </p>
              <p className="text-sm font-bold text-white">
                {newAlertBanner.id} · {newAlertBanner.location.name} ({newAlertBanner.peopleCount} trapped)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectReport?.(newAlertBanner);
                setExpandedReportId(newAlertBanner.id);
                setNewAlertBanner(null);
              }}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-400"
            >
              🗺️ Inspect on Map
            </button>
            <button
              type="button"
              onClick={() => setNewAlertBanner(null)}
              className="rounded-lg border border-red-400/40 bg-black/30 px-2.5 py-1.5 text-xs text-red-200 hover:bg-black/50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[.16em] text-[#39d4b4]">
            USER REPORTS & EMERGENCY ALERTS DESK
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#e6edf7]">
            Citizen Emergency Reports & Live Corridors
          </h2>
          <p className="mt-1 text-xs text-[#9aabc1]">
            Centralized stream of all live GPS locations, route calculations, questionnaire answers, and rescue requests submitted by citizens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadReports}
            className="rounded-lg border border-[#39506e] bg-[#07111f] px-3 py-1.5 text-xs text-[#b6c4d5] hover:border-[#39d4b4]"
          >
            🔄 Sync Live
          </button>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            Live Sync Active
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-3.5">
          <p className="text-xs text-[#9aabc1]">Total Citizen Reports</p>
          <p className="mt-1 text-2xl font-bold text-[#e6edf7]">{reports.length}</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5">
          <p className="text-xs text-red-300 font-medium">Critical Emergencies</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{criticalCount}</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <p className="text-xs text-amber-300 font-medium">Pending Response</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-3.5">
          <p className="text-xs text-[#9aabc1]">Active Isolated Sessions</p>
          <p className="mt-1 text-2xl font-bold text-[#39d4b4]">
            {new Set(reports.map((r) => r.sessionId)).size}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-5 flex gap-2 border-b border-[#23354d] pb-3 text-xs">
        {(["ALL", "CRITICAL", "PENDING"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              filter === tab
                ? "bg-[#39d4b4] text-[#062019] font-semibold"
                : "bg-[#07111f] text-[#9aabc1] hover:text-[#e6edf7]"
            }`}
          >
            {tab === "ALL"
              ? `All Reports (${reports.length})`
              : tab === "CRITICAL"
              ? `Critical (${criticalCount})`
              : `Pending Response (${pendingCount})`}
          </button>
        ))}
      </div>

      {/* Reports Feed */}
      <div className="mt-4 space-y-4">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#9aabc1]">No reports matching this filter.</p>
        ) : (
          filtered.map((report) => {
            const isSelected = selectedReportId === report.id;
            const isExpanded = expandedReportId === report.id || isSelected;

            return (
              <div
                key={report.id}
                className={`rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-[#39d4b4] bg-[#0b292d] shadow-lg shadow-[#39d4b4]/10 ring-1 ring-[#39d4b4]"
                    : report.severity === "CRITICAL"
                    ? "border-red-500/40 bg-[#1e111a]"
                    : "border-[#23354d] bg-[#10233a]"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#23354d]/60 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#e6edf7]">{report.id}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        report.severity === "CRITICAL"
                          ? "bg-red-500 text-white"
                          : report.severity === "HIGH"
                          ? "bg-amber-500 text-black font-semibold"
                          : "bg-blue-500 text-white"
                      }`}
                    >
                      {report.severity}
                    </span>
                    {report.hasMedicalEmergency && (
                      <span className="rounded-full bg-red-600/30 border border-red-500/60 px-2 py-0.5 text-[10px] text-red-200 font-bold">
                        🚨 MEDICAL PRIORITY
                      </span>
                    )}
                    {report.routeSafetyStatus && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          report.routeSafetyStatus === "SAFE_CORRIDOR"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : report.routeSafetyStatus === "MODERATE_RISK"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {report.routeSafetyStatus.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-[#69e8d1]">
                      Session: {report.sessionId}
                    </span>
                    <span className="text-[11px] text-[#9aabc1]">
                      {new Date(report.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Primary Info: Location & Destination & Distance */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#9aabc1]">USER CURRENT LOCATION (GPS):</p>
                    <p className="font-semibold text-[#e6edf7]">{report.location.name}</p>
                    <p className="font-mono text-[11px] text-[#39d4b4]">
                      📍 {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#9aabc1]">USER INTENDED DESTINATION:</p>
                    <p className="font-semibold text-[#e6edf7]">
                      {report.destination ? report.destination.name : "Local Flood Refuge / Staging"}
                    </p>
                    {report.distanceKm && (
                      <p className="text-[11px] text-[#b6c4d5]">
                        Distance: <b>{report.distanceKm} km</b> · Est. Travel: <b>~{report.travelMinutes ?? "—"} min</b>
                        {report.riskScore != null && (
                          <span> · Risk Index: <b className="text-amber-400">{report.riskScore}/100</b></span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Distress Message Box */}
                {report.notes && (
                  <div className="mt-3 rounded-lg border border-[#39506e]/40 bg-[#07111f] p-3 text-xs">
                    <p className="text-[10px] font-bold tracking-wider text-red-400">EMERGENCY MESSAGE FROM CITIZEN:</p>
                    <p className="mt-1 text-[#e6edf7] font-medium leading-5">&ldquo;{report.notes}&rdquo;</p>
                  </div>
                )}

                {/* Expandable Deep Details */}
                {isExpanded && (
                  <div className="mt-3 space-y-3 rounded-lg border border-[#23354d] bg-[#07111f]/80 p-3 text-xs">
                    {/* Questionnaire Answers */}
                    <div>
                      <p className="text-[11px] font-bold text-[#69e8d1]">USER QUESTIONNAIRE ANSWERS:</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] text-[#c5d7e9] sm:grid-cols-3">
                        <div className="rounded bg-[#10233a] p-2">
                          <span className="text-[#9aabc1] block text-[10px]">Water Level:</span>
                          <b>{report.answers?.waterLevel || report.waterLevel}</b>
                        </div>
                        <div className="rounded bg-[#10233a] p-2">
                          <span className="text-[#9aabc1] block text-[10px]">Water Current:</span>
                          <b>{report.answers?.waterMovement || report.waterMovement}</b>
                        </div>
                        <div className="rounded bg-[#10233a] p-2">
                          <span className="text-[#9aabc1] block text-[10px]">Mobility / Vehicle:</span>
                          <b>{report.answers?.mobility || "Not specified"}</b>
                        </div>
                        <div className="rounded bg-[#10233a] p-2">
                          <span className="text-[#9aabc1] block text-[10px]">Vulnerability:</span>
                          <b>{report.answers?.vulnerability || (report.hasMedicalEmergency ? "Medical Alert" : "None")}</b>
                        </div>
                        <div className="rounded bg-[#10233a] p-2">
                          <span className="text-[#9aabc1] block text-[10px]">Assistance Needed:</span>
                          <b>{report.answers?.assistance || (report.needsEvacuation ? "Evacuation Boat" : "Route Guidance")}</b>
                        </div>
                        <div className="rounded bg-[#10233a] p-2">
                          <span className="text-[#9aabc1] block text-[10px]">People Trapped:</span>
                          <b className="text-red-300">{report.peopleCount} person(s)</b>
                        </div>
                      </div>
                    </div>

                    {/* Hazards Along Route */}
                    {report.hazards && report.hazards.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-amber-400">DETECTED ROAD HAZARDS / BOTTLENECK POINTS:</p>
                        <ul className="mt-1 space-y-1">
                          {report.hazards.map((h, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-[11px] text-[#b6c4d5]">
                              <span className="font-bold text-amber-400">KM {h.kmMarker}:</span>
                              <span>{h.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Nearby Hospitals */}
                    {report.nearbyHospitals && report.nearbyHospitals.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-[#39d4b4]">NEARBY HOSPITALS FOR THIS CITIZEN:</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                          {report.nearbyHospitals.map((h, idx) => (
                            <span key={idx} className="rounded border border-[#39506e]/50 bg-[#10233a] px-2 py-1 text-[#e6edf7]">
                              🏥 {h.name} {h.distanceKm != null && `(${h.distanceKm} km)`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Action & Inspection Bar */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#23354d]/80 pt-3">
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                      className="text-xs text-[#39d4b4] hover:underline"
                    >
                      {isExpanded ? "▲ Hide Questionnaire & Hazards" : "▼ Show Full Survey & Hazards"}
                    </button>
                    <span className="text-[#39506e]">|</span>
                    <span className="text-[#9aabc1]">Status:</span>
                    <span
                      className={`font-semibold ${
                        report.status === "RESOLVED"
                          ? "text-emerald-400"
                          : report.status === "DISPATCHED"
                          ? "text-[#39d4b4]"
                          : report.status === "ACKNOWLEDGED"
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* View on Map Button */}
                    <button
                      type="button"
                      onClick={() => onSelectReport?.(report)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-[#39d4b4] text-[#062019] shadow-md shadow-[#39d4b4]/30"
                          : "border border-[#39d4b4] text-[#39d4b4] hover:bg-[#39d4b4]/15"
                      }`}
                    >
                      🗺️ {isSelected ? "Active on Map" : "View on Map"}
                    </button>

                    {/* Status Modifiers */}
                    {report.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(report.id, "ACKNOWLEDGED")}
                        className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20"
                      >
                        Acknowledge
                      </button>
                    )}
                    {report.status !== "DISPATCHED" && report.status !== "RESOLVED" && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(report.id, "DISPATCHED")}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 shadow-md shadow-red-600/20"
                      >
                        Dispatch Boat / Team
                      </button>
                    )}
                    {report.status !== "RESOLVED" && (
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(report.id, "RESOLVED")}
                        className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
