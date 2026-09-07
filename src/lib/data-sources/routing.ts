export type RouteOption = { id: string; distanceMeters: number; durationSeconds: number; geometry: Record<string, unknown>; source: "OSRM"; retrievedAt: string; trafficStatus: "STANDARD_ROUTING" };

export async function getAlternativeRoutes(origin: [number, number], destination: [number, number]): Promise<RouteOption[]> {
  const query = new URLSearchParams({ alternatives: "true", overview: "full", geometries: "geojson", steps: "false" });
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.join(",")};${destination.join(",")}?${query}`, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
  const data = await response.json() as { code?: string; routes?: Array<{ distance: number; duration: number; geometry: Record<string, unknown> }> };
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route available");
  const retrievedAt = new Date().toISOString();
  return data.routes.map((route, index) => ({ id: `route-${index + 1}`, distanceMeters: route.distance, durationSeconds: route.duration, geometry: route.geometry, source: "OSRM", retrievedAt, trafficStatus: "STANDARD_ROUTING" }));
}
