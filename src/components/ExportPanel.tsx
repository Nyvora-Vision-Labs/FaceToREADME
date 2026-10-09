import { useId, useState } from "react";
import {
  SVG_THEMES,
  copyToClipboard,
  downloadFile,
  readmeSnippet,
  toMarkdown,
  toPlainText,
  toSvg,
  type SvgAnimation,
} from "../lib/export";
import { CheckIcon, CopyIcon, DownloadIcon } from "./Icons";

export const SPEEDS = [
  { id: "fast", label: "Fast", lineMs: 40 },
  { id: "normal", label: "Normal", lineMs: 80 },
  { id: "slow", label: "Slow", lineMs: 140 },
] as const;

export type SpeedId = (typeof SPEEDS)[number]["id"];

export interface AnimationOptions {
  speed: SpeedId;
  loop: boolean;
}

export function animationFor(options: AnimationOptions, invert: boolean): SvgAnimation {
  return {
    lineMs: SPEEDS.find((s) => s.id === options.speed)!.lineMs,
    loop: options.loop,
    accent: invert ? "#8b5cf6" : "#a78bfa",
  };
}

export const animatedFileName = (fileBase: string) => `${fileBase}-ascii-animated.svg`;

interface ExportPanelProps {
  ascii: string;
  fileBase: string;
  invert: boolean;
  animation: AnimationOptions;
  onAnimationChange: (options: AnimationOptions) => void;
  notify: (message: string, tone?: "success" | "error") => void;
}

type Action = "animated" | "snippet" | "markdown" | "plain" | "txt" | "svg";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 disabled:opacity-50";
const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-accent/50 hover:text-white disabled:opacity-50";

export function ExportPanel({ ascii, fileBase, invert, animation, onAnimationChange, notify }: ExportPanelProps) {
  const id = useId();
  const [done, setDone] = useState<Action | null>(null);
  const disabled = ascii.length === 0;
  const theme = invert ? SVG_THEMES.light : SVG_THEMES.dark;
  const animatedName = animatedFileName(fileBase);

  const flash = (action: Action) => {
    setDone(action);
    window.setTimeout(() => setDone((current) => (current === action ? null : current)), 1800);
  };

  const copy = async (action: Action, text: string, message: string) => {
    try {
      await copyToClipboard(text);
      flash(action);
      notify(message);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't copy to the clipboard.", "error");
    }
  };

  const download = (action: Action, name: string, content: string, mime: string) => {
    downloadFile(name, content, mime);
    flash(action);
    notify(`Downloaded ${name}`);
  };

  const icon = (action: Action, Icon: typeof CopyIcon) =>
    done === action ? <CheckIcon className="text-base text-emerald-300" /> : <Icon className="text-base" />;

  return (
    <section aria-labelledby="export-title" className="rounded-3xl border border-line bg-surface/80 p-5 sm:p-6">
      <h2 id="export-title" className="text-base font-semibold text-white">
        Add it to your README
      </h2>
      <p className="mt-1 text-sm text-muted">
        An animated SVG that draws your portrait line by line. GitHub plays it right in your profile — no code needed.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-zinc-300">Drawing speed</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
            {SPEEDS.map((s) => (
              <label
                key={s.id}
                className={`cursor-pointer rounded-lg px-2 py-1.5 text-center text-xs font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  animation.speed === s.id ? "bg-accent-strong text-white shadow" : "text-muted hover:text-white"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-speed`}
                  value={s.id}
                  checked={animation.speed === s.id}
                  onChange={() => onAnimationChange({ ...animation, speed: s.id })}
                  className="sr-only"
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <p id={`${id}-loop`} className="mb-2 text-xs font-medium text-zinc-300">
            Replay
          </p>
          <label className="flex h-[38px] cursor-pointer items-center justify-between gap-3 rounded-xl bg-canvas px-3 ring-1 ring-line">
            <span className="text-xs text-muted">{animation.loop ? "Loop forever" : "Draw once"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={animation.loop}
              aria-labelledby={`${id}-loop`}
              onClick={() => onAnimationChange({ ...animation, loop: !animation.loop })}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                animation.loop ? "bg-accent-strong" : "bg-line"
              }`}
            >
              <span
                className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                  animation.loop ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      <ol className="mt-5 space-y-3">
        <li className="flex gap-3">
          <span className="mt-3 font-mono text-xs text-accent">1</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                download("animated", animatedName, toSvg(ascii, theme, 12, animationFor(animation, invert)), "image/svg+xml")
              }
              className={`${primaryBtn} w-full`}
            >
              {icon("animated", DownloadIcon)} Download animated .svg
            </button>
            <p className="text-xs text-subtle">
              Add <span className="font-mono text-muted">{animatedName}</span> to your profile repo, next to README.md.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="mt-3 font-mono text-xs text-accent">2</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                copy("snippet", readmeSnippet(animatedName), "Copied the README snippet — paste it into README.md.")
              }
              className={`${secondaryBtn} w-full`}
            >
              {icon("snippet", CopyIcon)} {done === "snippet" ? "Copied snippet!" : "Copy README snippet"}
            </button>
            <pre className="ascii overflow-x-auto rounded-lg bg-canvas px-3 py-2 text-[11px] leading-relaxed text-violet-200 ring-1 ring-line">
              {readmeSnippet(animatedName).trimEnd()}
            </pre>
          </div>
        </li>
      </ol>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-subtle">Static formats</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              copy("markdown", toMarkdown(ascii), "Copied as a Markdown code block — paste it into your README.")
            }
            className={`${secondaryBtn} sm:col-span-2`}
          >
            {icon("markdown", CopyIcon)}
            {done === "markdown" ? "Copied Markdown!" : "Copy as Markdown code block"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => download("txt", `${fileBase}-ascii.txt`, toPlainText(ascii), "text/plain")}
            className={secondaryBtn}
          >
            {icon("txt", DownloadIcon)} Download .txt
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => download("svg", `${fileBase}-ascii.svg`, toSvg(ascii, theme), "image/svg+xml")}
            className={secondaryBtn}
          >
            {icon("svg", DownloadIcon)} Download .svg
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => copy("plain", toPlainText(ascii), "Copied plain ASCII text.")}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-muted transition hover:bg-raised hover:text-white disabled:opacity-50 sm:col-span-2"
          >
            {icon("plain", CopyIcon)}
            {done === "plain" ? "Copied!" : "Copy plain text only"}
          </button>
        </div>
      </div>
    </section>
  );
}
