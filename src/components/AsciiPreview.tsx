import { useEffect, useMemo, useRef, useState } from "react";
import { LINE_HEIGHT_EM } from "../lib/ascii";
import { SVG_THEMES, toSvg, type SvgAnimation } from "../lib/export";

interface AsciiPreviewProps {
  ascii: string;
  cols: number;
  rows: number;
  invert: boolean;
  busy: boolean;
  /** When set, shows the exported animated SVG instead of live text. */
  animation?: SvgAnimation | null;
}

const CHAR_WIDTH_EM = 0.6;
const MAX_FONT_PX = 14;
const PADDING_PX = 20;

export function AsciiPreview({ ascii, cols, rows, invert, busy, animation }: AsciiPreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [actualSize, setActualSize] = useState(false);
  const animated = Boolean(animation);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(box);
    return () => observer.disconnect();
  }, [animated]);

  // Scale the font so every column fits the card; spacing is preserved exactly.
  const fitSize = boxWidth ? Math.min(MAX_FONT_PX, (boxWidth - PADDING_PX * 2) / (cols * CHAR_WIDTH_EM)) : 0;
  // "Actual size" approximates a GitHub code block (13.6px); it only matters when fit is smaller.
  const canZoom = fitSize > 0 && fitSize < 9;
  const fontSize = canZoom && actualSize ? 13.6 : fitSize;
  const theme = invert ? SVG_THEMES.light : SVG_THEMES.dark;

  // Exactly the file the user downloads, rendered as an <img> the way GitHub shows it.
  const svgUrl = useMemo(() => {
    if (!animation || !ascii) return null;
    return URL.createObjectURL(new Blob([toSvg(ascii, theme, 12, animation)], { type: "image/svg+xml" }));
  }, [animation, ascii, theme]);
  useEffect(() => () => {
    if (svgUrl) URL.revokeObjectURL(svgUrl);
  }, [svgUrl]);

  if (animation) {
    return (
      <div className="overflow-hidden rounded-2xl ring-1 ring-line" style={{ backgroundColor: theme.background }}>
        {svgUrl ? (
          <img
            key={svgUrl}
            src={svgUrl}
            data-testid="animated-preview"
            alt={`Animated ASCII portrait, ${cols} by ${rows} characters, drawing from top to bottom`}
            className="block h-auto w-full"
          />
        ) : (
          <div className="skeleton aspect-square w-full" />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
    <div
      ref={boxRef}
      className="relative overflow-auto rounded-2xl ring-1 ring-line transition-colors"
      style={{ backgroundColor: theme.background, color: theme.foreground, padding: PADDING_PX }}
    >
      {fontSize > 0 ? (
        <pre
          data-testid="ascii-output"
          role="img"
          aria-label={`ASCII art portrait, ${cols} characters wide and ${rows} lines tall`}
          className={`ascii mx-auto w-fit transition-opacity duration-150 ${busy ? "opacity-60" : "opacity-100"}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: LINE_HEIGHT_EM }}
        >
          {ascii}
        </pre>
      ) : (
        <div className="skeleton aspect-square w-full rounded-xl" />
      )}
      {busy && (
        <span
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white"
          aria-hidden="true"
        >
          <span className="size-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Updating
        </span>
      )}
    </div>
    {canZoom && (
      <button
        type="button"
        aria-pressed={actualSize}
        onClick={() => setActualSize((v) => !v)}
        className="mt-2 w-full rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-accent/50"
      >
        {actualSize ? "Fit to screen" : "View at actual size (scrolls)"}
      </button>
    )}
    </div>
  );
}
