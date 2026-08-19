"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LeafletMouseEvent, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

// Casco Viejo, Panama City — same default as the public SpotMap.
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];

const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

const pinHtml = `<span class="spot-pin" style="background:#ff6b35"><span class="spot-pin__emoji">📍</span></span>`;

export interface LocationPickerLabels {
  title: string;
  hint: string;
  latitude: string;
  longitude: string;
  cancel: string;
  confirm: string;
  close: string;
}

/**
 * Modal opened by the "Locate on map" button in admin forms (spots and
 * events alike — labels are passed in so each caller can use its own
 * translation namespace). Two ways to set a location, kept in sync: paste
 * lat/lng directly, or tap/drag the pin on the map.
 */
export function LocationPickerModal({
  lat,
  lng,
  labels,
  onConfirm,
  onClose,
}: {
  lat?: number | null;
  lng?: number | null;
  labels: LocationPickerLabels;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const hasInitial =
    typeof lat === "number" && !Number.isNaN(lat) && typeof lng === "number" && !Number.isNaN(lng);
  const start: [number, number] = hasInitial ? [lat as number, lng as number] : DEFAULT_CENTER;

  const [position, setPosition] = useState<[number, number]>(start);
  const [latInput, setLatInput] = useState(start[0].toFixed(6));
  const [lngInput, setLngInput] = useState(start[1].toFixed(6));
  const [ready, setReady] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  /** Single source of truth for a new pin position — updates state and the
   * text inputs; `moveMap` also re-centers the marker/map (skipped when the
   * change already came from a map click/drag, which placed it itself). */
  const applyPosition = (newLat: number, newLng: number, moveMap: boolean) => {
    setPosition([newLat, newLng]);
    setLatInput(newLat.toFixed(6));
    setLngInput(newLng.toFixed(6));
    if (moveMap && mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
      mapRef.current.flyTo([newLat, newLng], Math.max(mapRef.current.getZoom(), 16), {
        duration: 0.6,
      });
    }
  };

  // Init the map once, client-side only.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: start,
        zoom: hasInitial ? 17 : 15,
      });

      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      L.tileLayer(prefersDark ? DARK_TILES : LIGHT_TILES, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 20,
      }).addTo(map);

      const icon = L.divIcon({
        className: "spot-pin-marker",
        html: pinHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });
      const marker = L.marker(start, { icon, draggable: true }).addTo(map);

      marker.on("dragend", () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng();
        applyPosition(newLat, newLng, false);
      });
      map.on("click", (e: LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        applyPosition(e.latlng.lat, e.latlng.lng, false);
      });

      markerRef.current = marker;
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map is created once with the modal's opening position — later position
    // changes flow through the refs, not a re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const commitTypedCoords = () => {
    const parsedLat = parseFloat(latInput);
    const parsedLng = parseFloat(lngInput);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return;
    applyPosition(parsedLat, parsedLng, true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: "100%", opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-heading text-base font-bold">{labels.title}</h2>
            <p className="text-xs text-foreground/50">{labels.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="relative h-64 w-full overflow-hidden rounded-[var(--radius-button)] border border-border sm:h-80">
            <div ref={containerRef} className="h-full w-full" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-aqua/10 to-coral/10">
                <Loader2 className="animate-spin text-aqua" size={22} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="picker-lat">{labels.latitude}</Label>
              <Input
                id="picker-lat"
                type="number"
                step="0.000001"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                onBlur={commitTypedCoords}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTypedCoords();
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="picker-lng">{labels.longitude}</Label>
              <Input
                id="picker-lng"
                type="number"
                step="0.000001"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                onBlur={commitTypedCoords}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTypedCoords();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={() => onConfirm(position[0], position[1])}
          >
            {labels.confirm}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
