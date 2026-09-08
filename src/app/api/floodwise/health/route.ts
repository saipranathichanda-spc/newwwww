import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "online",
    message: "FloodWise backend is running",
    service: "Astra Chennai Flood Command & Decision Twin",
    version: "2.0.0",
    pipeline: "ready",
    timestamp: new Date().toISOString(),
  });
}
