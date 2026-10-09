import { useEffect, useMemo, useState } from "react";
import { SVG_THEMES, toSvg, type SvgAnimation } from "../lib/export";
import { BookIcon, ResetIcon } from "./Icons";

interface ReadmeMockupProps {
  ascii: string;
  animation: SvgAnimation;
  invert?: boolean;
  name?: string;
  tagline?: string;
  username?: string;
}

/**
 * How the portrait will look on a GitHub profile: the real animated SVG (the same file the
 * user downloads) inside a README frame, followed by the greeting from the README file.
 */
export function ReadmeMockup({ ascii, animation, invert = false, name, tagline, username }: ReadmeMockupProps) {
  const [replays, setReplays] = useState(0);
  const theme = invert ? SVG_THEMES.light : SVG_THEMES.dark;
  const palette = invert
    ? { card: "#ffffff", border: "#d0d7de", text: "#1f2328", muted: "#59636e", rule: "#d8dee4" }
    : { card: "#0d1117", border: "#30363d", text: "#e6edf3", muted: "#9198a1", rule: "#21262d" };

  // A fresh blob per replay restarts the SVG's own animation clock.
  const svgUrl = useMemo(
    () => URL.createObjectURL(new Blob([toSvg(ascii, theme, 12, animation)], { type: "image/svg+xml" })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ascii, theme, animation, replays],
  );
  useEffect(() => () => URL.revokeObjectURL(svgUrl), [svgUrl]);

  const displayName = name?.trim() || "Your Name";
  const displayTagline = tagline?.trim() || "A line about what you build, and who it’s for.";

  return (
    <figure
      data-testid="readme-mockup"
      aria-label="Preview of a GitHub profile README"
      className="m-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/40"
      style={{ backgroundColor: palette.card, border: `1px solid ${palette.border}`, color: palette.text }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
        style={{ borderBottom: `1px solid ${palette.border}`, color: palette.muted }}
      >
        <span className="inline-flex min-w-0 items-center gap-2 font-mono">
          <BookIcon className="shrink-0" />
          <span className="truncate">
            {username?.trim() || "your-username"} / README<span className="hidden sm:inline">.md</span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setReplays((n) => n + 1)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium transition hover:bg-black/10"
          style={{ color: palette.muted }}
        >
          <ResetIcon /> Replay
        </button>
      </div>
      <div className="flex flex-col items-center gap-4 px-4 py-6 sm:px-8 sm:py-8">
        <img
          key={svgUrl}
          src={svgUrl}
          data-testid="mockup-portrait"
          alt="ASCII art portrait drawing itself from top to bottom"
          className="block h-auto w-full max-w-[600px]"
        />
        <h3
          className="w-full pb-2 text-center text-2xl font-semibold tracking-tight"
          style={{ borderBottom: `1px solid ${palette.rule}` }}
          data-testid="mockup-name"
        >
          Hi, I’m {displayName}
        </h3>
        <p className="text-center text-sm" style={{ color: palette.muted }}>
          {displayTagline}
        </p>
      </div>
    </figure>
  );
}
