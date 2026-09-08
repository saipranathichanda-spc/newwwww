import { NextRequest, NextResponse } from "next/server";
import { getAlternativeRoutes, type RouteOption } from "@/lib/data-sources/routing";
import { getBridgeFeaturesInArea, getBuildingsInArea, getRiversInArea, getRoadsInArea, getStormWaterDrainsInArea, type GeographicArea } from "@/lib/data-sources/gccGIS";
import { searchNearbyHospitals } from "@/lib/data-sources/hospitals";
import { getCurrentWeather } from "@/lib/data-sources/weather";
import { getHistoricalFloodContext } from "@/lib/data-sources/historical";
import {
  parseScenario,
  createDefaultDecisionTwin,
  simulateDeterministicDecisionTwin,
  simulateScenario,
  calculateHaversineDistanceKm,
  KNOWN_PLACES,
  type DecisionTwin,
  type SimulationResult
} from "@/lib/decision-twin";

async function fetchNominatim(query: string, useViewbox = true) {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    q: query
  });
  if (useViewbox) {
    params.set("viewbox", "79.8,13.4,80.4,12.6");
    params.set("bounded", "0");
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Astra-Chennai-Decision-Twin/1.0"
    },
    next: { revalidate: 3600 }
  });

  if (!response.ok) return null;
  const matches = (await response.json()) as Array<{ display_name?: string; lat: string; lon: string }>;
  const match = matches[0];
  return match
    ? {
        name: match.display_name ?? query,
        lat: Number(match.lat),
        lng: Number(match.lon),
        source: "OpenStreetMap / Nominatim",
        status: "RESOLVED" as const
      }
    : null;
}

async function resolvePlace(rawName: string) {
  const cleanName = rawName
    .replace(/^(?:severe\s+flood\s+in|flood\s+in|emergency\s+in|in|at)\s+/i, "")
    .replace(/(?:,\s*chennai)?(?:,\s*tamil\s*nadu)?$/i, "")
    .trim();

  // Tier 1: Query with Greater Chennai Metropolitan viewbox bounding box
  const t1 = await fetchNominatim(`${cleanName}, Tamil Nadu`, true).catch(() => null);
  if (t1) return t1;

  // Tier 2: Explicit Chennai query
  const t2 = await fetchNominatim(`${cleanName}, Chennai, Tamil Nadu`, false).catch(() => null);
  if (t2) return t2;

  // Tier 3: Broader Tamil Nadu query
  const t3 = await fetchNominatim(`${cleanName}, Tamil Nadu, India`, false).catch(() => null);
  if (t3) return t3;

  // Tier 4: Dictionary lookup fallback if Nominatim had rate limiting or no connection
  const lower = cleanName.toLowerCase();
  for (const [key, place] of Object.entries(KNOWN_PLACES)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(lower)) {
      return {
        name: place.label,
        lat: place.lat,
        lng: place.lng,
        source: "KNOWN_PLACE_RESOLUTION",
        status: "RESOLVED" as const
      };
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      place?: string;
      mode?: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC";
      population?: number;
      buses?: number;
      boats?: number;
      ambulances?: number;
      rescueTeams?: number;
      budget?: number;
      priorities?: {
        safety?: number;
        speed?: number;
        cost?: number;
        coverage?: number;
        reliability?: number;
      };
    };

    const promptText = body.prompt?.trim() || "Severe flood in Velachery. Evacuate 3500 people with 10 buses, 3 rescue boats and 5 ambulances.";
    const parsed = parseScenario(promptText);

    const targetPlace = body.place?.trim() || parsed.place;
    const isVit = targetPlace.toLowerCase().includes("vit");

    const fallback = {
      name: `${targetPlace}, Chennai`,
      lat: isVit ? 12.8406 : targetPlace.toLowerCase().includes("velachery") ? 12.9815 : 13.0418,
      lng: isVit ? 80.1534 : targetPlace.toLowerCase().includes("velachery") ? 80.218 : 80.2341,
      source: "KNOWN_PLACE_RESOLUTION",
      status: "RESOLVED" as const
    };

    const location = (await resolvePlace(targetPlace).catch(() => null)) ?? fallback;
    const delta = 0.08;
    const area: GeographicArea = {
      west: location.lng - delta,
      south: location.lat - delta,
      east: location.lng + delta,
      north: location.lat + delta
    };

    // Permanent dispatch origin is VIT Chennai Base Hub
    const origin = {
      name: "VIT Chennai (Base Hub)",
      lat: 12.8406,
      lng: 80.1534,
      source: "FIXED_BASE_ORIGIN",
      status: "VERIFIED" as const
    };

    const haversineDistKm = calculateHaversineDistanceKm(origin.lat, origin.lng, location.lat, location.lng);

    // Parallel fetch real live Chennai data sources
    const [weather, hospitals, roads, buildings, drains, rivers, bridges] = await Promise.all([
      getCurrentWeather(location.lat, location.lng).catch(() => undefined),
      searchNearbyHospitals(location.lat, location.lng, 15000).catch(() => []),
      getRoadsInArea(area).catch(() => undefined),
      getBuildingsInArea(area).catch(() => undefined),
      getStormWaterDrainsInArea(area).catch(() => undefined),
      getRiversInArea(area).catch(() => undefined),
      getBridgeFeaturesInArea(area).catch(() => undefined)
    ]);

    // OSRM Driving corridors from VIT Chennai Base to Incident Location
    let routes: RouteOption[] = [];
    if (!isVit) {
      routes = await getAlternativeRoutes([origin.lng, origin.lat], [location.lng, location.lat]).catch(() => []);
    } else if (hospitals[0]) {
      routes = await getAlternativeRoutes([origin.lng, origin.lat], [hospitals[0].longitude, hospitals[0].latitude]).catch(() => []);
    }

    const primaryDrivingDistKm = routes[0] ? Math.round((routes[0].distanceMeters / 1000) * 10) / 10 : haversineDistKm;

    const hasGisData = roads !== undefined || buildings !== undefined || drains !== undefined || rivers !== undefined || bridges !== undefined;
    const gis = hasGisData
      ? {
          roads: roads?.features.length ?? 0,
          buildings: buildings?.features.length ?? 0,
          drains: drains?.features.length ?? 0,
          rivers: rivers?.features.length ?? 0,
          bridges: bridges?.features.length ?? 0,
          source: "Greater Chennai Corporation ArcGIS REST",
          status: "VERIFIED"
        }
      : undefined;

    // 1. Dynamic Flood Severity Determination
    const rainfallMm = weather?.rainfallMm ?? 0;
    const riversCount = rivers?.features.length ?? 0;
    const drainsCount = drains?.features.length ?? 0;
    const historical = getHistoricalFloodContext(location.name);

    const calculatedSeverity: "CRITICAL" | "HIGH" | "MODERATE" =
      rainfallMm > 20 || riversCount > 4 || historical.localityRiskLevel === "VERY_HIGH"
        ? "CRITICAL"
        : rainfallMm > 5 || drainsCount > 15 || historical.localityRiskLevel === "HIGH"
        ? "HIGH"
        : "MODERATE";

    // 2. Dynamic Population Estimation
    let effectivePopulation: number;
    if (body.population !== undefined) {
      effectivePopulation = body.population;
    } else if (promptText.includes("people") || promptText.includes("persons") || promptText.includes("residents")) {
      effectivePopulation = parsed.population;
    } else {
      // Dynamically estimate population based on GCC GIS building density and urban locality
      const buildingCount = buildings?.features.length ?? 180;
      effectivePopulation = Math.min(15000, Math.max(1500, Math.round(buildingCount * 14)));
    }

    // 3. Two Vehicle/Resource Input Modes:
    // Mode A: User provided resources (or explicit tokens in prompt)
    // Mode B: AI dynamic optimal sizing from scratch
    const userGaveExplicitResources =
      body.buses !== undefined || body.boats !== undefined || body.ambulances !== undefined || parsed.mode === "MODE_A_PREDEFINED";

    const resourceMode: "MODE_A_PREDEFINED" | "MODE_B_DYNAMIC" =
      body.mode ?? (userGaveExplicitResources ? "MODE_A_PREDEFINED" : "MODE_B_DYNAMIC");

    let effectiveBuses: number;
    let effectiveBoats: number;
    let effectiveAmbulances: number;
    let effectiveTeams: number;
    let effectiveBudget: number;

    if (resourceMode === "MODE_A_PREDEFINED") {
      effectiveBuses = body.buses ?? parsed.buses;
      effectiveBoats = body.boats ?? parsed.boats;
      effectiveAmbulances = body.ambulances ?? parsed.ambulances;
      effectiveTeams = body.rescueTeams ?? 20;
      effectiveBudget = body.budget ?? 350000;
    } else {
      // MODE_B_DYNAMIC: AI dynamic sizing from scratch
      effectiveBuses = Math.min(30, Math.max(4, Math.ceil(effectivePopulation / 350)));
      effectiveBoats =
        calculatedSeverity === "CRITICAL"
          ? Math.min(16, Math.max(4, Math.ceil(effectivePopulation / 600)))
          : calculatedSeverity === "HIGH"
          ? Math.min(10, Math.max(2, Math.ceil(effectivePopulation / 900)))
          : Math.min(6, Math.max(1, Math.ceil(effectivePopulation / 1800)));
      effectiveAmbulances = Math.min(15, Math.max(3, Math.ceil(effectivePopulation / 500)));
      effectiveTeams = Math.min(40, Math.max(6, Math.ceil(effectivePopulation / 250)));
      effectiveBudget = Math.max(500000, Math.ceil(effectivePopulation * 180 + primaryDrivingDistKm * 800));
    }

    // Create complete Phase 8 Decision Twin
    const decisionTwin: DecisionTwin = createDefaultDecisionTwin({
      placeName: location.name,
      lat: location.lat,
      lng: location.lng,
      population: effectivePopulation,
      buses: effectiveBuses,
      boats: effectiveBoats,
      ambulances: effectiveAmbulances,
      rescueTeams: effectiveTeams,
      budget: effectiveBudget,
      severity: calculatedSeverity,
      resourceMode,
      distanceFromBaseKm: primaryDrivingDistKm,
      origin,
      priorities: body.priorities ?? {
        safety: Math.round(parsed.priorities.safety * 100),
        speed: Math.round(parsed.priorities.time * 100),
        cost: Math.round(parsed.priorities.cost * 100),
        coverage: 0,
        reliability: 0
      },
      weather: weather ?? null,
      gis: gis ?? null,
      hospitals,
      routes
    });

    // Run pure deterministic simulation
    const simulation: SimulationResult = simulateDeterministicDecisionTwin(decisionTwin);

    // Also run backward-compatible simulation format
    const legacyResult = simulateScenario(
      {
        ...parsed,
        population: decisionTwin.estimatedPopulation.value,
        buses: decisionTwin.resources.buses.value,
        boats: decisionTwin.resources.boats.value,
        ambulances: decisionTwin.resources.ambulances.value
      },
      {
        origin,
        location,
        weather,
        hospitals,
        routes,
        gis
      }
    );

    return NextResponse.json({
      ...legacyResult,
      decisionTwin,
      simulation
    });
  } catch (error) {
    console.error("Decision Twin build failed", error);
    return NextResponse.json({ error: "Unable to build the scenario from the available data sources." }, { status: 502 });
  }
}
