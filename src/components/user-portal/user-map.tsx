"use client";

import { useEffect, useRef } from "react";
import type { SafeRouteEvaluation } from "@/app/api/routes/safe/route";

declare global {
  interface Window { maplibregl?: any }
}

const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css";
const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

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

  // Load MapLibre script and initialize
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
        center: [userLocation.lng, userLocation.lat],
        zoom: 12.5,
        attributionControl: true,
      });
      map.addControl(new window.maplibregl.NavigationControl(), "top-right");
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
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-[#23354d] bg-[#07111f]">
      <div ref={mapNode} className="h-full w-full" />
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 rounded-lg border border-[#39506e]/80 bg-[#07111f]/90 p-2.5 text-xs shadow-lg backdrop-blur-sm">
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
  );
}
