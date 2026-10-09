import { useId, type CSSProperties } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
  ends?: [string, string];
}

export function Slider({ label, value, min, max, step = 1, defaultValue, onChange, format, hint, ends }: SliderProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const fill = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : String(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-zinc-200">
          {label}
        </label>
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          disabled={value === defaultValue}
          className="rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums text-accent transition enabled:hover:bg-accent-soft disabled:text-muted"
          title={value === defaultValue ? undefined : `Reset ${label.toLowerCase()}`}
          aria-label={value === defaultValue ? `${label}: ${display}` : `${label}: ${display}. Reset to default`}
        >
          {display}
        </button>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hint ? hintId : undefined}
        aria-valuetext={display}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {ends && (
        <div className="flex justify-between text-[11px] text-subtle" aria-hidden="true">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}
