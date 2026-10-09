import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampCrop, cropRect, panCrop, type CropState } from "../lib/crop";
import type { LoadedImage } from "../lib/image";
import { MoveIcon } from "./Icons";

interface CropperProps {
  image: LoadedImage;
  aspect: number;
  crop: CropState;
  onChange: (crop: CropState) => void;
}

/** Viewport-style cropper: the frame is fixed, the photo pans and zooms underneath it. */
export function Cropper({ image, aspect, crop, onChange }: CropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [hinted, setHinted] = useState(false);

  // Latest values for the non-React wheel listener.
  const latest = useRef({ crop, onChange, aspect, image });
  latest.current = { crop, onChange, aspect, image };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frameWidth === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssH = frameWidth / aspect;
    canvas.width = Math.round(frameWidth * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = cropRect(image.width, image.height, aspect, crop);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
  }, [image, aspect, crop, frameWidth]);

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { crop, onChange, aspect, image } = latest.current;
      const zoom = crop.zoom * Math.exp(-e.deltaY * 0.0025);
      onChange(clampCrop(image.width, image.height, aspect, { ...crop, zoom }));
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  const update = (next: CropState) => onChange(clampCrop(image.width, image.height, aspect, next));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setHinted(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current) update({ ...crop, zoom: crop.zoom * (distance / pinchDistance.current) });
      pinchDistance.current = distance;
      return;
    }
    onChange(panCrop(image.width, image.height, aspect, crop, next.x - prev.x, next.y - prev.y, frameWidth || 1));
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      onChange(panCrop(image.width, image.height, aspect, crop, dx, dy, frameWidth || 1));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      update({ ...crop, zoom: crop.zoom * 1.1 });
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      update({ ...crop, zoom: crop.zoom / 1.1 });
    }
  };

  const rect = cropRect(image.width, image.height, aspect, crop);

  return (
    <div className="relative">
      <div
        ref={frameRef}
        role="group"
        tabIndex={0}
        aria-roledescription="crop area"
        aria-label="Photo crop. Drag or use arrow keys to move, scroll or press plus and minus to zoom."
        data-testid="crop-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className="group relative w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-black ring-1 ring-line active:cursor-grabbing"
        style={{ aspectRatio: String(aspect) }}
      >
        <canvas ref={canvasRef} className="block size-full" />
        {/* Rule-of-thirds grid and face guide */}
        <div className="pointer-events-none absolute inset-0 opacity-60 transition group-hover:opacity-100">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/15" />
          <div className="absolute left-1/2 top-[46%] h-[66%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-white/30" />
        </div>
        {!hinted && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1 text-xs text-white/90 backdrop-blur">
              <MoveIcon /> Drag to frame your face · scroll or pinch to zoom
            </span>
          </div>
        )}
      </div>

      {/* Mini-map of the full original with the current crop highlighted */}
      <div
        className="pointer-events-none absolute right-3 top-3 overflow-hidden rounded-lg shadow-lg ring-1 ring-white/20"
        style={{ width: 72, aspectRatio: `${image.width} / ${image.height}` }}
        aria-hidden="true"
      >
        <img src={image.previewUrl} alt="" className="size-full object-cover" draggable={false} />
        <div
          className="absolute border-2 border-accent shadow-[0_0_0_999px_rgb(0_0_0_/_0.55)]"
          style={{
            left: `${(rect.x / image.width) * 100}%`,
            top: `${(rect.y / image.height) * 100}%`,
            width: `${(rect.w / image.width) * 100}%`,
            height: `${(rect.h / image.height) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
