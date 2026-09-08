import { NextRequest, NextResponse } from "next/server";
import { invalidateSession } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("astra_admin_session")?.value;
  if (token) {
    invalidateSession(token);
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully." });
  response.cookies.set({
    name: "astra_admin_session",
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return response;
}
