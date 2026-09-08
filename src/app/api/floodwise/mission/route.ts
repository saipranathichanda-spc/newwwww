import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth-server";
import { getSharedState, getAllMissions } from "@/lib/floodwise/store";
import { updateMissionExecutionStatus, recordFieldUpdate } from "@/lib/floodwise/mission-manager";

const MISSION_AUTHORIZED_ROLES = new Set(["COMMANDER", "DISPATCHER"]);

function extractToken(request: NextRequest, bodyToken?: string): string | null {
  const cookieToken = request.cookies.get("astra_admin_session")?.value;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) return authHeader.substring(7).trim();
    return authHeader.trim();
  }

  if (bodyToken && typeof bodyToken === "string" && bodyToken.trim()) {
    return bodyToken.trim();
  }

  return null;
}

export async function GET() {
  const shared = getSharedState();
  const allMissions = getAllMissions();

  return NextResponse.json({
    activeMission: shared.mission,
    allMissions,
    fieldUpdates: shared.field_updates || [],
    reassessment: shared.reassessment,
  });
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request payload." }, { status: 400 });
  }

  const token = extractToken(request, body.token || body.sessionToken);
  if (!token) {
    return NextResponse.json(
      { error: "Your session expired. Please log in again." },
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

  if (!MISSION_AUTHORIZED_ROLES.has(session.role)) {
    return NextResponse.json(
      { error: "Your account is not authorised for this action." },
      { status: 403 }
    );
  }

  const shared = getSharedState();
  const actionType = body.action || "update_status";

  // Action 1: Field Update & Reassessment (Notebook Cells 80-85, 89)
  if (actionType === "field_update") {
    const note = String(body.note || "Field conditions reported").trim();
    const result = recordFieldUpdate(shared, {
      status: body.status,
      note,
      evacuated_people: body.evacuated_people ? Number(body.evacuated_people) : null,
      road_status: body.road_status,
      resource_issue: body.resource_issue,
      actor: session.name,
    });

    return NextResponse.json({
      success: true,
      action: "field_update",
      fieldUpdate: result.fieldUpdate,
      reassessment: result.reassessment,
      decisionTwin: shared.scenario.decision_twin,
      stateVersion: shared.state_version,
      analysisVersion: shared.analysis_version,
    });
  }

  // Action 2: Update Mission Status (Notebook Cells 67, 87)
  const targetStatus = body.status;
  const validStatuses = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "ABORTED"];
  if (!validStatuses.includes(targetStatus)) {
    return NextResponse.json(
      { error: `Invalid mission status "${targetStatus}". Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const updatedMission = updateMissionExecutionStatus(
      shared,
      targetStatus,
      body.note || "",
      session.name
    );

    return NextResponse.json({
      success: true,
      action: "update_status",
      mission: updatedMission,
      orchestratorStage: shared.orchestrator_stage,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update mission." }, { status: 400 });
  }
}
