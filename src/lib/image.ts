export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
/** Images are downscaled to this longest side; ASCII never needs more detail. */
const WORKING_MAX_SIDE = 1600;
const MIN_SIDE = 16;

export interface LoadedImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  name: string;
  /** Object URL / path for showing the untouched original. */
  previewUrl: string;
}

const EXTENSIONS: Record<string, (typeof ACCEPTED_TYPES)[number]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a user-facing error message, or null when the file is acceptable. */
export function validateFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = file.type || EXTENSIONS[ext] || "";
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) {
    const label = ext ? `.${ext}` : file.type || "this file type";
    return `${label} isn't supported. Please choose a JPG, PNG, or WebP image.`;
  }
  if (file.size === 0) return "That file is empty. Please choose another image.";
  if (file.size > MAX_FILE_BYTES) {
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)} — try a smaller or compressed copy.`;
  }
  return null;
}

async function decode(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
  } catch {
    throw new Error("We couldn't read that image. It may be corrupted or in an unsupported format.");
  }
  return img;
}

function toWorkingCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const { naturalWidth: w, naturalHeight: h } = img;
  if (w < MIN_SIDE || h < MIN_SIDE) {
    throw new Error(`That image is only ${w}×${h}px. Please use one at least ${MIN_SIDE}px on each side.`);
  }
  const scale = Math.min(1, WORKING_MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const error = validateFile(file);
  if (error) throw new Error(error);
  const url = URL.createObjectURL(file);
  try {
    const canvas = toWorkingCanvas(await decode(url));
    return { canvas, width: canvas.width, height: canvas.height, name: file.name, previewUrl: url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function loadImageUrl(url: string, name: string): Promise<LoadedImage> {
  const canvas = toWorkingCanvas(await decode(url));
  return { canvas, width: canvas.width, height: canvas.height, name, previewUrl: url };
}
