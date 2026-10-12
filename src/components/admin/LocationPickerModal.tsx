"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { SvgMap, type HtmlPin, type SvgMapHandle } from "@/components/site/SvgMap";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { project, unproject, zoomToScale } from "@/lib/svgMap/projection";

// Casco Viejo, Panama City — same default as the public SpotMap.
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];

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
  const mapRef = useRef<SvgMapHandle | null>(null);

  // The admin has no Night Mode toggle — just follow the OS scheme.
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Opens centered on the pin, closer in when there's a real position.
  useEffect(() => {
    mapRef.current?.flyTo(project(start[0], start[1]), {
      scale: zoomToScale(hasInitial ? 17 : 15),
      animate: false,
    });
    // Once, with the modal's opening position — later changes go through
    // applyPosition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Single source of truth for a new pin position — updates state and the
   * text inputs; `moveMap` also re-centers the map (skipped when the change
   * already came from a map click/drag, which placed the pin itself). */
  const applyPosition = (newLat: number, newLng: number, moveMap: boolean) => {
    setPosition([newLat, newLng]);
    setLatInput(newLat.toFixed(6));
    setLngInput(newLng.toFixed(6));
    if (moveMap) {
      mapRef.current?.flyTo(project(newLat, newLng), { minScale: zoomToScale(16) });
    }
  };

  const [pinX, pinY] = project(position[0], position[1]);
  const pin: HtmlPin = {
    id: "picked",
    x: pinX,
    y: pinY,
    width: 34,
    height: 34,
    anchor: [17, 34],
    className: "spot-pin-marker",
    draggable: true,
    node: (
      <span className="spot-pin" style={{ background: "#ff6b35" }}>
        <span className="spot-pin__emoji">📍</span>
      </span>
    ),
  };

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
            <SvgMap
              ref={mapRef}
              dark={prefersDark}
              htmlPins={[pin]}
              onReady={() => setReady(true)}
              onBackgroundClick={(pt) => {
                const [lat, lng] = unproject(pt[0], pt[1]);
                applyPosition(lat, lng, false);
              }}
              onPinDragEnd={(_id, pt) => {
                const [lat, lng] = unproject(pt[0], pt[1]);
                applyPosition(lat, lng, false);
              }}
              className="h-full w-full"
            />
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
