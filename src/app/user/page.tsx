"use client";

import { useEffect, useState, useId } from "react";
import Link from "next/link";
import { UserMap } from "@/components/user-portal/user-map";
import { RiskQuestionnaire, type RiskAnswers } from "@/components/user-portal/risk-questionnaire";
import type { SafeRouteResult } from "@/app/api/routes/safe/route";
import { CHENNAI_VERIFIED_SHELTERS, EMERGENCY_HELPLINES, type VerifiedShelter, type EmergencyContact } from "@/lib/data-sources/shelters";

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

type SubmittedReportDetails = {
  id: string;
  timestamp: string;
  locationName: string;
  accuracy?: number;
  priority: string;
  status: string;
  peopleCount: number;
  hasMedicalEmergency: boolean;
};

const I18N = {
  en: {
    portalTitle: "GREATER CHENNAI FLOOD SAFETY PORTAL",
    portalSubtitle: "Public Safe Passage & Emergency Corridor Navigation",
    heroPre: "PUBLIC FLOOD EVACUATION & SAFE ROUTE",
    heroTitle: "Find the safest way out of the flood zone.",
    heroDesc: "Uses live rainfall from Open-Meteo, GCC storm-water drains & rivers GIS, and real-time road accessibility. Prioritizes safety over shortest distance.",
    step1Pre: "STEP 1: YOUR LOCATION",
    step1Title: "Verify Your Exact Position",
    detectGpsBtn: "Detect My Exact GPS Location",
    detectingGpsBtn: "Acquiring GPS…",
    selectedOrigin: "Current Selected Origin",
    presets: "Chennai presets:",
    step2Pre: "STEP 2: DESTINATION",
    step2Title: "Where do you need to go?",
    step2Desc: "Select a designated government shelter, safe hospital, or type an address.",
    destPlaceholder: "Type destination, hospital, or shelter in Chennai…",
    setDestBtn: "Set Destination",
    recommendedShelters: "Recommended Safe Shelters & Facilities:",
    calcBtn: "Calculate Safest Route Now",
    calcingBtn: "Calculating Safest Route via GIS & Weather…",
    distressPre: "CITIZEN DISTRESS SIGNAL",
    distressTitle: "Report Urgent Flood / Rescue Emergency",
    distressDesc: "Dispatches your live GPS coordinates directly to the Central Admin Operations Desk.",
    liveNotification: "Live Admin Notification",
    peopleTrappedLabel: "Number of People Trapped / Evacuating",
    medUrgentLabel: "Immediate Medical Emergency (Critical / Life Threat)",
    landmarksLabel: "Location Description or Specific Landmarks (Optional)",
    landmarksPlaceholder: "e.g., Water is entering the first floor. 2 senior citizens inside with medication needs.",
    submitDistressBtn: "🚨 Send Emergency Report to Admin Portal",
    submittingDistressBtn: "Submitting to Central Operations Desk…",
    routeFailureTitle: "⚠️ Corridor Route Unavailable - Emergency Shelters & Hotlines",
    routeFailureDesc: "Primary road navigation could not find an unobstructed corridor or timed out. Head to the nearest designated GCC high-ground relief shelter immediately or call 24x7 flood helplines.",
    callNow: "Call 24x7:",
    openShelters: "Verified GCC Flood Relief Shelters:",
  },
  ta: {
    portalTitle: "பெருநகர சென்னை வெள்ளப் பாதுகாப்பு தளம்",
    portalSubtitle: "பொதுமக்கள் பாதுகாப்பான வழித்தடம் மற்றும் அவசர மீட்பு தகவல்",
    heroPre: "பொதுமக்கள் வெள்ள வெளியேற்றம் & பாதுகாப்பான பாதை",
    heroTitle: "வெள்ளப் பகுதியிலிருந்து பாதுகாப்பாக வெளியேறும் வழியைக் கண்டறியுங்கள்.",
    heroDesc: "வானிலை ஆய்வுத் துறை, சென்னை மாநகராட்சி மழைநீர் வடிகால் & ஆறுகள் ஜி.ஐ.எஸ் மற்றும் சாலை நிலவரத்தை அடிப்படையாகக் கொண்டது. குறைந்த தூரத்தை விட பாதுகாப்பிற்கே முன்னுரிமை.",
    step1Pre: "படி 1: உங்கள் இருப்பிடம்",
    step1Title: "உங்கள் துல்லியமான இடத்தை உறுதிப்படுத்துங்கள்",
    detectGpsBtn: "எனது சரியான GPS இருப்பிடத்தைக் கண்டறி",
    detectingGpsBtn: "GPS பெறப்படுகிறது…",
    selectedOrigin: "தேர்ந்தெடுக்கப்பட்ட இடம்",
    presets: "சென்னை பகுதிகள்:",
    step2Pre: "படி 2: சேருமிடம்",
    step2Title: "நீங்கள் எங்கு செல்ல வேண்டும்?",
    step2Desc: "அரசு நிவாரண முகாம், பாதுகாப்பான மருத்துவமனை அல்லது முகவரியைத் தேர்வு செய்யவும்.",
    destPlaceholder: "சேருமிடம், மருத்துவமனை அல்லது முகாம் பெயரை தட்டச்சு செய்யவும்…",
    setDestBtn: "சேருமிடத்தை உறுதிசெய்",
    recommendedShelters: "பரிந்துரைக்கப்பட்ட பாதுகாப்பான முகாம்கள்:",
    calcBtn: "பாதுகாப்பான பாதையைக் கணக்கிடுக",
    calcingBtn: "ஜி.ஐ.எஸ் & வானிலை மூலம் பாதை கணக்கிடப்படுகிறது…",
    distressPre: "அவசர உதவி கோரிக்கை",
    distressTitle: "வெள்ள மீட்பு அவசர நிலையை பதிவு செய்க",
    distressDesc: "உங்கள் துல்லியமான GPS இருப்பிடத்தை மத்திய கட்டுப்பாட்டு அறைக்கு உடனடியாக அனுப்புகிறது.",
    liveNotification: "நேரலை அறிவிப்பு",
    peopleTrappedLabel: "சிக்கியுள்ள / வெளியேறும் நபர்களின் எண்ணிக்கை",
    medUrgentLabel: "அவசர மருத்துவ உதவி தேவை (உயிர் ஆபத்து / முதலுதவி)",
    landmarksLabel: "இருப்பிட விவரம் அல்லது அடையாளங்கள் (விருப்பத்தேர்வு)",
    landmarksPlaceholder: "எ.கா: தரைத்தளத்தில் தண்ணீர் புகுந்துவிட்டது. 2 முதியவர்கள் உள்ளனர்.",
    submitDistressBtn: "🚨 கட்டுப்பாட்டு அறைக்கு அவசர அழைப்பு அனுப்புக",
    submittingDistressBtn: "அவசர அழைப்பு அனுப்பப்படுகிறது…",
    routeFailureTitle: "⚠️ சாலைப் பாதை கிடைக்கவில்லை - அவசர நிவாரண முகாம்கள் மற்றும் தொலைபேசிகள்",
    routeFailureDesc: "வெள்ளம் அல்லது தடை காரணமாக முக்கிய சாலை வழிகள் கிடைக்கவில்லை. அருகில் உள்ள பாதுகாப்பான சென்னை மாநகராட்சி நிவாரண முகாமை அணுகவும் அல்லது அவசர எண்களைத் தொடர்பு கொள்ளவும்.",
    callNow: "அவசர உதவி எண்கள்:",
    openShelters: "அங்கீகரிக்கப்பட்ட மாநகராட்சி வெள்ள நிவாரண முகாம்கள்:",
  },
};

export default function UserPortalPage() {
  const reactId = useId();
  const [sessionId, setSessionId] = useState("");
  const [lang, setLang] = useState<"en" | "ta">("en");
  const t = I18N[lang];

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

  // 5. Emergency Incident Reporting State
  const [reporting, setReporting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<SubmittedReportDetails | null>(null);
  const [reportNotes, setReportNotes] = useState("");
  const [peopleTrapped, setPeopleTrapped] = useState(1);
  const [isMedicalUrgent, setIsMedicalUrgent] = useState(false);

  // Safety timeouts to prevent hanging buttons
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (locating) {
      timer = setTimeout(() => {
        setLocating(false);
        setLocationStatus("GPS acquisition timed out after 10s. Switched to preset fallback.");
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [locating]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (calculating) {
      timer = setTimeout(() => {
        setCalculating(false);
        setRouteError("Route calculation timed out. Showing nearest relief shelters and emergency contacts.");
      }, 12000);
    }
    return () => clearTimeout(timer);
  }, [calculating]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (reporting) {
      timer = setTimeout(() => {
        setReporting(false);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [reporting]);

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
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
      if (!res.ok) {
        throw new Error(data.error || "Could not evaluate safe route.");
      }
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
          routeGeometry: routeResult?.recommendedRoute.geometry?.coordinates,
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
          notes: reportNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit report.");
      
      setSubmittedReport({
        id: data.id,
        timestamp: new Date().toLocaleTimeString(),
        locationName: userLocation.name,
        accuracy: userLocation.accuracy,
        priority: isMedicalUrgent ? "CRITICAL (P1)" : peopleTrapped >= 5 ? "HIGH (P2)" : "NORMAL (P3)",
        status: "ACTIVE · AWAITING DISPATCH AUTHORIZATION",
        peopleCount: peopleTrapped,
        hasMedicalEmergency: isMedicalUrgent,
      });
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
        {/* Public Citizen Navigation Header */}
        <nav aria-label="Main Navigation" className="flex flex-wrap items-center justify-between gap-4 border-b border-[#23354d] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#39d4b4]/20 text-lg">
              🛡️
            </div>
            <div>
              <span className="text-sm font-bold tracking-wide text-[#e6edf7] block">
                {t.portalTitle}
              </span>
              <span className="text-[11px] text-[#39d4b4] font-medium">
                {t.portalSubtitle}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex rounded-lg border border-[#39506e] bg-[#10233a] p-1 text-xs">
              <button
                type="button"
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                className={`rounded px-2.5 py-1 font-semibold transition ${
                  lang === "en" ? "bg-[#39d4b4] text-[#062019]" : "text-[#9aabc1] hover:text-white"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang("ta")}
                aria-pressed={lang === "ta"}
                className={`rounded px-2.5 py-1 font-semibold transition ${
                  lang === "ta" ? "bg-[#39d4b4] text-[#062019]" : "text-[#9aabc1] hover:text-white"
                }`}
              >
                தமிழ்
              </button>
            </div>

            <span className="flex items-center gap-1.5 rounded-full border border-[#39506e] bg-[#10233a] px-3.5 py-1.5 font-mono text-xs text-[#69e8d1]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Session ID: {sessionId || "Initializing…"}
            </span>
          </div>
        </nav>

        {/* Hero Section */}
        <div>
          <p className="text-xs font-semibold tracking-[.18em] text-[#39d4b4]">{t.heroPre}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {t.heroTitle}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9aabc1]">
            {t.heroDesc}
          </p>
        </div>

        {/* Section 1: Exact GPS Position */}
        <section aria-labelledby="step1-heading" className="rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[.14em] text-[#39d4b4]">{t.step1Pre}</p>
              <h2 id="step1-heading" className="mt-1 text-xl font-semibold text-[#e6edf7]">{t.step1Title}</h2>
            </div>
            <button
              type="button"
              onClick={detectGPS}
              disabled={locating}
              aria-busy={locating}
              className="flex items-center gap-2 rounded-xl bg-[#39d4b4] px-4 py-2.5 text-sm font-semibold text-[#062019] shadow-lg shadow-[#39d4b4]/20 transition-all hover:opacity-95 disabled:opacity-50"
            >
              <span className="text-base" aria-hidden="true">📍</span>
              {locating ? t.detectingGpsBtn : t.detectGpsBtn}
            </button>
          </div>

          {locationStatus && (
            <p role="status" aria-live="polite" className="mt-3 rounded-lg border border-[#39506e] bg-[#07111f] p-3 text-xs text-[#b6c4d5]">
              {locationStatus}
            </p>
          )}

          {/* Current GPS Card */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#39506e] bg-[#07111f] p-4">
            <div>
              <p className="text-xs font-medium text-[#9aabc1]">{t.selectedOrigin}</p>
              <p className="mt-0.5 text-sm font-semibold text-[#e6edf7]">{userLocation.name}</p>
              <p className="mt-0.5 font-mono text-xs text-[#39d4b4]">
                Lat: {userLocation.lat.toFixed(5)} · Lng: {userLocation.lng.toFixed(5)}
                {userLocation.accuracy && ` · GPS Accuracy: ±${Math.round(userLocation.accuracy)}m`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#9aabc1]">{t.presets}</span>
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
        <section aria-labelledby="step2-heading" className="rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[.14em] text-[#39d4b4]">{t.step2Pre}</p>
          <h2 id="step2-heading" className="mt-1 text-xl font-semibold text-[#e6edf7]">{t.step2Title}</h2>
          <p className="mt-1 text-xs text-[#9aabc1]">
            {t.step2Desc}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              id="destination-search-input"
              aria-label="Destination search"
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              placeholder={t.destPlaceholder}
              className="min-w-[280px] flex-1 rounded-xl border border-[#39506e] bg-[#07111f] px-4 py-2.5 text-sm outline-none focus:border-[#39d4b4]"
            />
            <button
              type="button"
              onClick={() => resolveDestination(destinationInput)}
              className="rounded-xl border border-[#39d4b4] px-4 py-2.5 text-sm font-semibold text-[#69e8d1] hover:bg-[#39d4b4]/10"
            >
              {t.setDestBtn}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="self-center text-xs text-[#9aabc1]">{t.recommendedShelters}</span>
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
        <RiskQuestionnaire answers={answers} onChange={setAnswers} lang={lang} />

        {/* Section 4: Trigger Route Analysis */}
        <div className="flex flex-col items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={calculateSafeRoute}
            disabled={calculating}
            aria-busy={calculating}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] px-8 py-4 text-base font-bold text-[#062019] shadow-xl shadow-[#39d4b4]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xl" aria-hidden="true">🛡️</span>
            {calculating ? t.calcingBtn : t.calcBtn}
          </button>
          
          {/* Route Failure Fallback UI */}
          {routeError && (
            <div role="alert" className="w-full rounded-2xl border-2 border-red-500/50 bg-[#1e1014] p-5 space-y-4 text-xs shadow-xl">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <span className="text-xl">⚠️</span>
                <h3>{t.routeFailureTitle}</h3>
              </div>
              <p className="text-red-200">
                {routeError}. {t.routeFailureDesc}
              </p>

              {/* 24x7 Helplines Grid */}
              <div className="space-y-2 pt-1">
                <p className="font-bold text-white tracking-wider">{t.callNow}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EMERGENCY_HELPLINES.map((h, i) => (
                    <a
                      key={i}
                      href={`tel:${h.number.replace(/\D/g, "")}`}
                      className="flex flex-col justify-between rounded-xl border border-red-500/30 bg-[#2d1217] p-3 hover:border-red-400 transition"
                    >
                      <span className="text-[10px] text-[#e0b0b8]">{h.department}</span>
                      <b className="mt-1 text-sm font-mono text-white">{h.number}</b>
                      <span className="text-[9px] text-emerald-400 font-semibold mt-1">📞 Tap to Dial</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Nearby Relief Shelters Grid */}
              <div className="space-y-2 pt-2 border-t border-red-500/30">
                <p className="font-bold text-white tracking-wider">{t.openShelters}</p>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {CHENNAI_VERIFIED_SHELTERS.slice(0, 3).map((s, i) => (
                    <div key={i} className="rounded-xl border border-[#39506e] bg-[#0f1d2e] p-3 text-xs space-y-1">
                      <p className="font-bold text-[#69e8d1]">{s.name}</p>
                      <p className="text-[11px] text-[#9aabc1]">{s.address}</p>
                      <div className="flex justify-between text-[10px] text-emerald-300 pt-1">
                        <span>Capacity: {s.capacityPeople}</span>
                        <a href={`tel:${s.phone}`} className="underline font-bold text-cyan-300">
                          📞 {s.phone}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Route Safety Results */}
        {routeResult && (
          <section aria-label="Route Safety Results" className="space-y-6 rounded-2xl border border-[#39d4b4]/40 bg-[#0b292d] p-6 shadow-2xl">
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

            {/* Safety Warnings */}
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

        {/* Section 6: Emergency Incident Report Form */}
        <section aria-labelledby="distress-form-heading" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[.14em] text-red-400">{t.distressPre}</p>
              <h3 id="distress-form-heading" className="mt-1 text-xl font-bold text-[#e6edf7]">
                {t.distressTitle}
              </h3>
              <p className="mt-1 text-xs text-[#9aabc1]">
                {t.distressDesc}
              </p>
            </div>
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
              {t.liveNotification}
            </span>
          </div>

          {/* Emergency Report Confirmation Card */}
          {submittedReport ? (
            <div role="status" aria-live="polite" className="mt-6 rounded-2xl border-2 border-emerald-500/60 bg-[#0b2924] p-6 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/30 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">✅</span>
                  <div>
                    <h4 className="text-base font-bold text-emerald-300">EMERGENCY REPORT RECEIVED & CONFIRMED</h4>
                    <p className="text-xs text-[#9aabc1]">Greater Chennai Flood Operations Desk has logged your distress incident.</p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-emerald-200">
                  ID: {submittedReport.id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-[#061917] p-3 border border-[#16443c]">
                  <span className="text-[10px] text-[#86ab9f] block">Submission Timestamp</span>
                  <b className="text-white font-mono text-sm">{submittedReport.timestamp}</b>
                </div>
                <div className="rounded-xl bg-[#061917] p-3 border border-[#16443c]">
                  <span className="text-[10px] text-[#86ab9f] block">Location Accuracy</span>
                  <b className="text-white text-xs block truncate">{submittedReport.locationName}</b>
                  <span className="text-[#39d4b4] text-[10px]">
                    {submittedReport.accuracy ? `Accuracy: ±${Math.round(submittedReport.accuracy)}m` : "Coordinate verified"}
                  </span>
                </div>
                <div className="rounded-xl bg-[#061917] p-3 border border-[#16443c]">
                  <span className="text-[10px] text-[#86ab9f] block">Priority Level</span>
                  <b className={`text-xs font-bold ${submittedReport.hasMedicalEmergency ? "text-red-400" : "text-amber-300"}`}>
                    {submittedReport.priority}
                  </b>
                </div>
                <div className="rounded-xl bg-[#061917] p-3 border border-[#16443c]">
                  <span className="text-[10px] text-[#86ab9f] block">Response Status</span>
                  <b className="text-emerald-400 font-bold text-xs">{submittedReport.status}</b>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                <p className="text-[#a5c7be]">
                  Trapped Citizens: <b>{submittedReport.peopleCount} person(s)</b> {submittedReport.hasMedicalEmergency && "· 🚨 Critical Medical"}
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedReport(null)}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                >
                  + Submit Another Report
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="people-trapped-input" className="block text-xs text-[#9aabc1]">
                    {t.peopleTrappedLabel}
                  </label>
                  <input
                    id="people-trapped-input"
                    type="number"
                    min={1}
                    max={50}
                    value={peopleTrapped}
                    onChange={(e) => setPeopleTrapped(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#39506e] bg-[#07111f] p-2.5 text-sm text-[#e6edf7] focus:border-[#39d4b4] focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <input
                    type="checkbox"
                    id="med-urgent-checkbox"
                    checked={isMedicalUrgent}
                    onChange={(e) => setIsMedicalUrgent(e.target.checked)}
                    className="h-4 w-4 accent-red-500"
                  />
                  <label htmlFor="med-urgent-checkbox" className="text-xs text-[#e6edf7] font-medium cursor-pointer">
                    {t.medUrgentLabel}
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="emergency-notes-textarea" className="block text-xs text-[#9aabc1]">
                  {t.landmarksLabel}
                </label>
                <textarea
                  id="emergency-notes-textarea"
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder={t.landmarksPlaceholder}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[#39506e] bg-[#07111f] p-3 text-sm text-[#e6edf7] outline-none focus:border-red-400"
                />
              </div>

              <button
                type="button"
                onClick={submitReport}
                disabled={reporting}
                aria-busy={reporting}
                className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-500 disabled:opacity-50"
              >
                {reporting ? t.submittingDistressBtn : t.submitDistressBtn}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
