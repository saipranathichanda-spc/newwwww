import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, twoFactorCode } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Officer ID and Authorization Passcode are required." },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const result = authenticateAdmin(username, password, twoFactorCode, clientIp);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          locked: result.locked,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status: result.locked ? 429 : 401 }
      );
    }

    // Authentication successful. Issue HttpOnly session cookie
    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      officer: {
        username: result.session.username,
        name: result.session.name,
        role: result.session.role,
        station: result.session.station,
      },
    });

    response.cookies.set({
      name: "astra_admin_session",
      value: result.session.token,
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: 7200, // 2 hours
    });

    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json(
      { error: "Internal authentication error. Please try again." },
      { status: 500 }
    );
  }
}
