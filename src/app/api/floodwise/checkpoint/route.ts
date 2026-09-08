import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth-server";
import { getSharedState } from "@/lib/floodwise/store";
import { createCheckpoint, restoreCheckpoint, listCheckpoints } from "@/lib/floodwise/checkpoint-store";

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
  const checkpoints = listCheckpoints();
  return NextResponse.json({
    total: checkpoints.length,
    checkpoints,
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

  const shared = getSharedState();
  const action = body.action || "save";

  if (action === "save") {
    const checkpoint = createCheckpoint(shared, session.name);
    return NextResponse.json({
      success: true,
      action: "save",
      checkpoint,
    });
  }

  if (action === "restore") {
    const checkpointId = body.checkpointId;
    if (!checkpointId) {
      return NextResponse.json({ error: "Missing required 'checkpointId' parameter." }, { status: 400 });
    }

    const restoreResult = restoreCheckpoint(checkpointId, shared, session.name);
    if (!restoreResult.success) {
      return NextResponse.json({ error: restoreResult.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action: "restore",
      checkpoint: restoreResult.checkpoint,
      sharedState: shared,
    });
  }

  return NextResponse.json({ error: `Unknown checkpoint action "${action}".` }, { status: 400 });
}
