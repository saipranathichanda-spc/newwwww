export type GccLayerKey = "roads" | "buildings" | "drains" | "rivers" | "wards" | "zones" | "bridges";

export type GeoFeature = {
  id: string;
  type: "Feature";
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
  source: "Greater Chennai Corporation ArcGIS REST";
  sourceType: "VERIFIED";
  retrievedAt: string;
  confidence: number;
};

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
  metadata: { layer: GccLayerKey; source: string; retrievedAt: string; status: "VERIFIED" | "UNAVAILABLE" };
};
