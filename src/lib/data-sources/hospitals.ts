export type Hospital = { id: string; name: string; latitude: number; longitude: number; address: string | null; phone: string | null; source: "OpenStreetMap / Overpass" | "OpenStreetMap / Nominatim"; retrievedAt: string; confidence: number };

export async function searchNearbyHospitals(latitude: number, longitude: number, radiusMeters = 15_000): Promise<Hospital[]> {
  const query = `[out:json][timeout:10];(node["amenity"="hospital"](around:${radiusMeters},${latitude},${longitude});way["amenity"="hospital"](around:${radiusMeters},${latitude},${longitude}););out center 15 tags;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  let data: { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | undefined;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json", "User-Agent": "Astra-Chennai-Decision-Twin/1.0" },
        signal: AbortSignal.timeout(7000),
        next: { revalidate: 300 }
      });
      if (response.ok) { data = await response.json(); break; }
      console.warn(`Overpass endpoint failed: ${response.status}`);
    } catch (error) { console.warn("Overpass endpoint unavailable", error); }
  }
  if (!data) throw new Error("All configured Overpass endpoints are unavailable");
  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  return (data.elements ?? []).map((element) => {
    const tags = element.tags ?? {}; const point = element.center ?? { lat: element.lat ?? 0, lon: element.lon ?? 0 };
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") || null;
    return { id: `${element.type}-${element.id}`, name: tags.name ?? "Unnamed hospital", latitude: point.lat, longitude: point.lon, address, phone: tags.phone ?? tags["contact:phone"] ?? null, source: "OpenStreetMap / Overpass" as const, retrievedAt, confidence: 0.65 };
  }).filter((hospital) => hospital.latitude && hospital.longitude && hospital.name !== "Unnamed hospital").filter((hospital) => seen.has(hospital.id) ? false : (seen.add(hospital.id), true));
}
