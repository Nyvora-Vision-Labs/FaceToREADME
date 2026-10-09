export interface Palette {
  id: string;
  name: string;
  /** Characters ordered from least ink (lightest) to most ink (densest). */
  chars: string;
}

export const PALETTES: Palette[] = [
  // 15 tonal steps whose glyphs fill the cell evenly, so shading reads as shading, not texture.
  { id: "fine", name: "Fine", chars: " .,:;i1tfLCG08@" },
  { id: "classic", name: "Classic", chars: " .:-=+*#%@" },
  {
    id: "detailed",
    name: "Detailed",
    chars: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  },
  { id: "blocks", name: "Blocks", chars: " ░▒▓█" },
  { id: "minimal", name: "Minimal", chars: " .oO@" },
  { id: "retro", name: "Retro", chars: " .,:;ox%#@" },
  { id: "custom", name: "Custom", chars: "" },
];

export const DEFAULT_CUSTOM_PALETTE = " .~*oO0@";

/** Splits a palette into user-perceived characters (so emoji / combined glyphs stay whole). */
export function toRamp(chars: string): string[] {
  const glyphs = Array.from(chars.replace(/[\r\n\t]/g, ""));
  return glyphs;
}

export function validateCustomPalette(chars: string): string | null {
  if (/[\r\n\t]/.test(chars)) return "Tabs and line breaks aren't allowed.";
  const ramp = toRamp(chars);
  if (ramp.length < 2) return "Enter at least 2 characters, lightest first.";
  if (ramp.length > 96) return "Use 96 characters or fewer.";
  return null;
}

export function resolveRamp(paletteId: string, customChars: string): string[] {
  if (paletteId === "custom") {
    return validateCustomPalette(customChars) ? toRamp(DEFAULT_CUSTOM_PALETTE) : toRamp(customChars);
  }
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  return toRamp(palette.chars);
}
