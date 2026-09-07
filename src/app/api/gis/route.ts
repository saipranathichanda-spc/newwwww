import { NextRequest, NextResponse } from "next/server";
import { getGccLayerInArea } from "@/lib/data-sources/gccGIS";
import type { GccLayerKey } from "@/types/gis";

const allowedLayers = new Set<GccLayerKey>(["roads", "buildings", "drains", "rivers", "wards", "zones", "bridges"]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const layer = searchParams.get("layer") as GccLayerKey;
  const lat = Number(searchParams.get("lat")); const lng = Number(searchParams.get("lng"));
  const radiusKm = Math.min(Math.max(Number(searchParams.get("radiusKm") ?? 10), 0.25), 20);
  if (!allowedLayers.has(layer) || !Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "Valid layer, latitude, and longitude are required." }, { status: 400 });
  const latDelta = radiusKm / 111; const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  try {
    const data = await getGccLayerInArea(layer, { west: lng - lngDelta, south: lat - latDelta, east: lng + lngDelta, north: lat + latDelta });
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    console.error("GCC GIS query failed", error);
    return NextResponse.json({ error: "GCC GIS is currently unavailable. No substitute geographic data was used." }, { status: 503 });
  }
}
