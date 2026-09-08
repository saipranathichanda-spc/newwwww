import { NextRequest, NextResponse } from "next/server";
import { logDispatchRecord, getAllDispatchAuditRecords } from "@/lib/dispatch-audit";
import { validateSession } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("astra_admin_session")?.value;
  const session = validateSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getAllDispatchAuditRecords());
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("astra_admin_session")?.value;
  const session = validateSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { locationName, locationCoordinates, resources, corridor, distanceKm, reason } = body;

    if (!locationName || !resources || !reason) {
      return NextResponse.json(
        { error: "Location, resources, and operational reason are required." },
        { status: 400 }
      );
    }

    const record = logDispatchRecord({
      officerName: session.name,
      officerRole: session.role,
      locationName,
      locationCoordinates: locationCoordinates || { lat: 12.9815, lng: 80.218 },
      resources: {
        buses: Number(resources.buses) || 0,
        boats: Number(resources.boats) || 0,
        ambulances: Number(resources.ambulances) || 0,
        rescueTeams: Number(resources.rescueTeams) || 0,
      },
      corridor: corridor || "Primary Corridor",
      distanceKm: Number(distanceKm) || 20,
      reason: String(reason).trim(),
      status: "OFFICIALLY_DISPATCHED",
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error) {
    console.error("Failed to log dispatch record:", error);
    return NextResponse.json({ error: "Failed to record dispatch audit." }, { status: 500 });
  }
}
