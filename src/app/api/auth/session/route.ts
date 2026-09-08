import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("astra_admin_session")?.value;
  const session = validateSession(token);

  if (!session) {
    return NextResponse.json(
      { authenticated: false, error: "No active session or session expired." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    officer: {
      username: session.username,
      name: session.name,
      role: session.role,
      station: session.station,
      expiresAt: session.expiresAt,
    },
  });
}
