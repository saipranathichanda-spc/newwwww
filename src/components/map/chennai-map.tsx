"use client";

import { FormEvent, useEffect, useRef, useState, useCallback } from "react";
import type { GccLayerKey, GeoFeatureCollection } from "@/types/gis";
import type { RouteOption } from "@/lib/data-sources/routing";
import type { Hospital } from "@/lib/data-sources/hospitals";
import type { WeatherContext } from "@/lib/data-sources/weather";
import type { CitizenReport } from "@/lib/reports-store";

declare global {
  interface Window { maplibregl?: any }
}

const VIT_CHENNAI = {
  name: "VIT Chennai (Base Hub)",
  lng: 80.1534,
  lat: 12.8406,
};

const KNOWN_DESTINATIONS: Record<string, { name: string; lng: number; lat: number }> = {
  central: { name: "Chennai Central", lng: 80.2757, lat: 13.0827 },
  "chennai central": { name: "Chennai Central", lng: 80.2757, lat: 13.0827 },
  velachery: { name: "Velachery, Chennai", lng: 80.218, lat: 12.9815 },
  tambaram: { name: "Tambaram, Chennai", lng: 80.1000, lat: 12.9249 },
  madipakkam: { name: "Madipakkam, Chennai", lng: 80.1983, lat: 12.9647 },
  guindy: { name: "Guindy, Chennai", lng: 80.2026, lat: 13.0067 },
  adyar: { name: "Adyar, Chennai", lng: 80.2565, lat: 13.0012 },
  "t nagar": { name: "T Nagar, Chennai", lng: 80.2341, lat: 13.0418 },
  "t. nagar": { name: "T Nagar, Chennai", lng: 80.2341, lat: 13.0418 },
  "thyagaraya nagar": { name: "T Nagar, Chennai", lng: 80.2341, lat: 13.0418 },
  "anna nagar": { name: "Anna Nagar, Chennai", lng: 80.2101, lat: 13.0850 },
  mylapore: { name: "Mylapore, Chennai", lng: 80.2676, lat: 13.0368 },
  porur: { name: "Porur, Chennai", lng: 80.1565, lat: 13.0382 },
  koyambedu: { name: "Koyambedu, Chennai", lng: 80.1948, lat: 13.0694 },
  saidapet: { name: "Saidapet, Chennai", lng: 80.2231, lat: 13.0213 },
  perambur: { name: "Perambur, Chennai", lng: 80.2434, lat: 13.1075 },
  triplicane: { name: "Triplicane, Chennai", lng: 80.2757, lat: 13.0588 },
  nungambakkam: { name: "Nungambakkam, Chennai", lng: 80.2425, lat: 13.0569 },
  thiruvanmiyur: { name: "Thiruvanmiyur, Chennai", lng: 80.2594, lat: 12.9830 },
  kovalam: { name: "Kovalam, Chennai", lng: 80.251, lat: 12.787 },
};

const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css";
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

type SelectedPlace = { name: string; lng: number; lat: number };
const LAYERS: Array<{ key: GccLayerKey; label: string; color: string }> = [
  { key: "roads", label: "Road centre lines", color: "#f6c85f" },
  { key: "buildings", label: "Buildings", color: "#b8c2ce" },
  { key: "drains", label: "Storm-water drains", color: "#4fb6e8" },
  { key: "rivers", label: "Rivers", color: "#397ac0" },
  { key: "wards", label: "Wards", color: "#bb86fc" },
  { key: "zones", label: "Zones", color: "#ff7d91" },
  { key: "bridges", label: "Bridge features", color: "#f08a4b" },
];

interface ChennaiMapProps {
  floodDestination?: string;
  onDestinationChange?: (destination: string) => void;
  focusedReport?: CitizenReport | null;
  onClearFocusedReport?: () => void;
  simulationRoutes?: RouteOption[];
  selectedSimulationRouteIndex?: number;
}

export function ChennaiMap({
  floodDestination = "Chennai Central",
  onDestinationChange,
  focusedReport,
  onClearFocusedReport,
  simulationRoutes,
  selectedSimulationRouteIndex = 0,
}: ChennaiMapProps) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);

  const [destinationInput, setDestinationInput] = useState(floodDestination);
  const [destination, setDestination] = useState<SelectedPlace>({
    name: "Chennai Central",
    lng: 80.2757,
    lat: 13.0827,
  });

  const [enabledLayers, setEnabledLayers] = useState<GccLayerKey[]>(["roads", "drains", "rivers"]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routingStatus, setRoutingStatus] = useState("Calculating route from VIT Chennai Base…");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalStatus, setHospitalStatus] = useState("Loading nearby hospitals in flood zone…");
  const [weather, setWeather] = useState<WeatherContext | null>(null);

  const resolveAndRoute = useCallback(async (targetPlace: string) => {
    const trimmed = targetPlace.trim();
    if (!trimmed) return;
    setRoutingStatus(`Resolving "${trimmed}"…`);

    const lower = trimmed.toLowerCase();
    let matched: SelectedPlace | null = null;
    for (const [key, val] of Object.entries(KNOWN_DESTINATIONS)) {
      if (lower.includes(key)) {
        matched = val;
        break;
      }
    }

    if (!matched) {
      try {
        const clean = trimmed.replace(/(?:,\s*chennai)?(?:,\s*tamil\s*nadu)?$/i, "").trim();
        const url1 = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&viewbox=79.8,13.4,80.4,12.6&bounded=0&q=${encodeURIComponent(clean + ", Tamil Nadu")}`;
        let response = await fetch(url1, { headers: { "User-Agent": "Astra-Chennai-Decision-Twin/1.0" } });
        let data = response.ok ? await response.json() : [];
        if (!data[0]) {
          const url2 = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(clean + ", Chennai, Tamil Nadu")}`;
          response = await fetch(url2, { headers: { "User-Agent": "Astra-Chennai-Decision-Twin/1.0" } });
          data = response.ok ? await response.json() : [];
        }
        if (data[0]) {
          matched = {
            name: data[0].display_name ?? trimmed,
            lng: Number(data[0].lon),
            lat: Number(data[0].lat),
          };
        }
      } catch {
        // fallback
      }
    }

    if (!matched) {
      setRoutingStatus(`Could not locate "${trimmed}". Showing Chennai Central default.`);
      matched = { name: "Chennai Central", lng: 80.2757, lat: 13.0827 };
    }

    setDestination(matched);
    onDestinationChange?.(matched.name);

    // Fetch routes from VIT Chennai to the flood destination
    setRoutingStatus(`Routing from VIT Chennai Base → ${matched.name}…`);
    try {
      const response = await fetch(
        `/api/routes?originLng=${VIT_CHENNAI.lng}&originLat=${VIT_CHENNAI.lat}&destinationLng=${matched.lng}&destinationLat=${matched.lat}`
      );
      if (!response.ok) throw new Error("Route calculation failed");
      const options = (await response.json()) as RouteOption[];
      setRoutes(options);
      if (options.length > 0) {
        const km = (options[0].distanceMeters / 1000).toFixed(1);
        const min = Math.round(options[0].durationSeconds / 60);
        setRoutingStatus(`Found ${options.length} route(s) from VIT Chennai to ${matched.name}: ${km} km · ~${min} min (OSRM standard routing).`);
      } else {
        setRoutingStatus("No driving route returned by routing engine.");
      }
    } catch {
      setRoutes([]);
      setRoutingStatus("Route service unavailable. No substitute route was used.");
    }
  }, [onDestinationChange]);

  // Sync when prop changes
  useEffect(() => {
    if (floodDestination && floodDestination !== destinationInput) {
      setDestinationInput(floodDestination);
      resolveAndRoute(floodDestination);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floodDestination]);

  // Update markers and camera bounds when destination or map readiness changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl || !mapReady) return;

    // Fixed Origin Marker: VIT Chennai
    if (!originMarkerRef.current) {
      originMarkerRef.current = new window.maplibregl.Marker({ color: "#39d4b4" })
        .setLngLat([VIT_CHENNAI.lng, VIT_CHENNAI.lat])
        .setPopup(new window.maplibregl.Popup({ offset: 25 }).setHTML("<b>Fixed Response Base</b><br/>VIT Chennai"))
        .addTo(map);
    }

    // Flood Incident Marker: Destination
    destinationMarkerRef.current?.remove();
    destinationMarkerRef.current = new window.maplibregl.Marker({ color: "#ff5252" })
      .setLngLat([destination.lng, destination.lat])
      .setPopup(new window.maplibregl.Popup({ offset: 25 }).setHTML(`<b>Flood Incident Zone</b><br/>${destination.name}`))
      .addTo(map);

    // Fit map bounds to show both base and incident site
    const bounds = new window.maplibregl.LngLatBounds();
    bounds.extend([VIT_CHENNAI.lng, VIT_CHENNAI.lat]);
    bounds.extend([destination.lng, destination.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 13.5 });
  }, [destination, mapReady]);

  // Render routes on map (supports simulation candidate routes or default routes)
  const activeRoutes = simulationRoutes && simulationRoutes.length > 0 ? simulationRoutes : routes;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (let index = 0; index < 6; index += 1) {
      const id = `route-option-${index}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
    activeRoutes.forEach((route, index) => {
      const id = `route-option-${index}`;
      if (!route.geometry || (typeof route.geometry === "object" && Object.keys(route.geometry).length === 0)) return;
      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: route.geometry },
      });
      const isSelected = index === selectedSimulationRouteIndex;
      map.addLayer({
        id,
        type: "line",
        source: id,
        paint: {
          "line-color": isSelected ? "#39d4b4" : "#f6c85f",
          "line-width": isSelected ? 6 : 3,
          "line-opacity": isSelected ? 0.95 : 0.65,
        },
      });
    });
  }, [activeRoutes, mapReady, selectedSimulationRouteIndex]);

  // Handle focused citizen report inspection from Emergency Alerts desk
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl || !mapReady) return;

    if (!focusedReport) {
      // Remove citizen route if it exists
      if (map.getLayer("citizen-focused-route")) map.removeLayer("citizen-focused-route");
      if (map.getSource("citizen-focused-route")) map.removeSource("citizen-focused-route");
      return;
    }

    // Fly camera and position markers for citizen report
    const citizenLng = focusedReport.location.lng;
    const citizenLat = focusedReport.location.lat;
    const destLng = focusedReport.destination?.lng ?? citizenLng;
    const destLat = focusedReport.destination?.lat ?? citizenLat;

    // Draw citizen route geometry if provided
    const routeId = "citizen-focused-route";
    if (map.getLayer(routeId)) map.removeLayer(routeId);
    if (map.getSource(routeId)) map.removeSource(routeId);

    if (focusedReport.routeGeometry && focusedReport.routeGeometry.length > 1) {
      map.addSource(routeId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: focusedReport.routeGeometry,
          },
        },
      });
      map.addLayer({
        id: routeId,
        type: "line",
        source: routeId,
        paint: {
          "line-color": "#39d4b4",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
    }

    // Fit map bounds to citizen location and destination
    const bounds = new window.maplibregl.LngLatBounds();
    bounds.extend([citizenLng, citizenLat]);
    bounds.extend([destLng, destLat]);
    map.fitBounds(bounds, { padding: 90, maxZoom: 14 });
  }, [focusedReport, mapReady]);

  // Load GCC GIS Layers around the flood destination
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl || !mapReady) return;
    let cancelled = false;
    async function loadLayers() {
      setLoadingLayers(true);
      for (const config of LAYERS) {
        const sourceId = `gcc-${config.key}`;
        const lineId = `${sourceId}-line`;
        const fillId = `${sourceId}-fill`;
        if (!enabledLayers.includes(config.key)) {
          if (map.getLayer(lineId)) map.removeLayer(lineId);
          if (map.getLayer(fillId)) map.removeLayer(fillId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
          continue;
        }
        try {
          const response = await fetch(
            `/api/gis?layer=${config.key}&lat=${destination.lat}&lng=${destination.lng}&radiusKm=${radiusKm}`
          );
          if (!response.ok) throw new Error("GIS request failed");
          const data = (await response.json()) as GeoFeatureCollection;
          if (cancelled) return;
          if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as any).setData(data);
            continue;
          }
          map.addSource(sourceId, { type: "geojson", data });
          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": config.color,
              "line-width": config.key === "roads" ? 1.6 : 2,
              "line-opacity": 0.85,
            },
          });
          map.addLayer({
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": config.color,
              "fill-opacity": config.key === "buildings" ? 0.13 : 0.08,
            },
          });
        } catch {
          // ignore individual layer fails
        }
      }
      if (!cancelled) setLoadingLayers(false);
    }
    loadLayers();
    return () => { cancelled = true; };
  }, [destination, enabledLayers, mapReady, radiusKm]);

  // Find hospitals in the flood zone
  useEffect(() => {
    let cancelled = false;
    async function findHospitals() {
      try {
        const delta = 0.12;
        const viewbox = `${destination.lng - delta},${destination.lat + delta},${destination.lng + delta},${destination.lat - delta}`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&bounded=1&viewbox=${viewbox}&q=hospital`,
          { headers: { "User-Agent": "Astra-Chennai-Decision-Twin/1.0" } }
        );
        if (!response.ok) throw new Error("Hospital search unavailable");
        const matches = (await response.json()) as Array<{ place_id: number; display_name: string; lat: string; lon: string }>;
        const found: Hospital[] = matches.map((m) => ({
          id: `nom-${m.place_id}`,
          name: m.display_name.split(",")[0] || "Unnamed hospital",
          latitude: Number(m.lat),
          longitude: Number(m.lon),
          address: m.display_name,
          phone: null,
          source: "OpenStreetMap / Nominatim",
          retrievedAt: new Date().toISOString(),
          confidence: 0.5,
        }));
        if (!cancelled) {
          setHospitals(found.slice(0, 4));
          setHospitalStatus(found.length ? `Found facilities near ${destination.name}` : "No hospital records in immediate vicinity.");
        }
      } catch {
        if (!cancelled) {
          setHospitals([]);
          setHospitalStatus("Hospital discovery unavailable. No substitute facilities were shown.");
        }
      }
    }
    findHospitals();
    return () => { cancelled = true; };
  }, [destination]);

  // Load weather in the flood zone
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/weather?lat=${destination.lat}&lng=${destination.lng}`)
      .then((r) => (r.ok ? (r.json() as Promise<WeatherContext>) : Promise.reject()))
      .then((d) => { if (!cancelled) setWeather(d); })
      .catch(() => { if (!cancelled) setWeather(null); });
    return () => { cancelled = true; };
  }, [destination]);

  // Initialize MapLibre
  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = MAPLIBRE_CSS;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = () => {
      if (!mapNode.current || !window.maplibregl) return;
      const map = new window.maplibregl.Map({
        container: mapNode.current,
        style: BASEMAP_STYLE,
        center: [VIT_CHENNAI.lng, VIT_CHENNAI.lat],
        zoom: 11,
        attributionControl: true,
      });
      map.addControl(new window.maplibregl.NavigationControl(), "top-right");
      map.on("load", () => {
        setMapReady(true);
        resolveAndRoute(destinationInput);
      });
      mapRef.current = map;
    };
    document.head.appendChild(script);

    return () => {
      mapRef.current?.remove();
      script.remove();
      css.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    resolveAndRoute(destinationInput);
  }

  function handleQuickPick(place: string) {
    setDestinationInput(place);
    resolveAndRoute(place);
  }

  function toggleLayer(layer: GccLayerKey) {
    setEnabledLayers((cur) => (cur.includes(layer) ? cur.filter((item) => item !== layer) : [...cur, layer]));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#23354d] bg-[#0d1b2d] shadow-2xl shadow-black/20">
      {/* Active Citizen Report Inspection Header */}
      {focusedReport && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-500/80 bg-red-950/70 p-4 text-xs text-red-100 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-bounce">🚨</span>
            <div>
              <p className="font-bold text-white text-sm">
                INSPECTING CITIZEN EMERGENCY: {focusedReport.id}
              </p>
              <p className="text-xs text-red-200 mt-0.5">
                Citizen GPS: <b>{focusedReport.location.name}</b> → Target: <b>{focusedReport.destination?.name || "Local Refuge"}</b>
                {" · "}{focusedReport.peopleCount} person(s) · {focusedReport.waterLevel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearFocusedReport}
            className="rounded-lg bg-red-600 px-3.5 py-2 font-bold text-white shadow-md shadow-red-600/30 hover:bg-red-500"
          >
            ✖ Exit Citizen View / Return to Hub
          </button>
        </div>
      )}

      {/* Route Header with Fixed Origin and Single Flood Location Input */}
      <div className="border-b border-[#23354d] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[.14em] text-[#39d4b4]">AUTOMATIC RESCUE ROUTE</p>
            <h3 className="mt-1 text-lg font-semibold text-[#e6edf7]">
              Fixed Base: <span className="text-[#39d4b4]">VIT Chennai</span> → Flood Zone: <span className="text-[#ff7d7d]">{destination.name}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#39506e] bg-[#07111f] px-3 py-1.5 text-xs text-[#9aabc1]">
            <span className="h-2 w-2 rounded-full bg-[#39d4b4]" />
            <span>Origin permanently fixed at <b>VIT Chennai Hub</b></span>
          </div>
        </div>

        {/* Flood Destination Input with Quick Suggestions */}
        <form onSubmit={handleFormSubmit} className="mt-4 flex flex-wrap gap-2">
          <div className="flex min-w-[280px] flex-1 items-center rounded-lg border border-[#39506e] bg-[#07111f] px-3 py-1 text-sm focus-within:border-[#39d4b4]">
            <span className="mr-2 text-xs font-medium text-[#9aabc1]">Flood Location:</span>
            <input
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              placeholder="e.g. Central, Velachery, Tambaram"
              className="w-full bg-transparent py-1.5 text-sm text-[#e6edf7] outline-none placeholder:text-[#667b95]"
            />
          </div>
          <button type="submit" className="rounded-lg bg-[#39d4b4] px-5 py-2.5 text-sm font-semibold text-[#062019] transition-opacity hover:opacity-90">
            Find Route
          </button>
        </form>

        {/* Quick Location Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#9aabc1]">Quick incident spots:</span>
          {["Chennai Central", "Velachery", "Tambaram", "Guindy", "Kovalam"].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleQuickPick(name)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                destination.name.toLowerCase().includes(name.toLowerCase())
                  ? "border-[#ff7d7d] bg-[#ff7d7d]/20 text-[#ffb4b4]"
                  : "border-[#39506e] bg-[#07111f] text-[#9aabc1] hover:border-[#39d4b4]/60"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Route Status and Metrics */}
        <p className="mt-3 text-xs text-[#9aabc1]">{routingStatus}</p>
        {routes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {routes.map((route, index) => (
              <div
                key={route.id}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  index === 0
                    ? "border-[#39d4b4]/60 bg-[#0b292d] text-[#69e8d1]"
                    : "border-[#23354d] bg-[#10233a] text-[#f6c85f]"
                }`}
              >
                <b>{index === 0 ? "🏆 Recommended Best Route" : `Alternative ${index}`}</b>
                <span className="ml-2 font-mono text-[#e6edf7]">
                  {(route.distanceMeters / 1000).toFixed(1)} km · ~{Math.round(route.durationSeconds / 60)} min
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GIS Overlays Layer Bar */}
      <div className="border-b border-[#23354d] px-5 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#b6c4d5]">
            GCC GIS overlays in flood zone {loadingLayers ? "· loading…" : "· verified source"}
          </p>
          <label className="flex items-center gap-2 text-xs text-[#9aabc1]">
            Study radius
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="rounded border border-[#39506e] bg-[#07111f] px-2 py-1 text-[#e6edf7]"
            >
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={20}>20 km</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {LAYERS.map((layer) => (
            <label key={layer.key} className="flex cursor-pointer items-center gap-2 text-xs text-[#9aabc1]">
              <input
                checked={enabledLayers.includes(layer.key)}
                onChange={() => toggleLayer(layer.key)}
                type="checkbox"
                className="accent-[#39d4b4]"
              />
              {layer.label}
            </label>
          ))}
        </div>
      </div>

      {/* Nearby Hospitals in Flood Zone */}
      <div className="border-b border-[#23354d] p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Hospitals in Flood Zone ({destination.name})</p>
          <span className="text-xs text-[#9aabc1]">{hospitalStatus}</span>
        </div>
        {hospitals.length > 0 ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {hospitals.map((h) => (
              <article key={h.id} className="rounded-lg bg-[#10233a] p-3 text-xs">
                <p className="font-medium text-[#e6edf7]">{h.name}</p>
                <p className="mt-1 text-[#9aabc1]">{h.address ?? "Address not returned"}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[#9aabc1]">No facilities found nearby.</p>
        )}
      </div>

      {/* Map View */}
      <div className="relative h-[480px] bg-[#10233a]">
        <div ref={mapNode} className="h-full w-full" />
        <div className="absolute bottom-5 left-5 max-w-xs rounded-xl border border-[#39506e] bg-[#07111f]/95 p-4 shadow-xl">
          <p className="text-xs font-medium tracking-[.12em] text-[#39d4b4]">ORIGIN → DESTINATION</p>
          <p className="mt-1 text-xs text-[#e6edf7]">
            <b>Base:</b> VIT Chennai <span className="font-mono text-[11px] text-[#9aabc1]">(12.8406, 80.1534)</span>
          </p>
          <p className="mt-1 text-xs text-[#e6edf7]">
            <b>Incident:</b> {destination.name}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#9aabc1]">
            Showing direct corridor route from VIT Chennai response center to the flood site.
          </p>
        </div>
      </div>
    </section>
  );
}
