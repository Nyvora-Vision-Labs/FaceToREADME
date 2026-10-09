import type { CropRect } from "./ascii";

export interface CropState {
  /** 1 = largest crop that fits the image; higher values zoom in. */
  zoom: number;
  /** Crop centre, normalised to the image (0..1). */
  cx: number;
  cy: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

export const ASPECTS = [
  { id: "1:1", label: "Square", value: 1 },
  { id: "4:5", label: "Portrait", value: 4 / 5 },
  { id: "3:4", label: "Tall", value: 3 / 4 },
  { id: "16:9", label: "Wide", value: 16 / 9 },
] as const;

export const DEFAULT_CROP: CropState = { zoom: 1, cx: 0.5, cy: 0.42 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function cropSize(imgW: number, imgH: number, aspect: number, zoom: number) {
  const base = imgW / imgH > aspect ? { w: imgH * aspect, h: imgH } : { w: imgW, h: imgW / aspect };
  const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  return { w: base.w / z, h: base.h / z };
}

/** Keeps zoom in range and the crop centre where the crop stays inside the image. */
export function clampCrop(imgW: number, imgH: number, aspect: number, state: CropState): CropState {
  const zoom = clamp(state.zoom, MIN_ZOOM, MAX_ZOOM);
  const { w, h } = cropSize(imgW, imgH, aspect, zoom);
  const halfW = w / 2 / imgW;
  const halfH = h / 2 / imgH;
  return { zoom, cx: clamp(state.cx, halfW, 1 - halfW), cy: clamp(state.cy, halfH, 1 - halfH) };
}

export function cropRect(imgW: number, imgH: number, aspect: number, state: CropState): CropRect {
  const { zoom, cx, cy } = clampCrop(imgW, imgH, aspect, state);
  const { w, h } = cropSize(imgW, imgH, aspect, zoom);
  return { x: cx * imgW - w / 2, y: cy * imgH - h / 2, w, h };
}

/** Moves the crop by a drag of (dx, dy) screen pixels inside a viewport `viewportW` wide. */
export function panCrop(
  imgW: number,
  imgH: number,
  aspect: number,
  state: CropState,
  dx: number,
  dy: number,
  viewportW: number,
): CropState {
  const rect = cropRect(imgW, imgH, aspect, state);
  const imagePxPerScreenPx = rect.w / viewportW;
  return clampCrop(imgW, imgH, aspect, {
    ...state,
    cx: state.cx - (dx * imagePxPerScreenPx) / imgW,
    cy: state.cy - (dy * imagePxPerScreenPx) / imgH,
  });
}
