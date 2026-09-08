"use client";

import { useEffect, useRef, useState } from "react";
import type { SafeRouteEvaluation } from "@/app/api/routes/safe/route";

declare global {
  interface Window { maplibregl?: any }
}

const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css";
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const FALLBACK_OSM_STYLE = {
  version: 8,
  sources: {
    "osm-raster-tiles": {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

interface UserMapProps {
  userLocation: { lat: number; lng: number; name: string; accuracy?: number };
  destination: { lat: number; lng: number; name: string } | null;
  routes: SafeRouteEvaluation[];
  recommendedRoute: SafeRouteEvaluation | null;
  hospitals?: Array<{ name: string; distanceKm: number | null; travelMinutes: number | null }>;
}

export function UserMap({
  userLocation,
  destination,
  routes,
  recommendedRoute,
  hospitals = [],
}: UserMapProps) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const hospitalMarkersRef = useRef<any[]>([]);

  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastTelemetryUpdate, setLastTelemetryUpdate] = useState<string>(() => new Date().toLocaleTimeString());

  // Load MapLibre script and initialize with fallback and error guard
  useEffect(() => {
    let isCancelled = false;
    let styleTimeout: any = null;
    let resizeObserver: ResizeObserver | null = null;

    function initMap() {
      if (!mapNode.current || !window.maplibregl || isCancelled) return;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }

      setMapLoading(true);
      setMapError(null);

      try {
        const map = new window.maplibregl.Map({
          container: mapNode.current,
          style: BASEMAP_STYLE,
          center: [userLocation.lng, userLocation.lat],
          zoom: 12.5,
          attributionControl: true,
        });

        styleTimeout = setTimeout(() => {
          if (!isCancelled && mapRef.current && !mapRef.current.isStyleLoaded()) {
            console.warn("[UserMap] Style load timeout, falling back to OSM raster tiles");
            try {
              mapRef.current.setStyle(FALLBACK_OSM_STYLE as any);
            } catch (err) {
              console.error("[UserMap] Fallback style switch error", err);
            }
          }
        }, 5000);

        map.on("error", (e: any) => {
          console.warn("[UserMap] Map tile/style warning:", e?.error?.message || e);
          if (!isCancelled && mapRef.current && !mapRef.current.isStyleLoaded()) {
            try {
              mapRef.current.setStyle(FALLBACK_OSM_STYLE as any);
            } catch {
              setMapError("Vector tile network unavailable. Offline telemetry mode active.");
              setMapLoading(false);
            }
          }
        });

        map.on("load", () => {
          if (styleTimeout) clearTimeout(styleTimeout);
          if (isCancelled) return;
          setMapLoading(false);
          setMapError(null);
          setLastTelemetryUpdate(new Date().toLocaleTimeString());
        });

        map.addControl(new window.maplibregl.NavigationControl(), "top-right");
        mapRef.current = map;

        if (typeof ResizeObserver !== "undefined" && mapNode.current) {
          resizeObserver = new ResizeObserver(() => {
            if (mapRef.current) {
              mapRef.current.resize();
            }
          });
          resizeObserver.observe(mapNode.current);
        }
      } catch (err: any) {
        console.error("[UserMap] Initialization error:", err);
        setMapError("WebGL map canvas failed to initialize. Displaying direct route telemetry.");
        setMapLoading(false);
      }
    }

    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = MAPLIBRE_CSS;
      document.head.appendChild(css);
    }

    if (window.maplibregl) {
      initMap();
    } else if (!document.querySelector(`script[src="${MAPLIBRE_JS}"]`)) {
      const script = document.createElement("script");
      script.src = MAPLIBRE_JS;
      script.async = true;
      script.onload = () => {
        initMap();
      };
      script.onerror = () => {
        setMapLoading(false);
        setMapError("Failed to load MapLibre library. Direct route telemetry active.");
      };
      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.maplibregl) {
          clearInterval(checkInterval);
          initMap();
        }
      }, 50);
      return () => {
        isCancelled = true;
        clearInterval(checkInterval);
        if (styleTimeout) clearTimeout(styleTimeout);
        if (resizeObserver) resizeObserver.disconnect();
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }

    return () => {
      isCancelled = true;
      if (styleTimeout) clearTimeout(styleTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  // Update user GPS marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    userMarkerRef.current?.remove();
    const el = document.createElement("div");
    el.className = "flex items-center justify-center";
    el.innerHTML = `
      <div class="relative flex h-7 w-7 items-center justify-center">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39d4b4] opacity-75"></span>
        <span class="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-[#00e5a3]"></span>
      </div>
    `;

    userMarkerRef.current = new window.maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .setPopup(
        new window.maplibregl.Popup({ offset: 15 }).setHTML(
          `<b>Your Exact GPS Location</b><br/>${userLocation.name}${userLocation.accuracy ? `<br/><span class="text-xs text-gray-500">±${Math.round(userLocation.accuracy)}m accuracy</span>` : ""}`
        )
      )
      .addTo(map);

    if (!destination) {
      map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14 });
    }
  }, [userLocation, destination]);

  // Update destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    destMarkerRef.current?.remove();
    if (destination) {
      destMarkerRef.current = new window.maplibregl.Marker({ color: "#ff5252" })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(
          new window.maplibregl.Popup({ offset: 25 }).setHTML(`<b>Destination</b><br/>${destination.name}`)
        )
        .addTo(map);
    }
  }, [destination]);

  // Render safe route & alternatives on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clean old route layers
    for (let i = 0; i < 4; i++) {
      const id = `user-route-${i}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }

    if (!routes.length) return;

    routes.forEach((route, idx) => {
      const id = `user-route-${idx}`;
      const isBest = route.isRecommended;

      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: route.geometry },
      });

      map.addLayer({
        id,
        type: "line",
        source: id,
        paint: {
          "line-color": isBest ? "#39d4b4" : "#f6c85f",
          "line-width": isBest ? 6 : 3,
          "line-opacity": isBest ? 0.95 : 0.65,
        },
      });
    });

    // Fit bounds to cover both GPS and Destination
    if (destination && window.maplibregl) {
      const bounds = new window.maplibregl.LngLatBounds();
      bounds.extend([userLocation.lng, userLocation.lat]);
      bounds.extend([destination.lng, destination.lat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [routes, userLocation, destination]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[420px] min-h-[420px] w-full overflow-hidden rounded-xl border border-[#23354d] bg-[#07111f]">
        <div
          ref={mapNode}
          className="h-full w-full min-h-[420px]"
          style={{ minHeight: "420px", width: "100%", height: "420px" }}
        />

        {/* Loading Overlay */}
        {mapLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#07111f]/85 backdrop-blur-sm p-6 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#39d4b4] border-t-transparent mb-3" />
            <p className="text-sm font-bold text-white">Initializing Map & Evacuation Corridors…</p>
            <p className="text-xs text-[#9aabc1] mt-1">Connecting to OpenFreeMap / OpenStreetMap spatial layers</p>
          </div>
        )}

        {/* Map Error Banner & Retry Button */}
        {mapError && (
          <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/50 bg-[#1e0a0a]/90 p-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <div>
                <p className="text-xs font-bold text-red-200">Map Visual Notice</p>
                <p className="text-[11px] text-red-300/80">{mapError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMapError(null);
                setMapLoading(true);
                setRetryCount((c: number) => c + 1);
              }}
              className="rounded-lg bg-red-600/80 px-3 py-1 text-xs font-bold text-white hover:bg-red-500 transition shadow"
            >
              🔄 Retry Map
            </button>
          </div>
        )}

        {/* Map Legend Badge */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 rounded-lg border border-[#39506e]/80 bg-[#07111f]/90 p-2.5 text-xs shadow-lg backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-white bg-[#00e5a3]" />
            <span className="text-[#e6edf7]">Your Current GPS Position</span>
          </div>
          {destination && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5252]" />
              <span className="text-[#e6edf7]">Target Destination</span>
            </div>
          )}
          {recommendedRoute && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-4 rounded-full bg-[#39d4b4]" />
              <span className="text-[#39d4b4] font-semibold">Recommended Safest Route</span>
            </div>
          )}
          {routes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="h-1 w-4 rounded-full bg-[#f6c85f]" />
              <span className="text-[#f6c85f]">Alternative (Higher Risk)</span>
            </div>
          )}
        </div>
      </div>

      {/* Robust Text Fallback Card (Ensures full usability even if WebGL/Map fails) */}
      <div className="rounded-xl border border-[#23354d] bg-[#07111f] p-4 text-xs text-[#e6edf7]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#39d4b4]" />
            <span className="font-bold tracking-wide text-xs text-[#69e8d1]">EVACUATION ROUTE & COORDINATE TELEMETRY</span>
          </div>
          <span className="text-[11px] text-[#9aabc1]">Telemetry Last Updated: <b className="text-white">{lastTelemetryUpdate}</b></span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-lg border border-[#1b2b40] bg-[#0d1b2d] p-2.5">
            <p className="text-[10px] font-semibold tracking-wider text-[#9aabc1] uppercase">Your GPS Location</p>
            <p className="mt-1 font-bold text-white truncate" title={userLocation.name}>{userLocation.name}</p>
            <p className="font-mono text-[11px] text-[#39d4b4]">{userLocation.lat.toFixed(4)}° N, {userLocation.lng.toFixed(4)}° E</p>
          </div>

          <div className="rounded-lg border border-[#1b2b40] bg-[#0d1b2d] p-2.5">
            <p className="text-[10px] font-semibold tracking-wider text-[#9aabc1] uppercase">Destination Zone</p>
            <p className="mt-1 font-bold text-white truncate" title={destination?.name || "None Selected"}>
              {destination ? destination.name : "Select or search safe refuge"}
            </p>
            <p className="font-mono text-[11px] text-[#ff7d7d]">
              {destination ? `${destination.lat.toFixed(4)}° N, ${destination.lng.toFixed(4)}° E` : "Awaiting selection"}
            </p>
          </div>

          <div className="rounded-lg border border-[#1b2b40] bg-[#0d1b2d] p-2.5">
            <p className="text-[10px] font-semibold tracking-wider text-[#9aabc1] uppercase">Estimated Route Distance</p>
            <p className="mt-1 font-bold text-white">
              {recommendedRoute ? `${recommendedRoute.distanceKm.toFixed(1)} km` : (routes[0] ? `${routes[0].distanceKm.toFixed(1)} km` : "Pending route selection")}
            </p>
            <p className="text-[11px] text-[#f6c85f]">
              {recommendedRoute ? `~${recommendedRoute.durationMinutes} min travel time` : (routes[0] ? `~${routes[0].durationMinutes} min` : "OSRM engine standby")}
            </p>
          </div>

          <div className="rounded-lg border border-[#1b2b40] bg-[#0d1b2d] p-2.5">
            <p className="text-[10px] font-semibold tracking-wider text-[#9aabc1] uppercase">Helpline & Relief Support</p>
            <p className="mt-1 font-bold text-[#39d4b4]">GCC Emergency: 1913</p>
            <p className="text-[11px] text-[#9aabc1]">Tamil Nadu Relief: 1070</p>
          </div>
        </div>

        {mapError && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200 text-[11px] flex items-center gap-2">
            <span>ℹ️</span>
            <span>Visual map stream unavailable, but your exact GPS location, destination distance, and route navigation calculations remain 100% active.</span>
          </div>
        )}
      </div>
    </div>
  );
}
