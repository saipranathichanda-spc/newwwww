"use client";

import { useEffect, useState, useId } from "react";
import Link from "next/link";
import { UserMap } from "@/components/user-portal/user-map";
import { RiskQuestionnaire, type RiskAnswers } from "@/components/user-portal/risk-questionnaire";
import type { SafeRouteResult } from "@/app/api/routes/safe/route";

type GPSLocation = {
  name: string;
  lat: number;
  lng: number;
  accuracy?: number;
};

const CHENNAI_PRESETS: GPSLocation[] = [
  { name: "Velachery Residential Area", lat: 12.9815, lng: 80.218, accuracy: 12 },
  { name: "VIT Chennai Campus Base", lat: 12.8406, lng: 80.1534, accuracy: 8 },
  { name: "Guindy Industrial Hub", lat: 13.0067, lng: 80.2026, accuracy: 15 },
  { name: "Tambaram East Railway Zone", lat: 12.9249, lng: 80.1000, accuracy: 20 },
  { name: "T. Nagar Commercial Ward", lat: 13.0418, lng: 80.2341, accuracy: 10 },
];

const DESTINATION_PRESETS = [
  { name: "Chennai Central Railway Station (Elevated Hub)", lat: 13.0827, lng: 80.2757, type: "Transit" },
  { name: "GCC Flood Relief Shelter - Velachery Community Hall", lat: 12.9780, lng: 80.2220, type: "Shelter" },
  { name: "Rajiv Gandhi Government General Hospital (RGGGH)", lat: 13.0789, lng: 80.2785, type: "Hospital" },
  { name: "Tambaram High Ground Evacuation Center", lat: 12.9320, lng: 80.1180, type: "Shelter" },
  { name: "Gleneagles Health City Emergency Center", lat: 12.8980, lng: 80.1915, type: "Hospital" },
];

export default function UserPortalPage() {
  const reactId = useId();
  const [sessionId, setSessionId] = useState("");

  // Independent user session isolation
  useEffect(() => {
    let sid = sessionStorage.getItem("astra_user_session");
    if (!sid) {
      sid = `USR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      sessionStorage.setItem("astra_user_session", sid);
    }
    setSessionId(sid);
  }, []);

  // 1. Current GPS Location State
  const [userLocation, setUserLocation] = useState<GPSLocation>(CHENNAI_PRESETS[0]);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>("");

  // 2. Destination Selection
  const [destinationInput, setDestinationInput] = useState(DESTINATION_PRESETS[0].name);
  const [destination, setDestination] = useState<GPSLocation>(DESTINATION_PRESETS[0]);

  // 3. Risk Questionnaire Answers
  const [answers, setAnswers] = useState<RiskAnswers>({
    waterLevel: "Knee level (15-50 cm)",
    waterMovement: "Slowly flowing",
    mobility: "Four-wheeler / SUV",
    vulnerability: "None",
    assistance: "Planning route",
  });

  // 4. Safe Route Calculation State
  const [calculating, setCalculating] = useState(false);
  const [routeResult, setRouteResult] = useState<SafeRouteResult | null>(null);
  const [routeError, setRouteError] = useState("");

  // 5. Emergency Incident Reporting Modal
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState("");
  const [peopleTrapped, setPeopleTrapped] = useState(1);
  const [isMedicalUrgent, setIsMedicalUrgent] = useState(false);

  // Detect real GPS location using HTML5 Geolocation API
  function detectGPS() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("Geolocation is not supported by your browser. Please choose a preset below.");
      return;
    }

    setLocating(true);
    setLocationStatus("Requesting satellite GPS coordinates…");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocationStatus(`GPS acquired (±${Math.round(accuracy)}m). Resolving local address…`);

        let resolvedName = `GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${latitude},${longitude}`,
            { headers: { "User-Agent": "Astra-Chennai-UserPortal/1.0" } }
          );
          if (res.ok) {
            const data = await res.json();
            if (data[0]?.display_name) {
              resolvedName = data[0].display_name.split(",").slice(0, 3).join(",");
            }
          }
        } catch {
          // fallback to coordinates
        }

        setUserLocation({
          name: resolvedName,
          lat: latitude,
          lng: longitude,
          accuracy,
        });
        setLocationStatus(`✅ Locked onto exact GPS position: ${resolvedName}`);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setLocationStatus("GPS permission denied by user. Select a location preset below.");
        } else if (err.code === 2) {
          setLocationStatus("GPS signal unavailable. Select a location preset below.");
        } else {
          setLocationStatus("GPS request timed out. Select a location preset below.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Handle custom destination search
  async function resolveDestination(name: string) {
    setDestinationInput(name);
    const preset = DESTINATION_PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (preset) {
      setDestination(preset);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(name + ", Chennai, Tamil Nadu")}`,
        { headers: { "User-Agent": "Astra-Chennai-UserPortal/1.0" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data[0]) {
          setDestination({
            name: data[0].display_name.split(",").slice(0, 3).join(","),
            lat: Number(data[0].lat),
            lng: Number(data[0].lon),
          });
          return;
        }
      }
    } catch {
      // fallback
    }

    // Default fallback
    setDestination({
      name: name,
      lat: 13.0827,
      lng: 80.2757,
    });
  }

  // Calculate Safe Route
  async function calculateSafeRoute() {
    setCalculating(true);
    setRouteError("");
    try {
      const res = await fetch("/api/routes/safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: userLocation,
          destination,
          answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not evaluate safe route.");
      setRouteResult(data as SafeRouteResult);
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : "Route analysis failed.");
    } finally {
      setCalculating(false);
    }
  }

  // Submit emergency report to central admin store with full route & survey context
  async function submitReport() {
    setReporting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          location: userLocation,
          destination,
          distanceKm: routeResult?.recommendedRoute.distanceKm,
          travelMinutes: routeResult?.recommendedRoute.durationMinutes,
          riskScore: routeResult?.recommendedRoute.safetyScore,
          routeSafetyStatus: routeResult?.recommendedRoute.safetyStatus,
          routeGeometry: routeResult?.recommendedRoute.geometry.coordinates,
          hazards: routeResult?.recommendedRoute.blockedOrFloodedPoints,
          highRiskAreas: routeResult?.recommendedRoute.highRiskAreasToAvoid,
          nearbyHospitals: routeResult?.nearbyHospitals?.map((h) => ({
            name: h.name,
            distanceKm: h.distanceKm,
            travelMinutes: h.travelMinutes,
          })),
          answers,
          waterLevel: answers.waterLevel,
          waterMovement: answers.waterMovement,
          peopleCount: peopleTrapped,
          needsEvacuation: true,
          hasMedicalEmergency: isMedicalUrgent,
          notes: reportNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit report.");
      setReportSuccess(`Emergency report submitted successfully (ID: ${data.id}). Central Flood Monitoring & Rescue Desk has received your live GPS coordinates, destination, route status, and questionnaire.`);
      setReportNotes("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not submit report.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-8 text-[#e6edf7] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Public Citizen Navigation Header (Strictly Isolated from Admin) */}
        <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-[#23354d] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#39d4b4]/20 text-lg">
              🛡️
            </div>
            <div>
              <span className="text-sm font-bold tracking-wide text-[#e6edf7] block">
                GREATER CHENNAI FLOOD SAFETY PORTAL
              </span>
              <span className="text-[11px] text-[#39d4b4] font-medium">
                Public Safe Passage & Emergency Corridor Navigation
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-[#39506e] bg-[#10233a] px-3.5 py-1.5 font-mono text-xs text-[#69e8d1]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Session ID: {sessionId || "Initializing…"}
            </span>
          </div>
        </nav>

        {/* Hero Section */}
        <div>
          <p className="text-xs font-semibold tracking-[.18em] text-[#39d4b4]">PUBLIC FLOOD EVACUATION & SAFE ROUTE</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Find the safest way out of the flood zone.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9aabc1]">
            Uses live rainfall from Open-Meteo, GCC storm-water drains & rivers GIS, and real-time road accessibility.
            Prioritizes <b>safety</b> over shortest distance.
          </p>
        </div>

        {/* Section 1: Exact GPS Position */}
        <section className="rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[.14em] text-[#39d4b4]">STEP 1: YOUR LOCATION</p>
              <h2 className="mt-1 text-xl font-semibold text-[#e6edf7]">Verify Your Exact Position</h2>
            </div>
            <button
              type="button"
              onClick={detectGPS}
              disabled={locating}
              className="flex items-center gap-2 rounded-xl bg-[#39d4b4] px-4 py-2.5 text-sm font-semibold text-[#062019] shadow-lg shadow-[#39d4b4]/20 transition-all hover:opacity-95 disabled:opacity-50"
            >
              <span className="text-base">📍</span>
              {locating ? "Acquiring GPS…" : "Detect My Exact GPS Location"}
            </button>
          </div>

          {locationStatus && (
            <p className="mt-3 rounded-lg border border-[#39506e] bg-[#07111f] p-3 text-xs text-[#b6c4d5]">
              {locationStatus}
            </p>
          )}

          {/* Current GPS Card */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#39506e] bg-[#07111f] p-4">
            <div>
              <p className="text-xs font-medium text-[#9aabc1]">Current Selected Origin</p>
              <p className="mt-0.5 text-sm font-semibold text-[#e6edf7]">{userLocation.name}</p>
              <p className="mt-0.5 font-mono text-xs text-[#39d4b4]">
                Lat: {userLocation.lat.toFixed(5)} · Lng: {userLocation.lng.toFixed(5)}
                {userLocation.accuracy && ` · GPS Accuracy: ±${Math.round(userLocation.accuracy)}m`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#9aabc1]">Chennai presets:</span>
              {CHENNAI_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setUserLocation(preset);
                    setLocationStatus(`Selected preset: ${preset.name}`);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                    userLocation.name === preset.name
                      ? "border-[#39d4b4] bg-[#39d4b4]/20 text-[#69e8d1]"
                      : "border-[#39506e] bg-[#10233a] text-[#9aabc1] hover:border-[#39d4b4]/50"
                  }`}
                >
                  {preset.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Destination Selection */}
        <section className="rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[.14em] text-[#39d4b4]">STEP 2: DESTINATION</p>
          <h2 className="mt-1 text-xl font-semibold text-[#e6edf7]">Where do you need to go?</h2>
          <p className="mt-1 text-xs text-[#9aabc1]">
            Select a designated government shelter, safe hospital, or type an address.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              placeholder="Type destination, hospital, or shelter in Chennai…"
              className="min-w-[280px] flex-1 rounded-xl border border-[#39506e] bg-[#07111f] px-4 py-2.5 text-sm outline-none focus:border-[#39d4b4]"
            />
            <button
              type="button"
              onClick={() => resolveDestination(destinationInput)}
              className="rounded-xl border border-[#39d4b4] px-4 py-2.5 text-sm font-semibold text-[#69e8d1] hover:bg-[#39d4b4]/10"
            >
              Set Destination
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="self-center text-xs text-[#9aabc1]">Recommended Safe Shelters & Facilities:</span>
            {DESTINATION_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setDestination(p);
                  setDestinationInput(p.name);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  destination.name === p.name
                    ? "border-[#ff7d7d] bg-[#ff7d7d]/20 text-[#ffb4b4]"
                    : "border-[#39506e] bg-[#07111f] text-[#b6c4d5] hover:border-[#ff7d7d]/60"
                }`}
              >
                <span className="mr-1 opacity-70">[{p.type}]</span> {p.name.split(" - ")[0].split(" (")[0]}
              </button>
            ))}
          </div>
        </section>

        {/* Section 3: Risk Assessment Questionnaire */}
        <RiskQuestionnaire answers={answers} onChange={setAnswers} />

        {/* Section 4: Trigger Route Analysis */}
        <div className="flex flex-col items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={calculateSafeRoute}
            disabled={calculating}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] px-8 py-4 text-base font-bold text-[#062019] shadow-xl shadow-[#39d4b4]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xl">🛡️</span>
            {calculating ? "Calculating Safest Route via GIS & Weather…" : "Calculate Safest Route Now"}
          </button>
          {routeError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
              {routeError}
            </p>
          )}
        </div>

        {/* Section 5: Route Safety Results */}
        {routeResult && (
          <section className="space-y-6 rounded-2xl border border-[#39d4b4]/40 bg-[#0b292d] p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#39d4b4]/20 pb-4">
              <div>
                <p className="text-xs font-semibold tracking-[.14em] text-[#69e8d1]">ROUTE SAFETY RESULT</p>
                <h2 className="mt-1 text-2xl font-bold text-[#e6edf7]">
                  {userLocation.name.split(",")[0]} → {destination.name.split(",")[0]}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                    routeResult.recommendedRoute.safetyStatus === "SAFE_CORRIDOR"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : routeResult.recommendedRoute.safetyStatus === "MODERATE_RISK"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-red-500/20 text-red-300 border border-red-500/40"
                  }`}
                >
                  STATUS: {routeResult.recommendedRoute.safetyStatus.replace("_", " ")}
                </span>
                <span className="rounded-full bg-[#10233a] px-3 py-1.5 text-xs text-[#9aabc1]">
                  Risk Index: <b>{routeResult.recommendedRoute.safetyScore}/100</b>
                </span>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-3.5">
                <p className="text-xs text-[#9aabc1]">Estimated Travel Time</p>
                <p className="mt-1 text-xl font-bold text-[#e6edf7]">
                  ~{routeResult.recommendedRoute.durationMinutes} min
                </p>
              </div>
              <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-3.5">
                <p className="text-xs text-[#9aabc1]">Total Distance</p>
                <p className="mt-1 text-xl font-bold text-[#e6edf7]">
                  {routeResult.recommendedRoute.distanceKm} km
                </p>
              </div>
              <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-3.5">
                <p className="text-xs text-[#9aabc1]">Current Rainfall</p>
                <p className="mt-1 text-xl font-bold text-[#e6edf7]">
                  {routeResult.weather?.rainfallMm ?? 0} mm/h
                </p>
              </div>
              <div className="rounded-xl border border-[#23354d] bg-[#10233a] p-3.5">
                <p className="text-xs text-[#9aabc1]">GCC Storm Drains Monitored</p>
                <p className="mt-1 text-xl font-bold text-[#e6edf7]">
                  {routeResult.gisDrainsCount} drains
                </p>
              </div>
            </div>

            {/* Route Selection Rationale */}
            <div className="rounded-xl border border-[#39d4b4]/30 bg-[#07111f]/70 p-4">
              <p className="text-xs font-semibold text-[#69e8d1]">WHY THIS ROUTE WAS RECOMMENDED</p>
              <p className="mt-1.5 text-sm leading-6 text-[#d9e8f5]">
                {routeResult.recommendedRoute.rationale}
              </p>
            </div>

            {/* Map View */}
            <UserMap
              userLocation={userLocation}
              destination={destination}
              routes={routeResult.allRoutes}
              recommendedRoute={routeResult.recommendedRoute}
              hospitals={routeResult.nearbyHospitals}
            />

            {/* Route Hazard / Flooded Points */}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-[#23354d] bg-[#10233a] p-4">
                <p className="text-xs font-semibold tracking-wider text-amber-400">
                  ⚠️ FLOODED OR BLOCKED ROADS ALONG ROUTE
                </p>
                {routeResult.recommendedRoute.blockedOrFloodedPoints.length > 0 ? (
                  <ul className="space-y-2 pt-1 text-xs">
                    {routeResult.recommendedRoute.blockedOrFloodedPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-lg bg-[#07111f] p-2.5">
                        <span className="text-amber-400 font-bold">KM {pt.kmMarker}:</span>
                        <span className="text-[#b6c4d5]">{pt.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#9aabc1]">No severe blocked bottlenecks detected on this corridor.</p>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-[#23354d] bg-[#10233a] p-4">
                <p className="text-xs font-semibold tracking-wider text-red-400">
                  🛑 HIGH-RISK AREAS TO AVOID
                </p>
                <ul className="space-y-2 pt-1 text-xs">
                  {routeResult.recommendedRoute.highRiskAreasToAvoid.map((area, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg bg-[#07111f] p-2.5 text-[#b6c4d5]">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Nearby Emergency Facilities */}
            <div className="space-y-3 rounded-xl border border-[#23354d] bg-[#10233a] p-4">
              <p className="text-xs font-semibold tracking-wider text-[#39d4b4]">
                🏥 NEARBY HOSPITALS & EMERGENCY MEDICAL FACILITIES
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {routeResult.nearbyHospitals.map((h, idx) => (
                  <div key={idx} className="rounded-lg border border-[#39506e]/40 bg-[#07111f] p-3 text-xs">
                    <p className="font-semibold text-[#e6edf7]">{h.name}</p>
                    <p className="mt-1 text-[#39d4b4]">
                      {h.distanceKm} km · ~{h.travelMinutes} min
                    </p>
                    <p className="mt-1 text-[11px] text-[#9aabc1]">{h.address ?? "Address on map"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety Warnings & Emergency Helplines */}
            <div className="space-y-2 rounded-xl border border-[#39506e] bg-[#07111f] p-4 text-xs">
              <p className="font-bold text-[#e6edf7]">IMPORTANT SAFETY INSTRUCTIONS</p>
              <ul className="list-disc space-y-1.5 pl-4 text-[#9aabc1]">
                {routeResult.safetyWarnings.map((warning, i) => (
                  <li key={i} className="leading-5">{warning}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Section 6: Emergency Incident Report Form (Linked to Central Admin Store) */}
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[.14em] text-red-400">CITIZEN DISTRESS SIGNAL</p>
              <h3 className="mt-1 text-xl font-bold text-[#e6edf7]">
                Report Urgent Flood / Rescue Emergency
              </h3>
              <p className="mt-1 text-xs text-[#9aabc1]">
                Dispatches your live GPS coordinates directly to the Central Admin Operations Desk.
              </p>
            </div>
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
              Live Admin Notification
            </span>
          </div>

          {reportSuccess ? (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {reportSuccess}
              <button
                type="button"
                onClick={() => setReportSuccess(null)}
                className="mt-2 block text-xs underline text-emerald-400"
              >
                Submit another report
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[#9aabc1]">Number of People Trapped / Evacuating</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={peopleTrapped}
                    onChange={(e) => setPeopleTrapped(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#39506e] bg-[#07111f] p-2.5 text-sm text-[#e6edf7]"
                  />
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <input
                    type="checkbox"
                    id="med-urgent"
                    checked={isMedicalUrgent}
                    onChange={(e) => setIsMedicalUrgent(e.target.checked)}
                    className="h-4 w-4 accent-red-500"
                  />
                  <label htmlFor="med-urgent" className="text-xs text-[#e6edf7] font-medium cursor-pointer">
                    Immediate Medical Emergency (Critical / Life Threat)
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#9aabc1]">Location Description or Specific Landmarks</label>
                <textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!reporting && reportNotes.trim()) submitReport();
                    }
                  }}
                  placeholder="e.g., Water is entering the first floor. 2 senior citizens inside with medication needs. Press Enter to submit."
                  className="mt-1 min-h-20 w-full rounded-lg border border-[#39506e] bg-[#07111f] p-3 text-sm text-[#e6edf7] outline-none focus:border-red-400"
                />
              </div>

              <button
                type="button"
                onClick={submitReport}
                disabled={reporting}
                className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-500 disabled:opacity-50"
              >
                {reporting ? "Submitting to Central Operations Desk…" : "🚨 Send Emergency Report to Admin Portal"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
