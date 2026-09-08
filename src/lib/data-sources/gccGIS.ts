import type { GccLayerKey, GeoFeatureCollection } from "@/types/gis";

const SERVICE_URL = "https://gisgcc.chennaicorporation.gov.in/server/rest/services/GCCDepts/GCC_COLLABORATION_LAYER/MapServer";
const LAYER_IDS: Record<GccLayerKey, number> = { bridges: 0, rivers: 1, roads: 2, buildings: 4, wards: 6, zones: 7, drains: 8 };

export type GeographicArea = { west: number; south: number; east: number; north: number };

export async function getGccLayerInArea(layer: GccLayerKey, area: GeographicArea): Promise<GeoFeatureCollection> {
  const params = new URLSearchParams({
    where: "1=1", outFields: "*", returnGeometry: "true", f: "geojson", outSR: "4326",
    geometryType: "esriGeometryEnvelope", geometry: `${area.west},${area.south},${area.east},${area.north}`,
    inSR: "4326", spatialRel: "esriSpatialRelIntersects", resultRecordCount: "1000",
  });
  const response = await fetch(`${SERVICE_URL}/${LAYER_IDS[layer]}/query?${params}`, {
    signal: AbortSignal.timeout(6000),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`GCC GIS returned ${response.status}`);
  const raw = await response.json() as { features?: Array<{ id?: string | number; geometry: Record<string, unknown>; properties?: Record<string, unknown> }> };
  const retrievedAt = new Date().toISOString();
  return {
    type: "FeatureCollection",
    features: (raw.features ?? []).map((feature, index) => ({
      id: String(feature.id ?? feature.properties?.objectid ?? index), type: "Feature", geometry: feature.geometry,
      properties: feature.properties ?? {}, source: "Greater Chennai Corporation ArcGIS REST", sourceType: "VERIFIED", retrievedAt, confidence: 0.9,
    })),
    metadata: { layer, source: "Greater Chennai Corporation ArcGIS REST", retrievedAt, status: "VERIFIED" },
  };
}

export const getRoadsInArea = (area: GeographicArea) => getGccLayerInArea("roads", area);
export const getBuildingsInArea = (area: GeographicArea) => getGccLayerInArea("buildings", area);
export const getStormWaterDrainsInArea = (area: GeographicArea) => getGccLayerInArea("drains", area);
export const getRiversInArea = (area: GeographicArea) => getGccLayerInArea("rivers", area);
export const getWardsInArea = (area: GeographicArea) => getGccLayerInArea("wards", area);
export const getZonesInArea = (area: GeographicArea) => getGccLayerInArea("zones", area);
export const getBridgeFeaturesInArea = (area: GeographicArea) => getGccLayerInArea("bridges", area);
