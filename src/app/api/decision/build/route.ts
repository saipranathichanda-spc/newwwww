import { NextRequest, NextResponse } from "next/server";
import { getAlternativeRoutes, type RouteOption } from "@/lib/data-sources/routing";
import { getBridgeFeaturesInArea, getBuildingsInArea, getRiversInArea, getRoadsInArea, getStormWaterDrainsInArea, type GeographicArea } from "@/lib/data-sources/gccGIS";
import { searchNearbyHospitals } from "@/lib/data-sources/hospitals";
import { getCurrentWeather } from "@/lib/data-sources/weather";
import {
  parseScenario,
  createDefaultDecisionTwin,
  simulateDeterministicDecisionTwin,
  simulateScenario,
  type DecisionTwin,
  type SimulationResult
} from "@/lib/decision-twin";

async function resolvePlace(name: string) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(`${name}, Chennai, Tamil Nadu`)}`,
    {
      headers: { Accept: "application/json", "User-Agent": "Astra-Chennai-Decision-Twin/1.0" },
      next: { revalidate: 3600 }
    }
  );
  if (!response.ok) throw new Error(`Location search returned ${response.status}`);
  const matches = (await response.json()) as Array<{ display_name?: string; lat: string; lon: string }>;
  const match = matches[0];
  return match
    ? {
        name: match.display_name ?? name,
        lat: Number(match.lat),
        lng: Number(match.lon),
        source: "OpenStreetMap / Nominatim",
        status: "RESOLVED"
      }
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      place?: string;
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
      name: targetPlace,
      lat: isVit ? 12.8406 : targetPlace.toLowerCase().includes("velachery") ? 12.9815 : 13.0827,
      lng: isVit ? 80.1534 : targetPlace.toLowerCase().includes("velachery") ? 80.218 : 80.2707,
      source: "KNOWN_PLACE_RESOLUTION",
      status: "RESOLVED"
    };

    const location = (await resolvePlace(targetPlace).catch(() => null)) ?? fallback;
    const delta = 0.08;
    const area: GeographicArea = {
      west: location.lng - delta,
      south: location.lat - delta,
      east: location.lng + delta,
      north: location.lat + delta
    };

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

    const origin = {
      name: "VIT Chennai (Base Hub)",
      lat: 12.8406,
      lng: 80.1534,
      source: "FIXED_BASE_ORIGIN",
      status: "RESOLVED"
    };

    let routes: RouteOption[] = [];
    if (!isVit) {
      routes = await getAlternativeRoutes([origin.lng, origin.lat], [location.lng, location.lat]).catch(() => []);
    } else if (hospitals[0]) {
      routes = await getAlternativeRoutes([origin.lng, origin.lat], [hospitals[0].longitude, hospitals[0].latitude]).catch(() => []);
    }

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

    // Create complete Phase 8 Decision Twin
    const decisionTwin: DecisionTwin = createDefaultDecisionTwin({
      placeName: location.name,
      lat: location.lat,
      lng: location.lng,
      population: body.population ?? parsed.population,
      buses: body.buses ?? parsed.buses,
      boats: body.boats ?? parsed.boats,
      ambulances: body.ambulances ?? parsed.ambulances,
      rescueTeams: body.rescueTeams ?? 20,
      budget: body.budget ?? 100000,
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
