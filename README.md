# FaceToREADME

**Live site: [nyvora-vision-labs.github.io/FaceToREADME](https://nyvora-vision-labs.github.io/FaceToREADME/)**

Turn a face photo into ASCII art for your GitHub README — entirely in the browser. Photos are decoded and converted with the Canvas API and never uploaded anywhere.

## Features

- Drag-and-drop or file-picker upload (JPG, PNG, WebP up to 15 MB) with validation for unsupported, empty, corrupt, or oversized files
- Pan / zoom / pinch cropper with aspect presets, keyboard support, and a mini-map of the original
- Width, brightness, contrast, detail (sharpening), character density, auto levels, and invert controls with live preview
- Palettes: Fine (default, 15 tonal steps), Classic, Detailed, Blocks, Minimal, Retro, and Custom
- **Animated README portrait:** download an SVG that draws itself line by line (SMIL, plays on GitHub — no JavaScript), choose speed and loop, and copy a ready-to-paste README snippet
- Static exports: copy as a Markdown code block, copy plain text, download `.txt`, download `.svg` (solid background, column-aligned)
- Built-in sample portrait (Mona Lisa, public domain) and a "how to add it to your README" guide

## How it works

1. The cropped region is drawn into an offscreen canvas at `cols × rows` cells (oversampled up to 6×) and box-averaged to Rec. 601 grayscale.
2. `rows` is corrected for monospace cell proportions (`0.6em` wide × `1.45` line height, matching GitHub code blocks) so faces aren't stretched.
3. Optional auto levels stretch the 1st–99th percentile to full range; brightness, contrast, and a density gamma are applied; each value indexes a light → dense character ramp.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end tests in Chrome via Playwright (desktop + mobile)
npm run build
```

Stack: React 18, TypeScript, Tailwind CSS v4, Vite.
