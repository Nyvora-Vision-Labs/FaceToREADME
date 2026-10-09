import { CELL_ASPECT } from "./ascii";

/** Wraps art in a fenced code block; the fence is longer than any backtick run inside. */
export function toMarkdown(ascii: string): string {
  const longestRun = Math.max(0, ...(ascii.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}text\n${ascii}\n${fence}\n`;
}

export function toPlainText(ascii: string): string {
  return ascii.endsWith("\n") ? ascii : `${ascii}\n`;
}

export interface SvgTheme {
  background: string;
  foreground: string;
}

export const SVG_THEMES: Record<"dark" | "light", SvgTheme> = {
  dark: { background: "#0d1117", foreground: "#e6edf3" },
  light: { background: "#ffffff", foreground: "#1f2328" },
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&apos;",
  );
}

export interface SvgAnimation {
  /** Milliseconds to reveal each line. */
  lineMs: number;
  /** Replay forever (with a pause on the finished portrait) instead of drawing once. */
  loop: boolean;
  /** Color of the scan bar that sweeps down as lines appear. */
  accent: string;
}

/** Pause on the finished portrait before a looping animation starts over. */
export const LOOP_HOLD_MS = 2800;

/**
 * Builds a standalone SVG with a solid background. Spaces become no-break spaces and each
 * line is pinned to an exact `textLength`, so columns stay aligned in any monospace font
 * GitHub's image proxy (or a viewer) falls back to.
 *
 * With `animation`, the portrait draws itself top to bottom using SMIL (`<animate>`), which
 * GitHub renders inside READMEs — no JavaScript involved.
 */
export function toSvg(ascii: string, theme: SvgTheme, fontSize = 12, animation?: SvgAnimation): string {
  const lines = ascii.split("\n");
  const cols = Math.max(1, ...lines.map((line) => Array.from(line).length));
  const charWidth = fontSize * 0.6;
  const lineHeight = charWidth / CELL_ASPECT;
  const pad = Math.round(fontSize * 2);
  const textWidth = cols * charWidth;
  const width = Math.ceil(textWidth + pad * 2);
  const height = Math.ceil(lines.length * lineHeight + pad * 2);
  const round = (n: number) => Number(n.toFixed(2));

  const body = lines
    .map((line, i) => {
      const y = round(pad + i * lineHeight + lineHeight / 2);
      const length = round(Array.from(line).length * charWidth);
      const text = escapeXml(line).replace(/ /g, "\u00a0");
      return `    <text x="${pad}" y="${y}" textLength="${length}" lengthAdjust="spacing">${text}</text>`;
    })
    .join("\n");

  const textGroup = `  <g${animation ? ' clip-path="url(#reveal)"' : ""} fill="${theme.foreground}" font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace" font-size="${fontSize}" dominant-baseline="central" xml:space="preserve" style="white-space:pre">`;

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="ASCII art portrait">`,
    `  <rect width="100%" height="100%" rx="${Math.round(fontSize * 0.75)}" fill="${theme.background}"/>`,
  ];

  if (animation) {
    const n = lines.length;
    const step = Math.max(10, animation.lineMs);
    // Reveal line k (1..n) at time k·step; the extra step hides the scan bar afterwards.
    const total = (n + 1) * step + (animation.loop ? LOOP_HOLD_MS : 0);
    const times = Array.from({ length: n + 2 }, (_, k) => round((k * step) / total));
    const lineBottom = (k: number) => (k === 0 ? 0 : k === n ? height : round(pad + k * lineHeight));
    const reveal = [...Array.from({ length: n + 1 }, (_, k) => lineBottom(k)), height];
    const scanY = [0, ...Array.from({ length: n }, (_, k) => round(pad + k * lineHeight)), 0];
    const scanOpacity = [0, ...Array(n).fill(1), 0];
    const timing = `dur="${total}ms" repeatCount="${animation.loop ? "indefinite" : "1"}" fill="freeze" calcMode="discrete" keyTimes="${times.join(";")}"`;
    out.push(
      "  <defs>",
      `    <clipPath id="reveal"><rect x="0" y="0" width="${width}" height="${height}">`,
      `      <animate attributeName="height" values="${reveal.join(";")}" ${timing}/>`,
      "    </rect></clipPath>",
      "  </defs>",
      `  <rect x="${round(pad / 2)}" y="0" width="${round(width - pad)}" height="${round(lineHeight)}" rx="2" fill="${animation.accent}" fill-opacity="0.22" opacity="0">`,
      `    <animate attributeName="y" values="${scanY.join(";")}" ${timing}/>`,
      `    <animate attributeName="opacity" values="${scanOpacity.join(";")}" ${timing}/>`,
      "  </rect>",
    );
  }

  out.push(textGroup, body, "  </g>", "</svg>", "");
  return out.join("\n");
}

export interface ProfileDetails {
  name?: string;
  tagline?: string;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => (ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"));

/** A complete profile README: the centred animated portrait plus an optional greeting. */
export function readmeFile(fileName: string, details: ProfileDetails = {}, width = 600): string {
  const name = details.name?.trim();
  const tagline = details.tagline?.trim();
  let out = readmeSnippet(fileName, width);
  if (name) out += `\n<h1 align="center">Hi, I’m ${escapeHtml(name)}</h1>\n`;
  if (tagline) out += `\n<p align="center">${escapeHtml(tagline)}</p>\n`;
  return out;
}

/** Markdown/HTML to paste into a README, centred, pointing at the committed SVG. */
export function readmeSnippet(fileName: string, width = 600): string {
  return `<p align="center">\n  <img src="./${fileName}" width="${width}" alt="ASCII art portrait">\n</p>\n`;
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path (e.g. permission denied in an iframe).
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Clipboard access was blocked by the browser.");
}

export function baseName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const slug = stem.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "portrait";
}
