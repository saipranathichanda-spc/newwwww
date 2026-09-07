import { NextRequest, NextResponse } from "next/server";
import { getAlternativeRoutes } from "@/lib/data-sources/routing";
import { getBridgeFeaturesInArea, getBuildingsInArea, getRiversInArea, getRoadsInArea, getStormWaterDrainsInArea, type GeographicArea } from "@/lib/data-sources/gccGIS";
import { searchNearbyHospitals } from "@/lib/data-sources/hospitals";
import { getCurrentWeather } from "@/lib/data-sources/weather";
import { parseScenario, simulateScenario } from "@/lib/decision-twin";

async function resolvePlace(name: string) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(`${name}, Chennai, Tamil Nadu`)}`, { headers: { Accept: "application/json", "User-Agent": "Astra-Chennai-Decision-Twin/1.0" }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`Location search returned ${response.status}`);
  const matches = await response.json() as Array<{ display_name?: string; lat: string; lon: string }>;
  const match = matches[0];
  return match ? { name: match.display_name ?? name, lat: Number(match.lat), lng: Number(match.lon), source: "OpenStreetMap / Nominatim", status: "RESOLVED" } : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { prompt?: string };
    if (!body.prompt?.trim()) return NextResponse.json({ error: "A scenario prompt is required." }, { status: 400 });
    const input = parseScenario(body.prompt.trim());
    const fallback = { name: input.place, lat: input.place.toLowerCase().includes("vit") ? 12.8406 : 13.0827, lng: input.place.toLowerCase().includes("vit") ? 80.1534 : 80.2707, source: "KNOWN_PLACE_RESOLUTION", status: "RESOLVED" };
    const location = (await resolvePlace(input.place).catch(() => null)) ?? fallback;
    const delta = 0.08; const area: GeographicArea = { west: location.lng - delta, south: location.lat - delta, east: location.lng + delta, north: location.lat + delta };
    const [weather, hospitals, roads, buildings, drains, rivers, bridges] = await Promise.all([
      getCurrentWeather(location.lat, location.lng).catch(() => undefined),
      searchNearbyHospitals(location.lat, location.lng, 15000).catch(() => []),
      getRoadsInArea(area).catch(() => undefined),
      getBuildingsInArea(area).catch(() => undefined),
      getStormWaterDrainsInArea(area).catch(() => undefined),
      getRiversInArea(area).catch(() => undefined),
      getBridgeFeaturesInArea(area).catch(() => undefined),
    ]);
    const origin = {
      name: "VIT Chennai (Base Hub)",
      lat: 12.8406,
      lng: 80.1534,
      source: "FIXED_BASE_ORIGIN",
      status: "RESOLVED"
    };

    const isVitIncident = location.name.toLowerCase().includes("vit");
    let routes: Array<import("@/lib/data-sources/routing").RouteOption> = [];
    if (!isVitIncident) {
      // Automatically route from fixed VIT Chennai base to the flood location (e.g. Central, Velachery)
      routes = await getAlternativeRoutes([origin.lng, origin.lat], [location.lng, location.lat]).catch(() => []);
    } else if (hospitals[0]) {
      // If incident is at VIT Chennai, route to nearest hospital facility
      routes = await getAlternativeRoutes([origin.lng, origin.lat], [hospitals[0].longitude, hospitals[0].latitude]).catch(() => []);
    }
    
    function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    }

    const mappedHospitals = hospitals.map((hospital, index) => {
      const distanceKm = haversineDistanceKm(location.lat, location.lng, hospital.latitude, hospital.longitude);
      const routeForHospital = index === 0 && routes[0] ? routes[0] : null;
      const travelMinutes = routeForHospital
        ? Math.round(routeForHospital.durationSeconds / 60)
        : Math.max(2, Math.round(distanceKm * 2.5));
      return {
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        distanceKm,
        travelMinutes,
        source: hospital.source,
        confidence: hospital.confidence
      };
    });

    const hasGisData = roads !== undefined || buildings !== undefined || drains !== undefined || rivers !== undefined || bridges !== undefined;
    const gis = hasGisData ? {
      roads: roads?.features.length ?? 0,
      buildings: buildings?.features.length ?? 0,
      drains: drains?.features.length ?? 0,
      rivers: rivers?.features.length ?? 0,
      bridges: bridges?.features.length ?? 0,
      source: "Greater Chennai Corporation ArcGIS REST",
      status: "VERIFIED"
    } : undefined;

    const result = simulateScenario(input, {
      origin,
      location,
      weather,
      hospitals: mappedHospitals,
      routes,
      gis
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Decision Twin build failed", error);
    return NextResponse.json({ error: "Unable to build the scenario from the available data sources." }, { status: 502 });
  }
}
