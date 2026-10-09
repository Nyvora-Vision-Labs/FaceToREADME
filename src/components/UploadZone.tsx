import { useRef, useState, type DragEvent } from "react";
import { ACCEPT_ATTR, MAX_FILE_BYTES, formatBytes } from "../lib/image";
import { ImageIcon, LockIcon, SparkleIcon, UploadIcon } from "./Icons";

interface UploadZoneProps {
  onFile: (file: File) => void;
  onSample: () => void;
  loading: boolean;
}

export function UploadZone({ onFile, onSample, loading }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      data-testid="upload-zone"
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
      onClick={(e) => {
        if (!loading && e.target === e.currentTarget) inputRef.current?.click();
      }}
      className={`relative flex min-h-[22rem] cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition sm:px-10 ${
        dragging
          ? "border-accent bg-accent-soft/60 shadow-[0_0_0_6px_rgb(139_92_246_/_0.12)]"
          : "border-line bg-surface/70 hover:border-accent/60 hover:bg-surface"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      {loading ? (
        <div className="pointer-events-none flex flex-col items-center gap-4" role="status">
          <span className="size-12 animate-spin rounded-full border-4 border-line border-t-accent" />
          <p className="text-base font-medium text-zinc-200">Preparing your photo…</p>
        </div>
      ) : (
        <>
          <div className="pointer-events-none flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-3xl text-accent ring-1 ring-accent/30">
            {dragging ? <ImageIcon /> : <UploadIcon />}
          </div>
          <div className="pointer-events-none space-y-2">
            <p className="text-xl font-semibold text-white">
              {dragging ? "Drop it like it's hot" : "Drop a photo of your face here"}
            </p>
            <p className="text-sm text-muted">
              JPG, PNG, or WebP · up to {formatBytes(MAX_FILE_BYTES)} · a well-lit, front-facing shot works best
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 transition hover:bg-violet-500"
            >
              <UploadIcon className="text-base" /> Choose a photo
            </button>
            <button
              type="button"
              onClick={onSample}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-raised px-5 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-accent/50 hover:text-white"
            >
              <SparkleIcon className="text-base text-accent" /> Try the sample portrait
            </button>
          </div>
          <p className="pointer-events-none inline-flex items-center gap-1.5 text-xs text-subtle">
            <LockIcon /> Your photo never leaves this device — everything runs in your browser.
          </p>
        </>
      )}
    </div>
  );
}
