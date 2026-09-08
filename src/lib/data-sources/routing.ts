export type RouteOption = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: Record<string, unknown>;
  source: "OSRM";
  retrievedAt: string;
  confidence: number;
  trafficStatus: "STANDARD_ROUTING";
};

export async function getAlternativeRoutes(
  origin: [number, number],
  destination: [number, number]
): Promise<RouteOption[]> {
  const query = new URLSearchParams({
    alternatives: "true",
    overview: "full",
    geometries: "geojson",
    steps: "false",
  });

  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${origin.join(",")};${destination.join(",")}?${query}`,
    {
      signal: AbortSignal.timeout(6000), // 6-second timeout
      next: { revalidate: 60 },
    }
  );

  if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
  const data = (await response.json()) as {
    code?: string;
    routes?: Array<{ distance: number; duration: number; geometry: Record<string, unknown> }>;
  };

  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route available");
  const retrievedAt = new Date().toISOString();

  return data.routes.map((route, index) => ({
    id: `route-${index + 1}`,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry,
    source: "OSRM",
    retrievedAt,
    confidence: 0.88,
    trafficStatus: "STANDARD_ROUTING",
  }));
}
