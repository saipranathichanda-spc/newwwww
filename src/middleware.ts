import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard route
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get("astra_admin_session")?.value;
    if (!sessionCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();

  // Inject comprehensive production security headers
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org https://tiles.openfreemap.org https://demotiles.maplibre.org https://gisgcc.chennaicorporation.gov.in https:",
      "font-src 'self' data: https://fonts.gstatic.com https://tiles.openfreemap.org https://demotiles.maplibre.org",
      "connect-src 'self' https://tiles.openfreemap.org https://*.openfreemap.org https://demotiles.maplibre.org https://nominatim.openstreetmap.org https://router.project-osrm.org https://api.open-meteo.com https://gisgcc.chennaicorporation.gov.in https://overpass-api.de https://overpass.private.coffee https://overpass.kumi.systems https://unpkg.com https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
