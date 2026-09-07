import { NextRequest, NextResponse } from "next/server";
import { getAllReports, createReport, updateReportStatus, type IncidentStatus } from "@/lib/reports-store";

export async function GET() {
  try {
    const reports = getAllReports();
    return NextResponse.json(reports);
  } catch (error) {
    console.error("Failed to retrieve reports", error);
    return NextResponse.json({ error: "Failed to retrieve reports" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.location?.lat || !body.location?.lng) {
      return NextResponse.json({ error: "Location coordinates are required." }, { status: 400 });
    }

    const report = createReport({
      sessionId: body.sessionId || "anonymous",
      location: {
        name: body.location.name || "Reported Location",
        lat: Number(body.location.lat),
        lng: Number(body.location.lng),
      },
      destination: body.destination
        ? {
            name: body.destination.name || "Destination",
            lat: Number(body.destination.lat),
            lng: Number(body.destination.lng),
          }
        : undefined,
      distanceKm: body.distanceKm ? Number(body.distanceKm) : undefined,
      travelMinutes: body.travelMinutes ? Number(body.travelMinutes) : undefined,
      riskScore: body.riskScore != null ? Number(body.riskScore) : undefined,
      routeSafetyStatus: body.routeSafetyStatus || undefined,
      routeGeometry: Array.isArray(body.routeGeometry) ? body.routeGeometry : undefined,
      hazards: Array.isArray(body.hazards) ? body.hazards : undefined,
      highRiskAreas: Array.isArray(body.highRiskAreas) ? body.highRiskAreas : undefined,
      nearbyHospitals: Array.isArray(body.nearbyHospitals) ? body.nearbyHospitals : undefined,
      answers: body.answers || undefined,
      waterLevel: body.waterLevel || "Unknown",
      waterMovement: body.waterMovement || "Unknown",
      peopleCount: Number(body.peopleCount) || 1,
      needsEvacuation: Boolean(body.needsEvacuation),
      hasMedicalEmergency: Boolean(body.hasMedicalEmergency),
      notes: body.notes || "",
      severity: body.hasMedicalEmergency
        ? "CRITICAL"
        : body.waterLevel?.includes("> 50") || body.waterLevel?.includes("Waist")
        ? "HIGH"
        : "MEDIUM",
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Failed to submit citizen report", error);
    return NextResponse.json({ error: "Failed to save emergency report." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { id: string; status: IncidentStatus };
    if (!body.id || !body.status) {
      return NextResponse.json({ error: "ID and status are required." }, { status: 400 });
    }

    const updated = updateReportStatus(body.id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update report status", error);
    return NextResponse.json({ error: "Failed to update report status." }, { status: 500 });
  }
}
