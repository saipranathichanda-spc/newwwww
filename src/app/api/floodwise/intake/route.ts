import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { recordIntakeSubmission, getAllSubmissions, getOrCreateSharedState } from "@/lib/floodwise/store";
import { validateStructuredData, buildUnifiedScenario, validateUnifiedScenario } from "@/lib/floodwise/validation";
import { IntakeSubmission, FloodWiseRole } from "@/types/floodwise";

const RECENT_SUBMISSIONS = new Map<string, number>();

export async function GET() {
  const submissions = getAllSubmissions();
  return NextResponse.json({
    total: submissions.length,
    submissions: submissions.slice(0, 50),
  });
}

export async function POST(request: NextRequest) {
  const correlationId = `REQ-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  // Rate limiting check
  const rateLimitKey = `RL_${clientIp}`;
  const now = Date.now();
  const lastCall = RECENT_SUBMISSIONS.get(rateLimitKey) || 0;
  if (now - lastCall < 300) {
    // 300ms throttling to prevent rapid automated flood
    return NextResponse.json(
      {
        error: "Too many intake requests. Please wait before submitting again.",
        correlationId,
      },
      { status: 429 }
    );
  }
  RECENT_SUBMISSIONS.set(rateLimitKey, now);

  let data: any = {};
  try {
    data = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Malformed request. Expected valid JSON body.",
        correlationId,
      },
      { status: 400 }
    );
  }

  const rawRole = String(data.role || "unknown").toLowerCase();
  const role: FloodWiseRole = rawRole === "admin" || rawRole === "user" ? rawRole : "unknown";

  const responses = data.responses || {};
  if (typeof responses !== "object" || Array.isArray(responses)) {
    return NextResponse.json(
      {
        error: "Invalid payload: 'responses' must be an object of questionnaire keys.",
        correlationId,
      },
      { status: 400 }
    );
  }

  // Idempotency / Duplicate Submission Detection
  const contentHash = crypto
    .createHash("md5")
    .update(`${role}_${JSON.stringify(responses)}`)
    .digest("hex");
  const duplicateKey = `DUP_${contentHash}`;
  const lastDup = RECENT_SUBMISSIONS.get(duplicateKey);
  if (lastDup && now - lastDup < 30000) {
    // Identical submission within 30 seconds
    return NextResponse.json(
      {
        status: "duplicate_ignored",
        message: "Identical submission detected within 30 seconds. Idempotently acknowledged.",
        role,
        correlationId,
      },
      { status: 200 }
    );
  }
  RECENT_SUBMISSIONS.set(duplicateKey, now);

  // Field validation
  const validation = validateStructuredData(responses);
  if (validation.status === "INVALID") {
    const invalidFields = validation.fields.filter((f) => f.status === "INVALID");
    return NextResponse.json(
      {
        error: "One or more questionnaire fields contain invalid values.",
        correlationId,
        invalidFields,
      },
      { status: 400 }
    );
  }

  const timestamp = new Date().toISOString();
  const submissionId = `${role}_${now}`;

  const submission: IntakeSubmission = {
    id: submissionId,
    role,
    timestamp,
    responses,
    clientIp,
  };

  recordIntakeSubmission(submission);

  // Update unified scenario state
  const shared = getOrCreateSharedState();
  if (role === "admin") {
    for (const [qid, item] of Object.entries(responses)) {
      if (item && (item as any).value !== undefined) {
        shared.scenario.admin[qid] = (item as any).value;
      }
    }
  } else {
    shared.scenario.users[submissionId] = {};
    for (const [qid, item] of Object.entries(responses)) {
      if (item && (item as any).value !== undefined) {
        shared.scenario.users[submissionId][qid] = (item as any).value;
      }
    }
  }

  // Re-validate unified scenario
  shared.validation = validateUnifiedScenario(shared.scenario);
  shared.state_version = (shared.state_version || 0) + 1;
  shared.analysis_version = null; // Mark stale to trigger reassessment

  console.log(`[FLOODWISE INTAKE] Processed ${role.toUpperCase()} submission ${submissionId} (Correlation: ${correlationId})`);

  return NextResponse.json(
    {
      status: "success",
      message: "FloodWise data received and normalized successfully.",
      role,
      submissionId,
      timestamp,
      correlationId,
      receivedFieldsCount: Object.keys(responses).length,
      decisionReady: shared.validation.decisionReady,
    },
    { status: 201 }
  );
}
