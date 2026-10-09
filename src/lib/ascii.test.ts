import { describe, expect, it } from "vitest";
import { CELL_ASPECT, adjustTone, averageCells, rowsForCrop, sampleToAscii, sharpenLuminance, type Sample } from "./ascii";
import { clampCrop, cropRect, panCrop } from "./crop";
import { resolveRamp, validateCustomPalette } from "./palettes";

const neutral = { brightness: 0, contrast: 0, density: 50, invert: false };

function gradient(cols: number): Sample {
  const luminance = new Float32Array(cols);
  for (let i = 0; i < cols; i++) luminance[i] = (i / (cols - 1)) * 255;
  return { cols, rows: 1, luminance, alpha: new Float32Array(cols).fill(1) };
}

describe("rowsForCrop", () => {
  it("compensates for tall monospace cells", () => {
    expect(rowsForCrop(100, { w: 500, h: 500 })).toBe(Math.round(100 * CELL_ASPECT));
    expect(rowsForCrop(100, { w: 500, h: 1000 })).toBe(Math.round(200 * CELL_ASPECT));
  });
});

describe("averageCells", () => {
  it("averages each block into grayscale luminance", () => {
    // 2x1 cells at scale 2 → 4x2 pixels: left cell white, right cell black.
    const px = (v: number) => [v, v, v, 255];
    const data = new Uint8ClampedArray([
      ...px(255), ...px(255), ...px(0), ...px(0),
      ...px(255), ...px(255), ...px(0), ...px(0),
    ]);
    const sample = averageCells(data, 2, 1, 2);
    expect(sample.luminance[0]).toBeCloseTo(255);
    expect(sample.luminance[1]).toBeCloseTo(0);
    expect(sample.alpha[0]).toBe(1);
  });
});

describe("sampleToAscii", () => {
  const ramp = resolveRamp("classic", "");

  it("maps dark → space and bright → densest character by default", () => {
    const out = sampleToAscii(gradient(10), ramp, neutral);
    expect(out[0]).toBe(" ");
    expect(out[9]).toBe("@");
    expect(out).toHaveLength(10);
  });

  it("invert flips the mapping", () => {
    const out = sampleToAscii(gradient(10), ramp, { ...neutral, invert: true });
    expect(out[0]).toBe("@");
    expect(out[9]).toBe(" ");
  });

  it("keeps line breaks and full-width rows", () => {
    const s: Sample = { cols: 3, rows: 2, luminance: new Float32Array(6), alpha: new Float32Array(6).fill(1) };
    expect(sampleToAscii(s, ramp, neutral)).toBe("   \n   ");
  });

  it("density pushes toward denser characters", () => {
    const sample = gradient(20);
    const ink = (s: string) => s.split("").reduce((sum, ch) => sum + ramp.indexOf(ch), 0);
    expect(ink(sampleToAscii(sample, ramp, { ...neutral, density: 90 }))).toBeGreaterThan(
      ink(sampleToAscii(sample, ramp, { ...neutral, density: 10 })),
    );
  });

  it("auto levels stretches a low-contrast image to the full ramp", () => {
    const flat: Sample = {
      cols: 10,
      rows: 1,
      luminance: Float32Array.from({ length: 10 }, (_, i) => 100 + i * 5),
      alpha: new Float32Array(10).fill(1),
    };
    const plain = sampleToAscii(flat, ramp, neutral);
    const levelled = sampleToAscii(flat, ramp, { ...neutral, autoLevels: true });
    expect(new Set(levelled).size).toBeGreaterThan(new Set(plain).size);
    expect(levelled[0]).toBe(" ");
    expect(levelled[9]).toBe("@");
  });

  it("treats transparent pixels as background", () => {
    const s: Sample = { cols: 1, rows: 1, luminance: new Float32Array([255]), alpha: new Float32Array([0]) };
    expect(sampleToAscii(s, ramp, neutral)).toBe(" ");
  });
});

describe("adjustTone", () => {
  it("brightness and contrast move values in the expected direction", () => {
    expect(adjustTone(100, 50, 0)).toBeGreaterThan(100);
    expect(adjustTone(200, 0, 50)).toBeGreaterThan(200);
    expect(adjustTone(50, 0, 50)).toBeLessThan(50);
    expect(adjustTone(128, 0, 0)).toBe(128);
  });
});

describe("palettes", () => {
  it("validates custom palettes", () => {
    expect(validateCustomPalette("a")).toMatch(/at least 2/);
    expect(validateCustomPalette(" .#")).toBeNull();
    expect(resolveRamp("custom", " ░█")).toEqual([" ", "░", "█"]);
    expect(resolveRamp("custom", "x").length).toBeGreaterThan(1); // falls back
  });
});

describe("crop", () => {
  it("fits the largest crop of the aspect inside the image", () => {
    expect(cropRect(600, 900, 1, { zoom: 1, cx: 0.5, cy: 0.5 })).toEqual({ x: 0, y: 150, w: 600, h: 600 });
  });
  it("clamps panning to the image bounds", () => {
    const state = clampCrop(600, 900, 1, { zoom: 2, cx: 0.5, cy: 0.5 });
    const moved = panCrop(600, 900, 1, state, 10_000, 10_000, 300);
    const rect = cropRect(600, 900, 1, moved);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
  });
});

describe("sharpenLuminance", () => {
  it("increases contrast across an edge and leaves flat areas alone", () => {
    const luminance = Float32Array.from([100, 100, 100, 160, 160, 160]);
    const sample: Sample = { cols: 6, rows: 1, luminance, alpha: new Float32Array(6).fill(1) };
    const out = sharpenLuminance(sample, 100);
    expect(out[2]).toBeLessThan(100);
    expect(out[3]).toBeGreaterThan(160);
    expect(out[0]).toBeCloseTo(100);
    expect(sharpenLuminance(sample, 0)).toBe(luminance);
  });
});

describe("fine palette", () => {
  it("is the default-detail ramp with 15 tonal steps", () => {
    expect(resolveRamp("fine", "")).toHaveLength(15);
    expect(resolveRamp("unknown", "")[0]).toBe(" ");
  });
});
