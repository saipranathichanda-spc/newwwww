"use client";

import { useState } from "react";
import type { CitizenReport, IncidentStatus } from "@/lib/reports-store";
import { ChennaiMap } from "@/components/map/chennai-map";

interface CitizenDispatchInterfaceProps {
  reports: CitizenReport[];
  loading: boolean;
  onRefresh: () => void;
  onStatusUpdate: (id: string, status: IncidentStatus) => Promise<void>;
  onSendToDecisionTwin: (locationName: string, population: number) => void;
}

export function CitizenDispatchInterface({
  reports,
  loading,
  onRefresh,
  onStatusUpdate,
  onSendToDecisionTwin,
}: CitizenDispatchInterfaceProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports[0]?.id || null
  );
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "CRITICAL" | "RESOLVED">("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const selectedReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  const filteredReports = reports.filter((r) => {
    if (filter === "PENDING") return r.status === "PENDING";
    if (filter === "CRITICAL") return r.severity === "CRITICAL";
    if (filter === "RESOLVED") return r.status === "RESOLVED";
    return true;
  });

  const pendingCount = reports.filter((r) => r.status === "PENDING").length;
  const criticalCount = reports.filter((r) => r.severity === "CRITICAL").length;

  // Calculate recommended vehicles based on citizen report context
  function calculateDispatchVehicles(report: CitizenReport) {
    const people = report.peopleCount || 1;
    const isDeepWater =
      report.waterLevel?.toLowerCase().includes("knee") ||
      report.waterLevel?.toLowerCase().includes("waist") ||
      report.waterLevel?.toLowerCase().includes("chest");

    const buses = Math.max(1, Math.ceil(people / 40));
    const boats = isDeepWater ? Math.max(1, Math.ceil(people / 8)) : 0;
    const ambulances = report.hasMedicalEmergency ? Math.max(1, Math.ceil(people / 2)) : 1;
    const rescueTeams = Math.max(1, Math.ceil(people / 10));

    return { buses, boats, ambulances, rescueTeams };
  }

  async function handleMarkDone(id: string) {
    setUpdatingId(id);
    try {
      await onStatusUpdate(id, "RESOLVED");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500/20 text-xs">
              🚨
            </span>
            <span className="text-xs font-bold tracking-[.16em] text-[#39d4b4]">
              CITIZEN DISTRESS SIGNALS & USER PORTAL INBOX
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-[#e6edf7]">
            Citizen Emergency Reports & Live Corridors
          </h2>
          <p className="mt-1 text-xs text-[#9aabc1]">
            Real-time emergency signals sent by citizens via the User Portal. Inspect on map, view suggested rescue dispatch fleet, and mark incidents as done.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300">
              Critical: <b className="text-white">{criticalCount}</b>
            </span>
            <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
              Pending: <b className="text-white">{pendingCount}</b>
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-[#39506e] bg-[#07111f] px-3.5 py-2 text-xs font-semibold text-[#69e8d1] hover:border-[#39d4b4]"
          >
            🔄 Refresh Inbox
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Reports Feed & Live Map Inspection */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Citizen Reports List */}
        <div className="space-y-4 lg:col-span-5">
          {/* Filter Bar */}
          <div className="flex gap-2 rounded-xl border border-[#23354d] bg-[#10233a] p-1.5 text-xs">
            {(["ALL", "PENDING", "CRITICAL", "RESOLVED"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`flex-1 rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                  filter === tab
                    ? "bg-[#39d4b4] text-[#062019] shadow"
                    : "text-[#9aabc1] hover:text-[#e6edf7]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* List Cards */}
          <div className="max-h-[750px] space-y-3 overflow-y-auto pr-1">
            {filteredReports.length === 0 ? (
              <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-8 text-center text-xs text-[#9aabc1]">
                No reports matching filter &ldquo;{filter}&rdquo;.
              </div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = selectedReport?.id === report.id;

                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReportId(report.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-[#39d4b4] bg-[#0b292d] shadow-lg shadow-[#39d4b4]/15 ring-1 ring-[#39d4b4]"
                        : report.severity === "CRITICAL"
                        ? "border-red-500/40 bg-[#171726] hover:border-red-400"
                        : "border-[#23354d] bg-[#10233a] hover:border-[#39506e]"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#23354d]/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#e6edf7]">
                          {report.id}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            report.severity === "CRITICAL"
                              ? "bg-red-500 text-white"
                              : report.severity === "HIGH"
                              ? "bg-amber-500 text-black"
                              : "bg-blue-500 text-white"
                          }`}
                        >
                          {report.severity}
                        </span>
                        {report.hasMedicalEmergency && (
                          <span className="rounded-full bg-red-600/30 border border-red-500/50 px-2 py-0.5 text-[10px] font-bold text-red-200">
                            🚨 MEDICAL
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          report.status === "RESOLVED"
                            ? "text-emerald-400"
                            : report.status === "DISPATCHED"
                            ? "text-[#39d4b4]"
                            : "text-amber-400"
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    {/* Location & People */}
                    <div className="mt-2.5 space-y-1">
                      <p className="font-bold text-sm text-[#e6edf7] flex items-center gap-1.5">
                        <span>📍</span> {report.location.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#9aabc1]">
                        <span>Trapped: <b className="text-[#e6edf7]">{report.peopleCount} people</b></span>
                        <span>•</span>
                        <span>Water: <b className="text-amber-300">{report.waterLevel || "Waterlogged"}</b></span>
                      </div>
                    </div>

                    {/* Distress Message Snippet */}
                    {report.notes && (
                      <p className="mt-2 rounded-lg bg-[#07111f] p-2.5 text-xs text-[#c5d7e9] italic line-clamp-2">
                        &ldquo;{report.notes}&rdquo;
                      </p>
                    )}

                    {/* Quick Action Buttons */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#23354d]/60 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReportId(report.id);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                            isSelected
                              ? "bg-[#39d4b4] text-[#062019]"
                              : "border border-[#39d4b4] text-[#39d4b4] hover:bg-[#39d4b4]/10"
                          }`}
                        >
                          🗺️ View on Map
                        </button>
                        {report.status !== "RESOLVED" && (
                          <button
                            type="button"
                            disabled={updatingId === report.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkDone(report.id);
                            }}
                            className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {updatingId === report.id ? "Saving…" : "✅ Mark as Done"}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendToDecisionTwin(report.location.name, report.peopleCount);
                        }}
                        className="rounded-lg border border-[#39506e] bg-[#07111f] px-2.5 py-1.5 text-[11px] font-semibold text-[#9aabc1] hover:border-[#39d4b4] hover:text-[#e6edf7]"
                      >
                        ⚡ Simulate Twin →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Citizen Inspection, Map & Best Route Suggestion */}
        <div className="space-y-4 lg:col-span-7">
          {selectedReport ? (
            <div className="rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-5 shadow-xl space-y-4">
              {/* Report Header Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23354d] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#39d4b4]">
                      {selectedReport.id}
                    </span>
                    <span className="text-[#39506e]">|</span>
                    <span className="text-xs text-[#9aabc1]">
                      Received {new Date(selectedReport.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h3 className="mt-1 text-xl font-bold text-[#e6edf7]">
                    {selectedReport.location.name}
                  </h3>
                  <p className="font-mono text-xs text-[#69e8d1]">
                    GPS: {selectedReport.location.lat.toFixed(4)}, {selectedReport.location.lng.toFixed(4)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedReport.status !== "RESOLVED" ? (
                    <button
                      type="button"
                      disabled={updatingId === selectedReport.id}
                      onClick={() => handleMarkDone(selectedReport.id)}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {updatingId === selectedReport.id ? "Saving…" : "✅ Mark as Done"}
                    </button>
                  ) : (
                    <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                      ✅ Incident Resolved
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onSendToDecisionTwin(selectedReport.location.name, selectedReport.peopleCount)}
                    className="rounded-xl border border-[#39d4b4] bg-[#39d4b4]/15 px-3.5 py-2 text-xs font-bold text-[#69e8d1] hover:bg-[#39d4b4]/25"
                  >
                    ⚡ Open in Decision Twin
                  </button>
                </div>
              </div>

              {/* Citizen Notes / Emergency Message */}
              {selectedReport.notes && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs">
                  <p className="text-[10px] font-bold tracking-wider text-red-300">
                    EMERGENCY DISTRESS MESSAGE FROM USER:
                  </p>
                  <p className="mt-1 text-sm font-medium text-white leading-relaxed">
                    &ldquo;{selectedReport.notes}&rdquo;
                  </p>
                </div>
              )}

              {/* Specific Suggested Dispatch Directive */}
              {(() => {
                const dispatch = calculateDispatchVehicles(selectedReport);
                return (
                  <div className="rounded-xl border border-[#39d4b4]/40 bg-[#0a272c] p-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🛡️</span>
                      <span className="font-bold tracking-wider text-[#39d4b4] text-xs">
                        RECOMMENDED VEHICLE & RESCUE DISPATCH
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#e6edf7] font-semibold">
                      Deploy from VIT Chennai Base Hub:{" "}
                      <b className="text-[#39d4b4]">{dispatch.buses} Bus{dispatch.buses > 1 ? "es" : ""}</b>
                      {dispatch.boats > 0 && <span> · <b className="text-cyan-300">{dispatch.boats} Rescue Boat{dispatch.boats > 1 ? "s" : ""}</b></span>}
                      <span> · <b className="text-red-300">{dispatch.ambulances} Ambulance{dispatch.ambulances > 1 ? "s" : ""}</b></span>
                      <span> · <b className="text-emerald-300">{dispatch.rescueTeams} Rescue Team{dispatch.rescueTeams > 1 ? "s" : ""}</b></span>
                    </p>
                    <p className="mt-1.5 text-xs text-[#9aabc1]">
                      Suggested Corridor: <b>VIT Chennai Base → Radial Ring Elevated Corridor</b> (bypasses low-lying canal breaches). Target extraction for {selectedReport.peopleCount} trapped citizen(s).
                    </p>
                  </div>
                );
              })()}

              {/* Citizen Survey Details */}
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-[#10233a] p-2.5">
                  <span className="text-[10px] text-[#9aabc1] block">Water Level:</span>
                  <b className="text-[#e6edf7]">{selectedReport.waterLevel || "—"}</b>
                </div>
                <div className="rounded-lg bg-[#10233a] p-2.5">
                  <span className="text-[10px] text-[#9aabc1] block">Current Velocity:</span>
                  <b className="text-[#e6edf7]">{selectedReport.waterMovement || "—"}</b>
                </div>
                <div className="rounded-lg bg-[#10233a] p-2.5">
                  <span className="text-[10px] text-[#9aabc1] block">Trapped People:</span>
                  <b className="text-red-300">{selectedReport.peopleCount} person(s)</b>
                </div>
                <div className="rounded-lg bg-[#10233a] p-2.5">
                  <span className="text-[10px] text-[#9aabc1] block">Medical Urgency:</span>
                  <b className={selectedReport.hasMedicalEmergency ? "text-red-400" : "text-emerald-400"}>
                    {selectedReport.hasMedicalEmergency ? "URGENT MEDICAL" : "Stable"}
                  </b>
                </div>
              </div>

              {/* Embedded Interactive Map focused on citizen */}
              <div className="rounded-xl border border-[#23354d] overflow-hidden pt-1">
                <p className="px-3 py-2 text-[11px] font-bold text-[#69e8d1] bg-[#10233a]">
                  🗺️ LIVE INTERACTIVE MAP · CITIZEN LOCATION & DISPATCH ROUTE
                </p>
                <ChennaiMap
                  floodDestination={selectedReport.location.name}
                  focusedReport={selectedReport}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-12 text-center text-xs text-[#9aabc1]">
              Select a citizen distress report from the left to view coordinates, route, and suggested vehicle dispatch.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
