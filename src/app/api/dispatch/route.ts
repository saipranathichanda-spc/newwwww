import { NextRequest, NextResponse } from "next/server";
import { logDispatchRecord, getAllDispatchAuditRecords } from "@/lib/dispatch-audit";
import { validateSession } from "@/lib/auth-server";

// Authorized roles permitted to authorize real-world emergency fleet dispatch
const DISPATCH_AUTHORIZED_ROLES = new Set(["COMMANDER", "DISPATCHER"]);

function extractSessionToken(request: NextRequest, bodyToken?: string): string | null {
  // 1. Check HttpOnly session cookie
  const cookieToken = request.cookies.get("astra_admin_session")?.value;
  if (cookieToken) return cookieToken;

  // 2. Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }
    return authHeader.trim();
  }

  // 3. Fallback to token inside JSON body if provided
  if (bodyToken && typeof bodyToken === "string" && bodyToken.trim()) {
    return bodyToken.trim();
  }

  return null;
}

export async function GET(request: NextRequest) {
  const token = extractSessionToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing administrative credentials. Authorization session required." },
      { status: 401 }
    );
  }

  const session = validateSession(token);
  if (!session) {
    return NextResponse.json(
      { error: "Your session expired. Please log in again." },
      { status: 401 }
    );
  }

  return NextResponse.json(getAllDispatchAuditRecords());
}

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request payload." },
      { status: 400 }
    );
  }

  const token = extractSessionToken(request, body.token || body.sessionToken);

  // 1. Check for missing credentials
  if (!token) {
    console.warn(`[SECURITY AUDIT] Unauthorized dispatch attempt: Missing administrative credentials from IP ${clientIp}`);
    return NextResponse.json(
      { error: "Missing administrative credentials. Authorization session required." },
      { status: 401 }
    );
  }

  // 2. Validate session and check expiration
  const session = validateSession(token);
  if (!session) {
    console.warn(`[SECURITY AUDIT] Unauthorized dispatch attempt: Expired or invalid session from IP ${clientIp}`);
    return NextResponse.json(
      { error: "Your session expired. Please log in again." },
      { status: 401 }
    );
  }

  // 3. Role-Based Access Control (RBAC): Check dispatch permission
  if (!DISPATCH_AUTHORIZED_ROLES.has(session.role)) {
    console.warn(
      `[SECURITY AUDIT] Forbidden dispatch attempt by role "${session.role}" (User: ${session.username}, IP: ${clientIp})`
    );
    return NextResponse.json(
      { error: "Your account is not authorised for this action." },
      { status: 403 }
    );
  }

  try {
    const { locationName, locationCoordinates, resources, corridor, distanceKm } = body;

    // Support multiple field aliases (reason, rationale, operationalRationale, notes)
    const rawReason =
      body.reason ??
      body.rationale ??
      body.operationalRationale ??
      body.notes;

    const trimmedReason = typeof rawReason === "string" ? rawReason.trim() : "";

    // 4. Validate operational rationale
    if (!trimmedReason) {
      return NextResponse.json(
        { error: "Please enter the operational reason." },
        { status: 400 }
      );
    }

    if (!locationName || !resources) {
      return NextResponse.json(
        { error: "Target location and resource allocation details are required." },
        { status: 400 }
      );
    }

    const record = logDispatchRecord({
      officerName: session.name,
      officerRole: session.role,
      locationName: String(locationName).trim(),
      locationCoordinates: locationCoordinates || { lat: 12.9815, lng: 80.218 },
      resources: {
        buses: Number(resources.buses) || 0,
        boats: Number(resources.boats) || 0,
        ambulances: Number(resources.ambulances) || 0,
        rescueTeams: Number(resources.rescueTeams) || 0,
      },
      corridor: corridor ? String(corridor).trim() : "Primary Arterial Corridor",
      distanceKm: Number(distanceKm) || 20,
      reason: trimmedReason,
      status: "OFFICIALLY_DISPATCHED",
    });

    console.log(`[DISPATCH AUDIT] Officer ${session.name} (${session.role}) officially dispatched fleet to ${locationName}. ID: ${record.id}`);

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error) {
    console.error("Failed to log dispatch record:", error);
    return NextResponse.json({ error: "Failed to record dispatch audit." }, { status: 500 });
  }
}
