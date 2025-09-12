/**
 * Pan + Zoom time scale hook for the timeline.
 *
 * Usage example:
 * const zoom = useTimeZoom({
 *   viewportWidth: width,
 *   timeWindow: { start: academicStart.getTime(), end: academicEnd.getTime() },
 *   initialScale: 1 / (1000*60*60*24) // 1px per day
 * });
 *
 * <div
 *   onWheel={e => zoom.onWheel(e.nativeEvent)}
 *   onPointerDown={e => zoom.onPointerDown(e.nativeEvent)}
 *   onPointerMove={e => zoom.onPointerMove(e.nativeEvent)}
 *   onPointerUp={e => zoom.onPointerUp(e.nativeEvent)}
 * > ... render items at x = zoom.toX(dateMs) ... </div>
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type TimeZoom = {
  scale: number;        // px per ms
  translate: number;    // px offset
  toX(t:number): number;
  toT(x:number): number;
  onWheel(e:WheelEvent): void;
  onPointerDown(e:PointerEvent): void;
  onPointerMove(e:PointerEvent): void;
  onPointerUp(e:PointerEvent): void;
  onTouchPinchStart(e:TouchEvent): void;
  onTouchPinchMove(e:TouchEvent): void;
  onTouchPinchEnd(e:TouchEvent): void;
};

interface Opts {
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  viewportWidth: number;
  timeWindow: { start:number; end:number };
  wheelZoomNoCtrl?: boolean; // if true, plain wheel zooms instead of requiring ctrlKey
  initialSpanDays?: number; // if provided, override initialScale to fit this many days into viewport
  initialCenterTime?: number; // optional center time for initial view (defaults to mid of timeWindow)
}

export function useTimeZoom({ initialScale = 1/(1000*60*60*24), minScale = 0.2, maxScale = 24, viewportWidth, timeWindow, wheelZoomNoCtrl = false, initialSpanDays, initialCenterTime }: Opts): TimeZoom {
  const [scale, setScale] = useState(initialScale); // px per ms
  const [translate, setTranslate] = useState(0);    // px

  const dragRef = useRef<{ x:number; tStart:number; transStart:number }|null>(null);
  const rafRef = useRef<number>();
  const pinchRef = useRef<{ id1:number; id2:number; startDist:number; startScale:number; midX:number; midT:number }|null>(null);

  const clamp = useCallback((s:number, tr:number) => {
    const { start, end } = timeWindow;
    const span = (end - start);
    // dynamic minScale so full span exactly fits (no extra empty space) when fully zoomed out
    const fitMin = viewportWidth / span;
    const effMin = Math.max(minScale, fitMin); // cannot zoom out beyond seeing full window
    let newScale = Math.min(maxScale, Math.max(effMin, s));
    const totalPx = span * newScale;
    const minTranslate = -totalPx + viewportWidth; // rightmost edge
    const maxTranslate = 0; // leftmost edge
    const clampedTranslate = Math.min(maxTranslate, Math.max(minTranslate, tr));
    return { s: newScale, tr: clampedTranslate };
  }, [timeWindow, viewportWidth, minScale, maxScale]);

  // Helper to detect edges for consumers (e.g. to draw a wall) — not exported yet but can be toggled
  const isAtRightEdge = () => {
    const { start, end } = timeWindow;
    const span = (end - start);
    const totalPx = span * scale;
    const minTranslate = -totalPx + viewportWidth;
    return Math.abs(translate - minTranslate) < 0.5;
  };
  const isAtLeftEdge = () => Math.abs(translate) < 0.5;

  const toX = useCallback((t:number) => (t - timeWindow.start) * scale + translate, [scale, translate, timeWindow.start]);
  const toT = useCallback((x:number) => ((x - translate) / scale) + timeWindow.start, [scale, translate, timeWindow.start]);

  // Wheel + ctrlKey for zoom, normal wheel for horizontal scroll (pan)
  const onWheel = useCallback((e:WheelEvent) => {
    const doZoom = wheelZoomNoCtrl ? true : e.ctrlKey;
    if (doZoom) {
      if (e.cancelable) e.preventDefault();
      const cursorX = e.clientX; // pixel in viewport
      const worldT = toT(cursorX);
      const delta = -e.deltaY; // invert natural
      const zoomFactor = Math.exp(delta * 0.0015);
      let newScale = scale * zoomFactor;
      newScale = Math.min(maxScale, Math.max(minScale, newScale));
      // Keep worldT under cursor after zoom: x = (t-start)*s + tr
      // Want cursorX = (worldT-start)*newS + newTr => newTr = cursorX - (worldT-start)*newS
      let newTranslate = cursorX - (worldT - timeWindow.start) * newScale;
  const { s: clampedScale, tr } = clamp(newScale, newTranslate);
  setScale(clampedScale);
  setTranslate(tr);
    } else {
      // horizontal pan with shift/normal? We'll treat vertical wheel as horizontal scroll for simplicity.
      const panDelta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (panDelta) {
        if (e.cancelable) e.preventDefault();
  // If already at an edge and user continues panning outward, ignore
  if ((panDelta < 0 && isAtLeftEdge()) || (panDelta > 0 && isAtRightEdge())) return;
  const { tr } = clamp(scale, translate - panDelta);
  setTranslate(tr);
      }
    }
  }, [scale, translate, clamp, toT, timeWindow.start, maxScale, minScale, wheelZoomNoCtrl]);

  // Pointer drag pan
  const onPointerDown = useCallback((e:PointerEvent) => {
    if (e.button !== 0) return; // left only
    dragRef.current = { x: e.clientX, tStart: Date.now(), transStart: translate };
  }, [translate]);

  const onPointerMove = useCallback((e:PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const target = dragRef.current.transStart + dx;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // Guard outward beyond left edge
      if (target > 0 && isAtLeftEdge()) return;
      const { tr } = clamp(scale, target);
      // Guard rubber-band beyond right edge
      if (isAtRightEdge() && tr < translate) return;
      setTranslate(tr);
    });
  }, [clamp, scale, translate]);

  const onPointerUp = useCallback((_e:PointerEvent) => {
    dragRef.current = null;
  }, []);

  // Touch pinch
  function distance(a:Touch, b:Touch) { const dx=a.clientX-b.clientX; const dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }

  const onTouchPinchStart = useCallback((e:TouchEvent) => {
    if (e.touches.length !== 2) return;
    const [t1, t2] = [e.touches[0], e.touches[1]];
    const dist = distance(t1,t2);
    const midX = (t1.clientX + t2.clientX)/2;
    const midT = toT(midX);
    pinchRef.current = { id1: t1.identifier, id2: t2.identifier, startDist: dist, startScale: scale, midX, midT };
  }, [scale, toT]);

  const onTouchPinchMove = useCallback((e:TouchEvent) => {
    if (!pinchRef.current) return;
    const p = pinchRef.current;
    const t1 = Array.from(e.touches).find(t => t.identifier===p.id1);
    const t2 = Array.from(e.touches).find(t => t.identifier===p.id2);
    if (!t1 || !t2) return;
    const newDist = distance(t1,t2);
    let newScale = p.startScale * (newDist / p.startDist);
    newScale = Math.min(maxScale, Math.max(minScale, newScale));
    let newTranslate = p.midX - (p.midT - timeWindow.start) * newScale;
  const { s: clampedScale, tr } = clamp(newScale, newTranslate);
  setScale(clampedScale);
  setTranslate(tr);
  }, [clamp, maxScale, minScale, timeWindow.start]);

  const onTouchPinchEnd = useCallback((_e:TouchEvent) => {
    pinchRef.current = null;
  }, []);

  // Cleanup raf
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // One-time initialization overriding scale/translate if initialSpanDays provided
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    if (viewportWidth <= 0) return;
    const span = timeWindow.end - timeWindow.start;
    const fitMin = viewportWidth / span;
    if (initialSpanDays) {
      const spanMs = initialSpanDays * 864e5;
      let desiredScale = viewportWidth / spanMs;
      // never below fitMin
      desiredScale = Math.min(maxScale, Math.max(fitMin, desiredScale));
      const centerT = typeof initialCenterTime === 'number' ? initialCenterTime : (timeWindow.start + timeWindow.end)/2;
      const halfSpanPx = viewportWidth/2;
      let tentativeTranslate = halfSpanPx - (centerT - timeWindow.start) * desiredScale;
      const { tr, s: clampedS } = clamp(desiredScale, tentativeTranslate);
      setScale(clampedS);
      setTranslate(tr);
    } else {
      // Ensure we at least respect fitMin
      const { s: s2, tr } = clamp(scale, translate);
      setScale(s2); setTranslate(tr);
    }
    initRef.current = true;
  }, [initialSpanDays, initialCenterTime, viewportWidth, clamp, timeWindow.start, timeWindow.end, maxScale, scale, translate]);

  // Invariant: always keep current scale/translate clamped (guards any missed pathways)
  useEffect(() => {
    const { s, tr } = clamp(scale, translate);
    if (s !== scale) setScale(s);
    if (tr !== translate) setTranslate(tr);
  }, [scale, translate, clamp]);

  return {
    scale,
    translate,
    toX,
    toT,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTouchPinchStart,
    onTouchPinchMove,
    onTouchPinchEnd,
  };
}
