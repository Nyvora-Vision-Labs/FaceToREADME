import { BookIcon } from "./Icons";

const steps = [
  {
    title: "Animated portrait (recommended)",
    body: "Click “Download animated .svg” and add the file to your profile repo — the one named after your username — next to README.md. Then click “Copy README snippet” and paste it into README.md. GitHub plays the drawing animation right on your profile.",
    code: '<p align="center">\n  <img src="./portrait-ascii-animated.svg" width="600" alt="ASCII art portrait">\n</p>',
  },
  {
    title: "Plain text code block",
    body: "Prefer no files? Click “Copy as Markdown code block” and paste it straight into README.md. The code fence keeps every space and line break, and GitHub renders it in a monospace font.",
    code: "```text\n      .:-=+*##*+=-:.\n   :=*%@@@@@@@@@@%*=:\n   ...your portrait...\n```",
  },
  {
    title: "Bonus — match the viewer’s theme",
    body: "Download one SVG normally and one with “Invert” on, then let GitHub pick based on light or dark mode.",
    code: '<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="./portrait-dark.svg">\n  <img src="./portrait-light.svg" width="600" alt="ASCII portrait">\n</picture>',
  },
];

export function ReadmeGuide() {
  return (
    <section id="readme-guide" aria-labelledby="guide-title" className="rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-xl text-accent ring-1 ring-accent/30">
          <BookIcon />
        </span>
        <div>
          <h2 id="guide-title" className="text-lg font-semibold text-white">
            Add it to your GitHub README
          </h2>
          <p className="text-sm text-muted">Upload a photo, we make the art — then it’s two quick steps.</p>
        </div>
      </div>
      <ol className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex min-w-0 flex-col rounded-2xl border border-line bg-raised/40 p-5">
            <span className="mb-2 font-mono text-xs text-accent">0{i + 1}</span>
            <h3 className="text-sm font-semibold text-white">{step.title}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{step.body}</p>
            <pre className="ascii mt-4 overflow-x-auto rounded-xl bg-canvas p-3 text-xs leading-relaxed text-violet-200 ring-1 ring-line">
              {step.code}
            </pre>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs text-subtle">
        Tip: keep the width at 100 columns or fewer so the code block fits without horizontal scrolling. Profile READMEs
        live at <span className="font-mono text-muted">github.com/&lt;username&gt;/&lt;username&gt;</span>.
      </p>
    </section>
  );
}
