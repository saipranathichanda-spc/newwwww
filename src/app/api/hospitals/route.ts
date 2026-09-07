import { NextRequest, NextResponse } from "next/server";
import { searchNearbyHospitals } from "@/lib/data-sources/hospitals";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams; const latitude = Number(params.get("lat")); const longitude = Number(params.get("lng"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  try { return NextResponse.json(await searchNearbyHospitals(latitude, longitude)); }
  catch (error) { console.error("Hospital search failed", error); return NextResponse.json({ error: "Hospital discovery is currently unavailable. No facilities were substituted." }, { status: 503 }); }
}
