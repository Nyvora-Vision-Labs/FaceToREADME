import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { AsciiPreview } from "./components/AsciiPreview";
import { Controls, DEFAULT_SETTINGS, type Settings } from "./components/Controls";
import { Cropper } from "./components/Cropper";
import { ExportPanel, animatedFileName, animationFor, type AnimationOptions } from "./components/ExportPanel";
import { ReadmeMockup } from "./components/ReadmeMockup";
import { AlertIcon, CheckIcon, CloseIcon, LockIcon, ResetIcon, UploadIcon } from "./components/Icons";
import { ReadmeGuide } from "./components/ReadmeGuide";
import { Slider } from "./components/Slider";
import { UploadZone } from "./components/UploadZone";
import { rowsForCrop, sampleImage, sampleToAscii } from "./lib/ascii";
import { ASPECTS, DEFAULT_CROP, MAX_ZOOM, MIN_ZOOM, clampCrop, cropRect, type CropState } from "./lib/crop";
import { SVG_THEMES, baseName, copyToClipboard, downloadFile, readmeFile, toSvg, type ProfileDetails, type SvgAnimation } from "./lib/export";
import { ACCEPT_ATTR, loadImageFile, loadImageUrl, type LoadedImage } from "./lib/image";
import { resolveRamp } from "./lib/palettes";
import { SAMPLE_ART } from "./lib/sampleArt";

const SAMPLE = {
  url: `${import.meta.env.BASE_URL}sample-portrait.jpg`,
  name: "mona-lisa.jpg",
  crop: { zoom: 1.75, cx: 0.47, cy: 0.29 },
};

const LANDING_ANIMATION: SvgAnimation = { lineMs: 70, loop: true, accent: "#a78bfa" };

type AspectId = (typeof ASPECTS)[number]["id"];
type Toast = { id: number; message: string; tone: "success" | "error" };

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aspectId, setAspectId] = useState<AspectId>("1:1");
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pageDrag, setPageDrag] = useState(false);
  const [animationOptions, setAnimationOptions] = useState<AnimationOptions>({ speed: "normal", loop: true });
  const [previewMode, setPreviewMode] = useState<"text" | "animated">("text");
  const [profile, setProfile] = useState<ProfileDetails & { username: string }>({ name: "", tagline: "", username: "" });
  const replaceInput = useRef<HTMLInputElement>(null);
  const aspectGroup = useId();

  const aspect = ASPECTS.find((a) => a.id === aspectId)!.value;

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showImage = useCallback((next: LoadedImage, initialCrop: CropState) => {
    setImage((prev) => {
      if (prev?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl);
      return next;
    });
    setCrop(initialCrop);
    setError(null);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await loadImageFile(file);
        showImage(loaded, DEFAULT_CROP);
        notify(`Loaded ${file.name}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong reading that file.");
      } finally {
        setLoading(false);
      }
    },
    [notify, showImage],
  );

  const loadSample = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAspectId("1:1");
      showImage(await loadImageUrl(SAMPLE.url, SAMPLE.name), SAMPLE.crop);
    } catch {
      setError("The sample image couldn't be loaded. Try uploading your own photo instead.");
    } finally {
      setLoading(false);
    }
  }, [showImage]);

  // Accept drops anywhere on the page (the upload zone handles its own drops first).
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setPageDrag(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setPageDrag(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setPageDrag(false);
      if (e.defaultPrevented) return;
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFile]);

  // Defer the expensive conversion so sliders and dragging stay responsive.
  const deferredCrop = useDeferredValue(crop);
  const deferredSettings = useDeferredValue(settings);
  const deferredAspect = useDeferredValue(aspect);
  const busy = deferredCrop !== crop || deferredSettings !== settings || deferredAspect !== aspect;

  const sample = useMemo(() => {
    if (!image) return null;
    const rect = cropRect(image.width, image.height, deferredAspect, deferredCrop);
    return sampleImage(image.canvas, rect, deferredSettings.width);
  }, [image, deferredAspect, deferredCrop, deferredSettings.width]);

  const ramp = useMemo(
    () => resolveRamp(deferredSettings.paletteId, deferredSettings.customPalette),
    [deferredSettings.paletteId, deferredSettings.customPalette],
  );

  const ascii = useMemo(
    () => (sample ? sampleToAscii(sample, ramp, deferredSettings) : ""),
    [sample, ramp, deferredSettings],
  );

  const previewAnimation = useMemo(
    () => (previewMode === "animated" ? animationFor(animationOptions, deferredSettings.invert) : null),
    [previewMode, animationOptions, deferredSettings.invert],
  );

  const exportAnimation = useMemo(
    () => animationFor(animationOptions, deferredSettings.invert),
    [animationOptions, deferredSettings.invert],
  );

  const rows = image ? rowsForCrop(settings.width, cropRect(image.width, image.height, aspect, crop)) : 0;

  const changeAspect = (id: AspectId) => {
    setAspectId(id);
    if (image) setCrop((c) => clampCrop(image.width, image.height, ASPECTS.find((a) => a.id === id)!.value, c));
  };

  const startOver = () => {
    setImage((prev) => {
      if (prev?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setError(null);
  };

  const errorBanner = error && (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
    >
      <AlertIcon className="mt-0.5 shrink-0 text-lg text-red-300" />
      <p className="flex-1">{error}</p>
      <button
        type="button"
        onClick={() => setError(null)}
        className="rounded-md p-1 text-red-200 hover:bg-red-500/20"
        aria-label="Dismiss error"
      >
        <CloseIcon />
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <button type="button" onClick={startOver} className="group flex items-center gap-3 rounded-lg text-left">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-800 font-mono text-sm font-bold text-white shadow-lg shadow-violet-950/60">
            @:
          </span>
          <span>
            <span className="block text-base font-semibold tracking-tight text-white">FaceToREADME</span>
            <span className="hidden text-xs text-muted sm:block">Photo → ASCII art for your GitHub profile</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted md:inline-flex">
            <LockIcon className="text-accent" /> 100% in-browser · no uploads
          </span>
          <a
            href="#readme-guide"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-surface hover:text-white"
          >
            README guide
          </a>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1400px] space-y-10 px-4 pb-16 sm:px-8">
        {!image ? (
          <>
            <section className="grid items-center gap-10 pt-4 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
              <div className="space-y-8">
                <div className="space-y-4 text-center lg:text-left">
                  <p className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft/50 px-3 py-1 text-xs font-medium text-violet-200">
                    <span className="ascii text-accent">.,:;i1tfLCG08@</span> ASCII portraits in seconds
                  </p>
                  <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    Your face, drawn in ASCII, <span className="text-accent">live on your GitHub profile</span>
                  </h1>
                  <p className="mx-auto max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
                    Upload a photo and we make the art. Download an SVG that draws itself line by line, paste one
                    snippet into your README, done.
                  </p>
                </div>
                {errorBanner}
                <UploadZone onFile={handleFile} onSample={loadSample} loading={loading} />
              </div>
              <div className="space-y-3">
                <p className="text-center text-xs font-medium uppercase tracking-wider text-subtle lg:text-left">
                  Live demo · how it looks on a profile
                </p>
                <ReadmeMockup
                  ascii={SAMPLE_ART}
                  animation={LANDING_ANIMATION}
                  name="Mona Lisa"
                  tagline="Smiling enigmatically since 1503. Open to portrait commissions."
                  username="mona-lisa"
                />
              </div>
            </section>
            <ReadmeGuide />
          </>
        ) : (
          <>
            {errorBanner}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              {/* Original photo + crop */}
              <section
                aria-labelledby="photo-title"
                className="rounded-3xl border border-line bg-surface/80 p-5 sm:p-6 xl:col-start-1 xl:row-start-1"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="photo-title" className="text-base font-semibold text-white">
                      Original photo
                    </h2>
                    <p className="truncate text-xs text-muted" title={image.name}>
                      {image.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <input
                      ref={replaceInput}
                      type="file"
                      accept={ACCEPT_ATTR}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                      data-testid="replace-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFile(file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => replaceInput.current?.click()}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-accent/50 disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <UploadIcon />
                      )}
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={startOver}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-raised hover:text-white"
                    >
                      Start over
                    </button>
                  </div>
                </div>

                <Cropper image={image} aspect={aspect} crop={crop} onChange={setCrop} />

                <div className="mt-5 space-y-5">
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-zinc-200">Crop shape</legend>
                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
                      {ASPECTS.map((a) => (
                        <label
                          key={a.id}
                          className={`cursor-pointer rounded-lg px-2 py-1.5 text-center text-xs font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                            aspectId === a.id ? "bg-accent-strong text-white shadow" : "text-muted hover:text-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name={aspectGroup}
                            value={a.id}
                            checked={aspectId === a.id}
                            onChange={() => changeAspect(a.id)}
                            className="sr-only"
                          />
                          {a.label}
                          <span className="block text-[10px] opacity-70">{a.id}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Slider
                        label="Zoom"
                        value={Math.round(crop.zoom * 100) / 100}
                        min={MIN_ZOOM}
                        max={MAX_ZOOM}
                        step={0.01}
                        defaultValue={1}
                        format={(v) => `${v.toFixed(2)}×`}
                        onChange={(zoom) => setCrop((c) => clampCrop(image.width, image.height, aspect, { ...c, zoom }))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCrop(clampCrop(image.width, image.height, aspect, DEFAULT_CROP))}
                      className="mb-0.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-raised hover:text-white"
                    >
                      <ResetIcon /> Reset crop
                    </button>
                  </div>
                </div>
              </section>

              {/* ASCII preview + export */}
              <div className="space-y-6 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
                <section aria-labelledby="preview-title" className="rounded-3xl border border-line bg-surface/80 p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 id="preview-title" className="text-base font-semibold text-white">
                      ASCII portrait
                    </h2>
                    <p className="font-mono text-xs text-muted" aria-live="polite">
                      {settings.width} × {rows} chars · GitHub {settings.invert ? "light" : "dark"} preview
                    </p>
                  </div>
                  <div role="tablist" aria-label="Preview mode" className="mb-3 inline-flex gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
                    {(
                      [
                        ["text", "Live text"],
                        ["animated", "Animated SVG"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={previewMode === mode}
                        onClick={() => setPreviewMode(mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          previewMode === mode ? "bg-accent-strong text-white shadow" : "text-muted hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <AsciiPreview
                    ascii={ascii}
                    cols={deferredSettings.width}
                    rows={sample?.rows ?? 0}
                    invert={deferredSettings.invert}
                    busy={busy}
                    animation={previewAnimation}
                  />
                </section>
                <ExportPanel
                  ascii={ascii}
                  fileBase={baseName(image.name)}
                  invert={deferredSettings.invert}
                  animation={animationOptions}
                  onAnimationChange={(options) => {
                    setAnimationOptions(options);
                    setPreviewMode("animated");
                  }}
                  notify={notify}
                />
              </div>

              <div className="lg:col-span-2 xl:col-span-1 xl:col-start-1 xl:row-start-2">
                <Controls
                  settings={settings}
                  rows={rows}
                  onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                  onReset={() => setSettings(DEFAULT_SETTINGS)}
                />
              </div>
            </div>

            <section aria-labelledby="profile-title" className="rounded-3xl border border-line bg-surface/80 p-5 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                <div className="space-y-5">
                  <div>
                    <h2 id="profile-title" className="text-lg font-semibold text-white">
                      Preview on your profile
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      This is your portrait, exactly as GitHub will play it. Add a greeting and copy the whole README.
                    </p>
                  </div>
                  {(
                    [
                      ["name", "Your name", "Ada Lovelace"],
                      ["tagline", "One-line bio", "I build tools for people who build things."],
                      ["username", "GitHub username", "your-username"],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <div key={key} className="space-y-1.5">
                      <label htmlFor={`profile-${key}`} className="text-sm font-medium text-zinc-200">
                        {label}
                        {key !== "name" && <span className="ml-1 text-xs font-normal text-subtle">(optional)</span>}
                      </label>
                      <input
                        id={`profile-${key}`}
                        type="text"
                        value={profile[key]}
                        placeholder={placeholder}
                        maxLength={key === "tagline" ? 140 : 60}
                        autoComplete="off"
                        onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                        className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-white outline-none transition placeholder:text-subtle focus:border-accent"
                      />
                    </div>
                  ))}
                  <div className="grid gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!ascii}
                      onClick={async () => {
                        try {
                          await copyToClipboard(readmeFile(animatedFileName(baseName(image.name)), profile));
                          notify("Copied your README — paste it into README.md next to the SVG.");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "Couldn't copy to the clipboard.", "error");
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      Copy full README
                    </button>
                    <button
                      type="button"
                      disabled={!ascii}
                      onClick={() => {
                        const file = animatedFileName(baseName(image.name));
                        downloadFile(
                          file,
                          toSvg(ascii, deferredSettings.invert ? SVG_THEMES.light : SVG_THEMES.dark, 12, exportAnimation),
                          "image/svg+xml",
                        );
                        notify(`Downloaded ${file}`);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-accent/50 hover:text-white disabled:opacity-50"
                    >
                      Download animated .svg
                    </button>
                    <p className="text-xs text-subtle">
                      Put both in the repo named after your username
                      {profile.username.trim() ? (
                        <>
                          {" "}
                          — <span className="font-mono text-muted">github.com/{profile.username.trim()}/{profile.username.trim()}</span>
                        </>
                      ) : null}
                      .
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  {ascii ? (
                    <ReadmeMockup
                      ascii={ascii}
                      animation={exportAnimation}
                      invert={deferredSettings.invert}
                      name={profile.name}
                      tagline={profile.tagline}
                      username={profile.username}
                    />
                  ) : (
                    <div className="skeleton aspect-[4/3] w-full rounded-2xl" />
                  )}
                </div>
              </div>
            </section>

            <ReadmeGuide />
          </>
        )}
      </main>

      <footer className="border-t border-line/60 py-8 text-center text-xs text-subtle">
        <p>
          Made for GitHub profiles · Your photos are processed locally with the Canvas API and never uploaded. Sample:
          <span className="text-muted"> Mona Lisa (public domain).</span>
        </p>
      </footer>

      {pageDrag && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="rounded-3xl border-2 border-dashed border-accent bg-accent-soft/60 px-10 py-8 text-center">
            <UploadIcon className="mx-auto mb-3 text-4xl text-accent" />
            <p className="text-lg font-semibold text-white">Drop to use this photo</p>
          </div>
        </div>
      )}

      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            data-testid="toast"
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              toast.tone === "error"
                ? "border-red-400/40 bg-red-950/90 text-red-100"
                : "border-accent/30 bg-raised/95 text-white"
            }`}
          >
            {toast.tone === "error" ? <AlertIcon className="text-red-300" /> : <CheckIcon className="text-emerald-300" />}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
