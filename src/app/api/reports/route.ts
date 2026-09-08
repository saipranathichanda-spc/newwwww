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

    const sessionId = body.sessionId || "anonymous";
    const now = Date.now();

    // 1. Duplicate report check: Look for recent report from the same session within 45 seconds
    const existingReports = getAllReports();
    const recentDuplicate = existingReports.find((r) => {
      if (r.sessionId !== sessionId) return false;
      const reportTime = new Date(r.timestamp).getTime();
      return now - reportTime < 45000 && r.peopleCount === Number(body.peopleCount || 1);
    });

    if (recentDuplicate) {
      return NextResponse.json(
        {
          ...recentDuplicate,
          duplicateDetected: true,
          message: "A duplicate distress signal was received from this session. Existing active incident confirmed.",
        },
        { status: 200 }
      );
    }

    // 2. Handle missing GPS gracefully: fall back to neighborhood coordinates instead of rejecting
    let lat = Number(body.location?.lat);
    let lng = Number(body.location?.lng);
    let locationName = body.location?.name?.trim() || "Chennai Flood Zone";

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const lower = locationName.toLowerCase();
      if (lower.includes("velachery")) {
        lat = 12.9815;
        lng = 80.2180;
      } else if (lower.includes("tambaram")) {
        lat = 12.9249;
        lng = 80.1000;
      } else if (lower.includes("t nagar") || lower.includes("t. nagar")) {
        lat = 13.0418;
        lng = 80.2341;
      } else if (lower.includes("vit")) {
        lat = 12.8406;
        lng = 80.1534;
      } else {
        // Fallback: Greater Chennai Central coordinates
        lat = 13.0827;
        lng = 80.2757;
        locationName = `${locationName} (GPS Unavailable · Chennai Default)`;
      }
    }

    const report = createReport({
      sessionId,
      location: {
        name: locationName,
        lat,
        lng,
      },
      destination: body.destination
        ? {
            name: body.destination.name || "Destination",
            lat: Number(body.destination.lat) || 13.0827,
            lng: Number(body.destination.lng) || 80.2757,
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
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Report ID and target status are required." }, { status: 400 });
    }

    const updated = updateReportStatus(id, status as IncidentStatus);
    if (!updated) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update report status", error);
    return NextResponse.json({ error: "Failed to update incident status." }, { status: 500 });
  }
}
