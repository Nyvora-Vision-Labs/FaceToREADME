/**
 * Width / height of one character cell as rendered in a GitHub Markdown code block
 * (monospace glyphs are ~0.6em wide, GitHub uses a 1.45 line height). Sampling the
 * image with this aspect keeps faces from looking stretched once pasted into a README.
 */
export const CELL_ASPECT = 0.6 / 1.45;
export const LINE_HEIGHT_EM = 1.45;

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ToneSettings {
  /** -100..100 */
  brightness: number;
  /** -100..100 */
  contrast: number;
  /** 0..100, 50 = neutral. Higher values push pixels toward denser characters. */
  density: number;
  /** false: bright pixels get dense characters (light text on dark backgrounds). */
  invert: boolean;
  /** Stretch the photo's tonal range to full black → white before mapping. */
  autoLevels?: boolean;
  /** 0..100 unsharp-mask strength; brings out eyes, lips and jawlines at small sizes. */
  detail?: number;
}

/** Unsharp mask over the cell grid: value + amount · (value − 3×3 neighbourhood mean). */
export function sharpenLuminance(sample: Sample, detail: number): Float32Array {
  const { cols, rows, luminance } = sample;
  const amount = (Math.max(0, Math.min(100, detail)) / 100) * 1.6;
  if (amount === 0) return luminance;
  const out = new Float32Array(luminance.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const r = row + dy;
        if (r < 0 || r >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const c = col + dx;
          if (c < 0 || c >= cols) continue;
          sum += luminance[r * cols + c];
          count++;
        }
      }
      const idx = row * cols + col;
      const v = luminance[idx];
      out[idx] = Math.max(0, Math.min(255, v + amount * (v - sum / count)));
    }
  }
  return out;
}

/** 1st / 99th percentile luminance of the visible cells, used to stretch flat photos. */
export function tonalRange(sample: Sample): [number, number] {
  const values: number[] = [];
  for (let i = 0; i < sample.luminance.length; i++) if (sample.alpha[i] > 0.5) values.push(sample.luminance[i]);
  if (values.length < 2) return [0, 255];
  values.sort((a, b) => a - b);
  const lo = values[Math.floor(values.length * 0.01)];
  const hi = values[Math.ceil(values.length * 0.99) - 1];
  return hi - lo < 8 ? [0, 255] : [lo, hi];
}

export interface Sample {
  cols: number;
  rows: number;
  /** Luminance per cell, 0..255. */
  luminance: Float32Array;
  /** Opacity per cell, 0..1. */
  alpha: Float32Array;
}

export function rowsForCrop(cols: number, crop: Pick<CropRect, "w" | "h">): number {
  return Math.max(1, Math.round(cols * (crop.h / crop.w) * CELL_ASPECT));
}

/** Rec. 601 luma, the same weighting most image editors use for "grayscale". */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Averages RGBA pixels (width = cols * scale, height = rows * scale) into one grayscale
 * value per character cell. Box-averaging avoids the aliasing a direct tiny resize causes.
 */
export function averageCells(
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  scale: number,
): Sample {
  const width = cols * scale;
  const luminance = new Float32Array(cols * rows);
  const alpha = new Float32Array(cols * rows);
  const n = scale * scale;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let lum = 0;
      let a = 0;
      for (let dy = 0; dy < scale; dy++) {
        let i = ((row * scale + dy) * width + col * scale) * 4;
        for (let dx = 0; dx < scale; dx++, i += 4) {
          const pa = data[i + 3] / 255;
          lum += luma(data[i], data[i + 1], data[i + 2]) * pa;
          a += pa;
        }
      }
      const idx = row * cols + col;
      luminance[idx] = a > 0 ? lum / a : 0;
      alpha[idx] = a / n;
    }
  }
  return { cols, rows, luminance, alpha };
}

export function adjustTone(value: number, brightness: number, contrast: number): number {
  const c = Math.max(-100, Math.min(100, contrast)) * 2.55;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const v = factor * (value - 128) + 128 + brightness * 2.55;
  return Math.max(0, Math.min(255, v));
}

/** Maps a grayscale sample onto a character ramp (ordered lightest → densest). */
export function sampleToAscii(sample: Sample, ramp: string[], tone: ToneSettings): string {
  const { cols, rows, alpha } = sample;
  const luminance = sharpenLuminance(sample, tone.detail ?? 0);
  const levels = ramp.length;
  const gamma = Math.pow(2, (50 - tone.density) / 25);
  const [lo, hi] = tone.autoLevels ? tonalRange({ ...sample, luminance }) : [0, 255];
  const stretch = 255 / (hi - lo);
  const lines: string[] = new Array(rows);
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const levelled = Math.max(0, Math.min(255, (luminance[idx] - lo) * stretch));
      const v = adjustTone(levelled, tone.brightness, tone.contrast) / 255;
      let ink = tone.invert ? 1 - v : v;
      // Transparent areas fade to the background (no ink).
      ink *= alpha[idx];
      ink = Math.pow(ink, gamma);
      const level = Math.min(levels - 1, Math.floor(ink * levels));
      line += ramp[level];
    }
    lines[row] = line;
  }
  return lines.join("\n");
}

/** Draws the cropped region of `source` and samples it into character cells. */
export function sampleImage(
  source: CanvasImageSource,
  crop: CropRect,
  cols: number,
): Sample {
  const rows = rowsForCrop(cols, crop);
  // Oversample each cell so the box average sees real detail rather than one pixel.
  const scale = Math.max(1, Math.min(8, Math.floor(Math.min(crop.w / cols, crop.h / rows))));
  const canvas = document.createElement("canvas");
  canvas.width = cols * scale;
  canvas.height = rows * scale;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return averageCells(data, cols, rows, scale);
}
