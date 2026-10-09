import { useId } from "react";
import { DEFAULT_CUSTOM_PALETTE, PALETTES, validateCustomPalette } from "../lib/palettes";
import { ResetIcon } from "./Icons";
import { Slider } from "./Slider";

export interface Settings {
  width: number;
  brightness: number;
  contrast: number;
  density: number;
  paletteId: string;
  customPalette: string;
  invert: boolean;
  autoLevels: boolean;
  detail: number;
}

export const DEFAULT_SETTINGS: Settings = {
  width: 100,
  brightness: 0,
  contrast: 20,
  density: 50,
  paletteId: "fine",
  customPalette: DEFAULT_CUSTOM_PALETTE,
  invert: false,
  autoLevels: true,
  detail: 45,
};

export const WIDTH_RANGE = { min: 30, max: 200 };
const README_FRIENDLY_COLS = 100;

interface ControlsProps {
  settings: Settings;
  rows: number;
  onChange: (patch: Partial<Settings>) => void;
  onReset: () => void;
}

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));

export function Controls({ settings, rows, onChange, onReset }: ControlsProps) {
  const id = useId();
  const customError = settings.paletteId === "custom" ? validateCustomPalette(settings.customPalette) : null;
  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-3xl border border-line bg-surface/80 p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 id={`${id}-title`} className="text-base font-semibold text-white">
          Customize
        </h2>
        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition enabled:hover:bg-raised enabled:hover:text-white disabled:opacity-40"
        >
          <ResetIcon /> Reset all
        </button>
      </div>

      <div className="space-y-6">
        <Slider
          label="Output width"
          value={settings.width}
          min={WIDTH_RANGE.min}
          max={WIDTH_RANGE.max}
          step={2}
          defaultValue={DEFAULT_SETTINGS.width}
          format={(v) => `${v} × ${rows}`}
          onChange={(width) => onChange({ width })}
          hint={
            settings.width > README_FRIENDLY_COLS
              ? `Wider than ${README_FRIENDLY_COLS} characters will scroll sideways in a README code block. The SVG export scales to fit.`
              : "Columns × lines. Up to 100 columns fits a GitHub README without scrolling."
          }
        />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Slider
            label="Brightness"
            value={settings.brightness}
            min={-100}
            max={100}
            defaultValue={DEFAULT_SETTINGS.brightness}
            format={signed}
            onChange={(brightness) => onChange({ brightness })}
          />
          <Slider
            label="Contrast"
            value={settings.contrast}
            min={-100}
            max={100}
            defaultValue={DEFAULT_SETTINGS.contrast}
            format={signed}
            onChange={(contrast) => onChange({ contrast })}
          />
        </div>
        <Slider
          label="Detail"
          value={settings.detail}
          min={0}
          max={100}
          defaultValue={DEFAULT_SETTINGS.detail}
          format={(v) => `${v}%`}
          ends={["Soft", "Crisp"]}
          onChange={(detail) => onChange({ detail })}
          hint="Sharpens edges so eyes, lips and jawlines read clearly."
        />
        <Slider
          label="Character density"
          value={settings.density}
          min={0}
          max={100}
          defaultValue={DEFAULT_SETTINGS.density}
          format={(v) => `${v}%`}
          ends={["Airy", "Dense"]}
          onChange={(density) => onChange({ density })}
        />

        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-zinc-200">Character palette</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {PALETTES.map((palette) => {
              const checked = settings.paletteId === palette.id;
              const sample = palette.id === "custom" ? settings.customPalette || "…" : palette.chars;
              return (
                <label
                  key={palette.id}
                  className={`relative cursor-pointer rounded-xl border px-3 py-2.5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    checked
                      ? "border-accent bg-accent-soft/70 shadow-[inset_0_0_0_1px_var(--color-accent)]"
                      : "border-line bg-raised/60 hover:border-accent/40"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-palette`}
                    value={palette.id}
                    checked={checked}
                    onChange={() => onChange({ paletteId: palette.id })}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium text-white">{palette.name}</span>
                  <span className="ascii mt-0.5 block overflow-hidden text-ellipsis text-xs text-muted" aria-hidden="true">
                    {sample.trim().slice(0, 14) || "…"}
                  </span>
                </label>
              );
            })}
          </div>
          {settings.paletteId === "custom" && (
            <div className="mt-3 space-y-1.5">
              <label htmlFor={`${id}-custom`} className="text-xs font-medium text-zinc-300">
                Custom characters, lightest → densest
              </label>
              <input
                id={`${id}-custom`}
                type="text"
                value={settings.customPalette}
                spellCheck={false}
                autoComplete="off"
                maxLength={96}
                onChange={(e) => onChange({ customPalette: e.target.value })}
                aria-invalid={customError ? true : undefined}
                aria-describedby={`${id}-custom-help`}
                className={`ascii w-full rounded-lg border bg-canvas px-3 py-2 text-sm text-white outline-none transition focus:border-accent ${
                  customError ? "border-red-400/70" : "border-line"
                }`}
              />
              <p id={`${id}-custom-help`} className={`text-xs ${customError ? "text-red-300" : "text-subtle"}`}>
                {customError
                  ? `${customError} Showing a fallback palette for now.`
                  : "Start with a space for clean backgrounds. Spaces count as characters."}
              </p>
            </div>
          )}
        </fieldset>

        <div className="space-y-2">
          <Toggle
            label="Invert light & dark"
            checked={settings.invert}
            onChange={(invert) => onChange({ invert })}
            help={
              settings.invert
                ? "Dark characters on a light background — for GitHub's light theme."
                : "Light characters on a dark background — for GitHub's dark theme."
            }
          />
          <Toggle
            label="Auto levels"
            checked={settings.autoLevels}
            onChange={(autoLevels) => onChange({ autoLevels })}
            help="Stretches dim or low-contrast photos to use the full character range."
          />
        </div>
      </div>
    </section>
  );
}

interface ToggleProps {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, help, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-raised/50 px-4 py-3">
      <div>
        <p id={`${id}-label`} className="text-sm font-medium text-white">
          {label}
        </p>
        <p id={`${id}-help`} className="mt-0.5 text-xs text-muted">
          {help}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-accent-strong" : "bg-line"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
