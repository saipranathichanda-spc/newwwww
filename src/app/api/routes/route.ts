import { NextRequest, NextResponse } from "next/server";
import { getAlternativeRoutes } from "@/lib/data-sources/routing";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const values = ["originLng", "originLat", "destinationLng", "destinationLat"].map((key) => Number(params.get(key)));
  if (values.some((value) => !Number.isFinite(value))) return NextResponse.json({ error: "Origin and destination coordinates are required." }, { status: 400 });
  try { return NextResponse.json(await getAlternativeRoutes([values[0], values[1]], [values[2], values[3]])); }
  catch (error) { console.error("Route request failed", error); return NextResponse.json({ error: "Route service unavailable. No estimated route was substituted." }, { status: 503 }); }
}
