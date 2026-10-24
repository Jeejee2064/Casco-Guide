"use client";

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { paletteFor } from "@/lib/cascoMap";
import { loadSvgBasemap, type SvgBasemapData } from "@/lib/svgMap/basemap";
import { zoomToScale, type WorldPoint } from "@/lib/svgMap/projection";
import { cn } from "@/lib/utils";

/**
 * Pure-SVG map engine — no tiles, no Leaflet. The whole map (basemap, route,
 * pins) lives inside ONE <g> whose `matrix(k 0 0 k x y)` is rewritten once per
 * animation frame from a single camera {x, y, k}. Because every layer is a
 * child of that same group and is moved by the same write, nothing can drift
 * apart while zooming or panning. Two details keep it honest:
 *
 *  - strokes use `vector-effect: non-scaling-stroke` (see globals.css's
 *    `.svgmap-line`), so lines stay the same pixel width at every zoom;
 *  - pins are placed with `translate(x, y) scale(var(--ik))`, where `--ik` is
 *    1/k written on the <svg> in the same frame, so they follow the map
 *    exactly but keep a constant on-screen size.
 *
 * Camera state never touches React — gestures, wheel smoothing, inertia and
 * fly-to animations all run in one requestAnimationFrame loop.
 */

export interface SvgPin {
  id: string;
  /** World position (see lib/svgMap/projection.ts). */
  x: number;
  y: number;
  label: string;
  /** Drawn centered on the pin's origin, in screen pixels. */
  node: ReactNode;
  onSelect: () => void;
}

/** A pin drawn as plain HTML (rich pins with CSS animation, icons, popups…).
 * Positioned from the same camera, in the same animation frame, as the SVG —
 * so it can't drift either. `x`/`y` is the world point the pin's `anchor`
 * (px offset inside its width x height box) sits on. */
export interface HtmlPin {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: [number, number];
  /** Classes on the positioned wrapper (z-index, hover, state modifiers). */
  className?: string;
  label?: string;
  node: ReactNode;
  onSelect?: () => void;
  /** Fired on hover / press, just ahead of `onSelect` — a cheap hook to warm
   * whatever the selection is about to show (see preloadPhoto). */
  onPreview?: () => void;
  /** Can be dragged with the mouse/finger; see `onPinDragEnd`. */
  draggable?: boolean;
}

export interface ViewPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SvgMapHandle {
  /** `bounds` is [minX, minY, maxX, maxY] in world units. */
  fitBounds(
    bounds: [number, number, number, number],
    opts?: { padding?: number | ViewPadding; maxScale?: number; animate?: boolean },
  ): void;
  /** Pans (animated) just enough to bring `point` inside the padded view. */
  panInside(point: WorldPoint, padding: ViewPadding): void;
  zoomBy(factor: number): void;
  /** Centers `point`; `scale` sets an exact zoom, `minScale` only zooms in. */
  flyTo(
    point: WorldPoint,
    opts?: { scale?: number; minScale?: number; animate?: boolean },
  ): void;
}

// Where each HTML pin currently is in world space. Read by the camera loop
// every frame, so it lives outside React.
const pinPos = new WeakMap<HTMLElement, WorldPoint>();

const ZOOM0_SCALE = zoomToScale(0);
const MIN_SCALE = zoomToScale(14);
const MAX_SCALE = zoomToScale(19);
const DRAG_THRESHOLD = 6; // px before a press becomes a pan
const DOUBLE_TAP_MS = 300;

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** The static layers. Memoized so a pin/route re-render never re-diffs the
 * multi-hundred-KB path strings. */
const Basemap = memo(function Basemap({
  data,
  dark,
}: {
  data: SvgBasemapData;
  dark: boolean;
}) {
  const p = paletteFor(dark);
  return (
    <>
      <path d={data.water} fill={p.waterFill} fillRule="evenodd" />
      <path
        className="svgmap-line"
        d={data.streets}
        fill="none"
        stroke={p.streetColor}
        strokeOpacity={p.streetOpacity}
        strokeWidth={1}
      />
      <path d={data.buildings} fill={p.buildingFill} fillRule="evenodd" />
    </>
  );
});

export const SvgMap = forwardRef<
  SvgMapHandle,
  {
    dark: boolean;
    /** false: no pan/zoom gestures and the page can scroll over the map
     * (touch-action: pan-y); pins and background taps still work. */
    interactive?: boolean;
    /** +/- buttons (default true — they work even when gestures are off). */
    controls?: boolean;
    pins?: SvgPin[];
    htmlPins?: HtmlPin[];
    /** Extra world-space SVG (route lines etc.), drawn under the pins. */
    children?: ReactNode;
    /** A tap on empty map, with the world point that was tapped. */
    onBackgroundClick?: (point: WorldPoint) => void;
    /** A draggable HTML pin was released at this world point. */
    onPinDragEnd?: (id: string, point: WorldPoint) => void;
    /** Fires once the basemap has loaded. */
    onReady?: () => void;
    /** Web-map zoom level, reported only when it moves to a new quarter-step
     * (never per frame), so React can swap pins for clusters/dots. */
    onZoomChange?: (zoom: number) => void;
    className?: string;
  }
>(function SvgMap(
  {
    dark,
    interactive = true,
    controls = true,
    pins = [],
    htmlPins = [],
    children,
    onBackgroundClick,
    onPinDragEnd,
    onReady,
    onZoomChange,
    className,
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const [basemap, setBasemap] = useState<SvgBasemapData | null>(null);

  // Everything the effect below needs from outside, kept in refs so the
  // gesture loop is set up exactly once per mount.
  const boundsRef = useRef<SvgBasemapData["bounds"] | null>(null);
  const onBgRef = useRef(onBackgroundClick);
  const onDragEndRef = useRef(onPinDragEnd);
  const onReadyRef = useRef(onReady);
  const onZoomRef = useRef(onZoomChange);
  useEffect(() => {
    onZoomRef.current = onZoomChange;
    onBgRef.current = onBackgroundClick;
    onDragEndRef.current = onPinDragEnd;
    onReadyRef.current = onReady;
  }, [onBackgroundClick, onPinDragEnd, onReady, onZoomChange]);
  const apiRef = useRef<SvgMapHandle | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  // Positions one HTML pin from the live camera — set by the effect below,
  // called from a pin's ref callback so a pin is right from its first frame.
  const placeRef = useRef<((el: HTMLElement) => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      fitBounds: (b, o) => apiRef.current?.fitBounds(b, o),
      panInside: (p, pad) => apiRef.current?.panInside(p, pad),
      zoomBy: (f) => apiRef.current?.zoomBy(f),
      flyTo: (p, o) => apiRef.current?.flyTo(p, o),
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadSvgBasemap()
      .then((data) => {
        if (cancelled) return;
        boundsRef.current = data.bounds;
        setBasemap(data);
        onReadyRef.current?.();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    const g = gRef.current;
    const layer = layerRef.current;
    if (!wrap || !svg || !g || !layer) return;

    // ---- camera: screen = world * k + (x, y) ---------------------------
    const cam = { x: 0, y: 0, k: zoomToScale(15) };
    let w = 0;
    let h = 0;
    let dirty = true;
    let raf = 0;
    let lastT = 0;
    let zoomTarget: { k: number; ax: number; ay: number } | null = null;
    let fly: {
      t0: number;
      dur: number;
      from: { cx: number; cy: number; lk: number };
      to: { cx: number; cy: number; lk: number };
    } | null = null;
    let vel: { x: number; y: number } | null = null;
    let pendingFit: (() => void) | null = null;

    const stopMotion = () => {
      zoomTarget = null;
      fly = null;
      vel = null;
    };

    // Keeps the viewport inside the data's bounds; on an axis where the whole
    // world is smaller than the view, centers it instead. Returns which axes
    // got clipped so inertia can die against an edge.
    const clampCamera = () => {
      cam.k = clampNum(cam.k, MIN_SCALE, MAX_SCALE);
      const b = boundsRef.current;
      let hitX = false;
      let hitY = false;
      if (!b || !w || !h) return { hitX, hitY };
      const [minX, minY, maxX, maxY] = b;
      const fitX = (maxX - minX) * cam.k <= w;
      const fitY = (maxY - minY) * cam.k <= h;
      const nx = fitX
        ? (w - (maxX - minX) * cam.k) / 2 - minX * cam.k
        : clampNum(cam.x, w - maxX * cam.k, -minX * cam.k);
      const ny = fitY
        ? (h - (maxY - minY) * cam.k) / 2 - minY * cam.k
        : clampNum(cam.y, h - maxY * cam.k, -minY * cam.k);
      hitX = nx !== cam.x;
      hitY = ny !== cam.y;
      cam.x = nx;
      cam.y = ny;
      return { hitX, hitY };
    };

    const place = (el: HTMLElement) => {
      const p = pinPos.get(el);
      if (!p) return;
      el.style.transform = `translate3d(${p[0] * cam.k + cam.x}px, ${p[1] * cam.k + cam.y}px, 0)`;
    };
    placeRef.current = place;

    // The one write that moves the whole map: SVG group, SVG pin scale, and
    // every HTML pin, all from the same camera in the same frame.
    let lastZoomStep = NaN;
    const paint = () => {
      const zoomStep = Math.round(Math.log2(cam.k / ZOOM0_SCALE) * 4) / 4;
      if (zoomStep !== lastZoomStep) {
        lastZoomStep = zoomStep;
        onZoomRef.current?.(zoomStep);
      }
      g.setAttribute("transform", `matrix(${cam.k} 0 0 ${cam.k} ${cam.x} ${cam.y})`);
      svg.style.setProperty("--ik", String(1 / cam.k));
      for (const el of layer.children) place(el as HTMLElement);
    };

    const zoomAt = (ax: number, ay: number, k: number) => {
      const nk = clampNum(k, MIN_SCALE, MAX_SCALE);
      const wx = (ax - cam.x) / cam.k;
      const wy = (ay - cam.y) / cam.k;
      cam.k = nk;
      cam.x = ax - wx * nk;
      cam.y = ay - wy * nk;
    };

    const tick = (t: number) => {
      raf = 0;
      const dt = lastT ? Math.min(t - lastT, 50) : 16;
      lastT = t;
      let active = false;

      if (fly) {
        const p = clampNum((t - fly.t0) / fly.dur, 0, 1);
        const e = easeInOut(p);
        const cx = fly.from.cx + (fly.to.cx - fly.from.cx) * e;
        const cy = fly.from.cy + (fly.to.cy - fly.from.cy) * e;
        cam.k = Math.exp(fly.from.lk + (fly.to.lk - fly.from.lk) * e);
        cam.x = w / 2 - cx * cam.k;
        cam.y = h / 2 - cy * cam.k;
        if (p >= 1) fly = null;
        else active = true;
        dirty = true;
      }

      if (zoomTarget) {
        // Ease the scale toward the target (in log space, so it feels the
        // same at every zoom), pinned to the cursor/finger the whole way.
        const a = 1 - Math.exp(-dt / 85);
        const next = cam.k * Math.pow(zoomTarget.k / cam.k, a);
        if (Math.abs(Math.log(zoomTarget.k / next)) < 0.0008) {
          zoomAt(zoomTarget.ax, zoomTarget.ay, zoomTarget.k);
          zoomTarget = null;
        } else {
          zoomAt(zoomTarget.ax, zoomTarget.ay, next);
          active = true;
        }
        dirty = true;
      }

      if (vel) {
        cam.x += vel.x * dt;
        cam.y += vel.y * dt;
        const decay = Math.exp(-dt / 325);
        vel.x *= decay;
        vel.y *= decay;
        if (Math.hypot(vel.x, vel.y) < 0.02) vel = null;
        else active = true;
        dirty = true;
      }

      if (dirty) {
        const { hitX, hitY } = clampCamera();
        if (vel) {
          if (hitX) vel.x = 0;
          if (hitY) vel.y = 0;
        }
        paint();
        dirty = false;
      }
      if (active) raf = requestAnimationFrame(tick);
      else lastT = 0;
    };

    const schedule = () => {
      dirty = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    // ---- programmatic moves -------------------------------------------
    const viewCenter = () => ({
      cx: (w / 2 - cam.x) / cam.k,
      cy: (h / 2 - cam.y) / cam.k,
      lk: Math.log(cam.k),
    });

    const flyTo = (to: { cx: number; cy: number; lk: number }, animate: boolean, base = 350) => {
      stopMotion();
      if (!animate) {
        cam.k = Math.exp(to.lk);
        cam.x = w / 2 - to.cx * cam.k;
        cam.y = h / 2 - to.cy * cam.k;
        schedule();
        return;
      }
      const from = viewCenter();
      const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy) * Math.exp(Math.min(from.lk, to.lk));
      const dur = clampNum(base + Math.abs(to.lk - from.lk) * 220 + dist * 0.4, base, 900);
      fly = { t0: performance.now(), dur, from, to };
      schedule();
    };

    const api: SvgMapHandle = {
      fitBounds(b, o) {
        const fn = () => {
          const pad =
            typeof o?.padding === "number"
              ? { top: o.padding, right: o.padding, bottom: o.padding, left: o.padding }
              : (o?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 });
          const bw = Math.max(b[2] - b[0], 1);
          const bh = Math.max(b[3] - b[1], 1);
          const availW = Math.max(w - pad.left - pad.right, 50);
          const availH = Math.max(h - pad.top - pad.bottom, 50);
          const k = clampNum(
            Math.min(availW / bw, availH / bh),
            MIN_SCALE,
            Math.min(MAX_SCALE, o?.maxScale ?? MAX_SCALE),
          );
          // World point that must land at the middle of the padded area.
          const sx = pad.left + availW / 2;
          const sy = pad.top + availH / 2;
          const wx = (b[0] + b[2]) / 2;
          const wy = (b[1] + b[3]) / 2;
          flyTo(
            {
              cx: wx + (w / 2 - sx) / k,
              cy: wy + (h / 2 - sy) / k,
              lk: Math.log(k),
            },
            o?.animate ?? false,
            450,
          );
        };
        if (!w || !h) pendingFit = fn;
        else fn();
      },
      panInside(point, pad) {
        if (!w || !h) return;
        // A map box shorter than its overlay (a small article map under a
        // tall sheet) can't honor the full padding — shrink it to fit.
        const squeeze = (a: number, b: number, size: number): [number, number] => {
          const room = size - 48;
          return a + b > room ? [(a * room) / (a + b), (b * room) / (a + b)] : [a, b];
        };
        const [pt, pb] = squeeze(pad.top, pad.bottom, h);
        const [pl, pr] = squeeze(pad.left, pad.right, w);
        pad = { top: pt, bottom: pb, left: pl, right: pr };
        const sx = point[0] * cam.k + cam.x;
        const sy = point[1] * cam.k + cam.y;
        const dx = sx < pad.left ? pad.left - sx : sx > w - pad.right ? w - pad.right - sx : 0;
        const dy = sy < pad.top ? pad.top - sy : sy > h - pad.bottom ? h - pad.bottom - sy : 0;
        if (!dx && !dy) return;
        const c = viewCenter();
        flyTo({ cx: c.cx - dx / cam.k, cy: c.cy - dy / cam.k, lk: c.lk }, true, 300);
      },
      flyTo(point, o) {
        const fn = () => {
          let k = o?.scale ?? cam.k;
          if (o?.minScale) k = Math.max(k, o.minScale);
          k = clampNum(k, MIN_SCALE, MAX_SCALE);
          flyTo({ cx: point[0], cy: point[1], lk: Math.log(k) }, o?.animate ?? true, 450);
        };
        if (!w || !h) pendingFit = fn;
        else fn();
      },
      zoomBy(factor) {
        vel = null;
        fly = null;
        const base = zoomTarget?.k ?? cam.k;
        zoomTarget = {
          k: clampNum(base * factor, MIN_SCALE, MAX_SCALE),
          ax: w / 2,
          ay: h / 2,
        };
        schedule();
      },
    };
    apiRef.current = api;

    // ---- size ---------------------------------------------------------
    const ro = new ResizeObserver(() => {
      const nw = wrap.clientWidth;
      const nh = wrap.clientHeight;
      if (!nw || !nh) return;
      if (!w || !h) {
        w = nw;
        h = nh;
        cam.x = w / 2;
        cam.y = h / 2;
        const fit = pendingFit;
        pendingFit = null;
        if (fit) fit();
        else schedule();
      } else {
        cam.x += (nw - w) / 2; // keep the same point centered
        cam.y += (nh - h) / 2;
        w = nw;
        h = nh;
        schedule();
      }
    });
    ro.observe(wrap);

    // ---- gestures -----------------------------------------------------
    // Listeners live on the wrapper (not the <svg>) so HTML pins sitting
    // above the SVG still count as part of the map surface.
    type P = { x: number; y: number };
    const pointers = new Map<number, P>();
    let rect: DOMRect | null = null;
    let press: { x: number; y: number; moved: boolean; onPin: boolean } | null = null;
    let samples: { t: number; x: number; y: number }[] = [];
    let lastTap: { t: number; x: number; y: number } | null = null;
    // A draggable pin being moved instead of the map.
    let dragPin: { el: HTMLElement; id: string; offX: number; offY: number } | null = null;

    const local = (e: PointerEvent | WheelEvent): P => ({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
    const toWorld = (p: P): WorldPoint => [(p.x - cam.x) / cam.k, (p.y - cam.y) / cam.k];

    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (target.closest?.("[data-nodrag]")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      rect = wrap.getBoundingClientRect();
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (interactive) stopMotion();
      if (pointers.size === 1) {
        const pinEl = target.closest?.("[data-pin]") as HTMLElement | null;
        press = { x: p.x, y: p.y, moved: false, onPin: !!pinEl };
        samples = [{ t: e.timeStamp, x: p.x, y: p.y }];
        if (pinEl?.hasAttribute("data-draggable") && pinEl.dataset.pinId) {
          const at = pinPos.get(pinEl);
          const w0 = toWorld(p);
          if (at) {
            dragPin = {
              el: pinEl,
              id: pinEl.dataset.pinId,
              offX: at[0] - w0[0],
              offY: at[1] - w0[1],
            };
          }
        }
      } else if (press) {
        press.moved = true; // second finger: it's a pinch, not a tap
        dragPin = null;
      }
      if (interactive && pointers.size === 2) {
        for (const id of pointers.keys()) wrap.setPointerCapture(id);
      }
    };

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev || !press) return;
      const cur = local(e);

      if (dragPin) {
        if (!press.moved) {
          if (Math.hypot(cur.x - press.x, cur.y - press.y) < DRAG_THRESHOLD) return;
          press.moved = true;
          wrap.setPointerCapture(e.pointerId);
        }
        const wp = toWorld(cur);
        pinPos.set(dragPin.el, [wp[0] + dragPin.offX, wp[1] + dragPin.offY]);
        place(dragPin.el);
        prev.x = cur.x;
        prev.y = cur.y;
        return;
      }
      if (!interactive) return;

      if (pointers.size === 1) {
        if (!press.moved) {
          if (Math.hypot(cur.x - press.x, cur.y - press.y) < DRAG_THRESHOLD) return;
          press.moved = true;
          wrap.setPointerCapture(e.pointerId);
          prev.x = press.x;
          prev.y = press.y;
        }
        cam.x += cur.x - prev.x;
        cam.y += cur.y - prev.y;
        samples.push({ t: e.timeStamp, x: cur.x, y: cur.y });
        if (samples.length > 6) samples.shift();
      } else if (pointers.size === 2) {
        let other: P | null = null;
        for (const [id, p] of pointers) if (id !== e.pointerId) other = p;
        if (other) {
          const oldMid = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
          const newMid = { x: (cur.x + other.x) / 2, y: (cur.y + other.y) / 2 };
          const oldDist = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
          const newDist = Math.hypot(cur.x - other.x, cur.y - other.y) || 1;
          // World point under the old midpoint must end up under the new one.
          const wx = (oldMid.x - cam.x) / cam.k;
          const wy = (oldMid.y - cam.y) / cam.k;
          cam.k = clampNum(cam.k * (newDist / oldDist), MIN_SCALE, MAX_SCALE);
          cam.x = newMid.x - wx * cam.k;
          cam.y = newMid.y - wy * cam.k;
        }
      }
      prev.x = cur.x;
      prev.y = cur.y;
      schedule();
    };

    const onUp = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p || !press) {
        pointers.delete(e.pointerId);
        return;
      }
      pointers.delete(e.pointerId);
      const cancelled = e.type === "pointercancel";

      if (dragPin) {
        const d = dragPin;
        dragPin = null;
        if (press.moved) {
          const at = pinPos.get(d.el);
          if (at && !cancelled) onDragEndRef.current?.(d.id, at);
          press = null;
          return;
        }
      }

      if (pointers.size > 0) {
        // Pinch ended with one finger still down: keep panning with it,
        // no new drag threshold.
        press.moved = true;
        const rest = pointers.values().next().value as P;
        samples = [{ t: e.timeStamp, x: rest.x, y: rest.y }];
        return;
      }

      if (press.moved) {
        const last = samples[samples.length - 1];
        const first = samples[0];
        if (!cancelled && last && first && e.timeStamp - last.t < 60 && last.t > first.t) {
          const dt = last.t - first.t;
          const vx = (last.x - first.x) / dt;
          const vy = (last.y - first.y) / dt;
          if (Math.hypot(vx, vy) > 0.15) {
            vel = { x: vx, y: vy };
            schedule();
          }
        }
        press = null;
        return;
      }

      const tapped = press;
      press = null;
      if (cancelled || tapped.onPin) return;
      const now = e.timeStamp;
      if (
        interactive &&
        lastTap &&
        now - lastTap.t < DOUBLE_TAP_MS &&
        Math.hypot(lastTap.x - tapped.x, lastTap.y - tapped.y) < 30
      ) {
        lastTap = null;
        fly = null;
        zoomTarget = {
          k: clampNum(cam.k * 2, MIN_SCALE, MAX_SCALE),
          ax: tapped.x,
          ay: tapped.y,
        };
        schedule();
        return;
      }
      lastTap = { t: now, x: tapped.x, y: tapped.y };
      onBgRef.current?.(toWorld(tapped));
    };

    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.("[data-nodrag]")) return;
      e.preventDefault();
      rect = wrap.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? h : 1;
      // ctrl+wheel is a trackpad pinch: much smaller deltas, so scale up.
      const delta = -e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018);
      fly = null;
      vel = null;
      const base = zoomTarget?.k ?? cam.k;
      const at = local(e);
      zoomTarget = {
        k: clampNum(base * Math.exp(clampNum(delta, -1, 1)), MIN_SCALE, MAX_SCALE),
        ax: at.x,
        ay: at.y,
      };
      schedule();
    };

    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    if (interactive) wrap.addEventListener("wheel", onWheel, { passive: false });

    paint();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("wheel", onWheel);
      apiRef.current = null;
      placeRef.current = null;
    };
  }, [interactive]);

  const palette = paletteFor(dark);

  return (
    <div
      ref={wrapRef}
      className={cn("relative isolate select-none overflow-hidden", className)}
      style={{
        background: palette.background,
        touchAction: interactive ? "none" : "pan-y",
      }}
    >
      <svg ref={svgRef} className="absolute inset-0 h-full w-full">
        <g ref={gRef}>
          {basemap && <Basemap data={basemap} dark={dark} />}
          {children}
          {pins.map((pin) => (
            <g
              key={pin.id}
              data-pin
              className="svgmap-pin"
              role="button"
              tabIndex={0}
              aria-label={pin.label}
              style={{
                transform: `translate(${pin.x}px, ${pin.y}px) scale(var(--ik, 1))`,
              }}
              onClick={pin.onSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pin.onSelect();
                }
              }}
            >
              <title>{pin.label}</title>
              {pin.node}
            </g>
          ))}
        </g>
      </svg>

      {/* HTML pins: pointer-events pass through the empty layer to the map. */}
      <div
        ref={layerRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <AnimatePresence>
          {htmlPins.map((pin) => (
            <HtmlPinItem key={pin.id} pin={pin} placeRef={placeRef} />
          ))}
        </AnimatePresence>
      </div>

      {controls && (
        <div
          data-nodrag
          className="absolute right-2.5 top-2.5 z-20 flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => apiRef.current?.zoomBy(1.6)}
            className="flex h-8 w-8 items-center justify-center text-foreground hover:bg-black/5"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => apiRef.current?.zoomBy(1 / 1.6)}
            className="flex h-8 w-8 items-center justify-center border-t border-border text-foreground hover:bg-black/5"
          >
            <Minus size={16} />
          </button>
        </div>
      )}

      {/* Credit required by OpenStreetMap's ODbL licence (the basemap and
          routing data come from OSM) — kept small, but always on the map. */}
      <a
        data-nodrag
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        aria-label="© OpenStreetMap contributors"
        title="© OpenStreetMap contributors"
        className="absolute bottom-0 right-0 z-20 rounded-tl-md bg-surface/60 px-1.5 py-px text-[10px] leading-tight text-foreground/60 hover:text-foreground"
      >
        © OSM
      </a>
    </div>
  );
});

function HtmlPinItem({
  pin,
  placeRef,
}: {
  pin: HtmlPin;
  placeRef: { current: ((el: HTMLElement) => void) | null };
}) {
  const [ax, ay] = pin.anchor;
  return (
    <div
      data-pin
      data-pin-id={pin.id}
      data-draggable={pin.draggable ? "" : undefined}
      ref={(el) => {
        if (!el) return;
        pinPos.set(el, [pin.x, pin.y]);
        placeRef.current?.(el);
      }}
      className={cn("pointer-events-auto absolute left-0 top-0", pin.className)}
      style={{ willChange: "transform", cursor: pin.draggable ? "grab" : pin.onSelect ? "pointer" : undefined }}
      onClick={pin.onSelect}
      onPointerEnter={pin.onPreview}
      onPointerDown={pin.onPreview}
    >
      {/* Inner box carries the enter/exit animation, so the outer element's
          transform stays 100% owned by the camera loop. */}
      <motion.div
        role={pin.onSelect ? "button" : undefined}
        tabIndex={pin.onSelect ? 0 : undefined}
        aria-label={pin.label}
        title={pin.label}
        exit={{ opacity: 0, scale: 0.3 }}
        transition={{ duration: 0.22 }}
        onKeyDown={(e) => {
          if (pin.onSelect && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            pin.onSelect();
          }
        }}
        style={{
          position: "absolute",
          left: -ax,
          top: -ay,
          width: pin.width,
          height: pin.height,
          transformOrigin: `${ax}px ${ay}px`,
        }}
      >
        {pin.node}
      </motion.div>
    </div>
  );
}
