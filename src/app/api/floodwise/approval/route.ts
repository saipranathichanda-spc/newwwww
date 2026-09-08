import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth-server";
import { getSharedState, logAuditEvent } from "@/lib/floodwise/store";
import { generateMissionFromApproval } from "@/lib/floodwise/mission-manager";

const APPROVAL_AUTHORIZED_ROLES = new Set(["COMMANDER", "DISPATCHER"]);

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

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request payload." }, { status: 400 });
  }

  const token = extractToken(request, body.token || body.sessionToken);

  // 1. Missing session token
  if (!token) {
    return NextResponse.json(
      { error: "Your session expired. Please log in again." },
      { status: 401 }
    );
  }

  // 2. Validate session and expiration
  const session = validateSession(token);
  if (!session) {
    return NextResponse.json(
      { error: "Your session expired. Please log in again." },
      { status: 401 }
    );
  }

  // 3. RBAC permission check
  if (!APPROVAL_AUTHORIZED_ROLES.has(session.role)) {
    return NextResponse.json(
      { error: "Your account is not authorised for this action." },
      { status: 403 }
    );
  }

  // 4. Validate operational rationale
  const rawRationale = body.rationale ?? body.reason ?? body.operationalRationale;
  const rationale = typeof rawRationale === "string" ? rawRationale.trim() : "";
  if (!rationale) {
    return NextResponse.json(
      { error: "Please enter the operational reason." },
      { status: 400 }
    );
  }

  const decisionChoice = String(body.action || "APPROVE").toUpperCase(); // APPROVE, MODIFY, REJECT
  const shared = getSharedState();

  if (!shared.decision || !shared.decision.recommended_plan) {
    return NextResponse.json(
      { error: "No candidate plans or AI recommendation available to approve." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  let selectedPlan: string | null = shared.decision.recommended_plan;

  if (decisionChoice === "MODIFY") {
    selectedPlan = body.selectedPlanId || shared.decision.recommended_plan;
  } else if (decisionChoice === "REJECT") {
    selectedPlan = null;
  }

  shared.human_approval = {
    status: decisionChoice === "APPROVE" ? "APPROVED" : (decisionChoice === "MODIFY" ? "MODIFIED" : "REJECTED"),
    selected_plan: selectedPlan,
    ai_recommendation: shared.decision.recommended_plan,
    approved_by: session.name,
    officer_role: session.role,
    operational_rationale: rationale,
    timestamp: now,
  };

  logAuditEvent(
    `HUMAN_${decisionChoice}`,
    session.name,
    session.role,
    `Human approval action: ${decisionChoice}. Plan: ${selectedPlan || "NONE"}. Rationale: ${rationale}`
  );

  let mission = null;
  if (decisionChoice === "APPROVE" || decisionChoice === "MODIFY") {
    mission = generateMissionFromApproval(shared, session.name, rationale);
  } else {
    shared.orchestrator_stage = "REJECTED";
  }

  return NextResponse.json({
    success: true,
    action: decisionChoice,
    approval: shared.human_approval,
    mission,
    orchestratorStage: shared.orchestrator_stage,
  });
}
