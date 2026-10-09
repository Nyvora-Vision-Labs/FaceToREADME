import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const SAMPLE = path.resolve("public/sample-portrait.jpg");

async function asciiText(page: Page) {
  return (await page.getByTestId("ascii-output").textContent()) ?? "";
}

function dims(ascii: string) {
  const lines = ascii.split("\n");
  return { cols: Array.from(lines[0]).length, rows: lines.length, lines };
}

async function uploadSample(page: Page) {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles(SAMPLE);
  await expect(page.getByTestId("ascii-output")).toBeVisible();
}

test("rejects unsupported and oversized files with a clear message", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({ name: "cat.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByRole("alert")).toContainText(".gif isn't supported");

  await page.getByTestId("file-input").setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(16 * 1024 * 1024),
  });
  await expect(page.getByRole("alert")).toContainText("The limit is 15.0 MB");

  await page.getByTestId("file-input").setInputFiles({ name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from("nope") });
  await expect(page.getByRole("alert")).toContainText("couldn't read that image");
  await expect(page.getByTestId("ascii-output")).toHaveCount(0);
});

test("file picker upload produces aligned ASCII art", async ({ page }) => {
  await uploadSample(page);
  const ascii = await asciiText(page);
  const { cols, rows, lines } = dims(ascii);
  expect(cols).toBe(100);
  expect(rows).toBe(Math.round(100 * (0.6 / 1.45))); // square crop, cell-aspect corrected
  expect(lines.every((l) => Array.from(l).length === cols)).toBe(true);
  expect(new Set(ascii.replace(/\n/g, "")).size).toBeGreaterThan(4); // real tonal variation
  await expect(page.getByText("Original photo")).toBeVisible();
});

test("drag and drop upload works", async ({ page }) => {
  await page.goto("/");
  const bytes = readFileSync(SAMPLE).toString("base64");
  await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], "dropped-face.jpg", { type: "image/jpeg" }));
    const zone = document.querySelector('[data-testid="upload-zone"]')!;
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  }, bytes);
  await expect(page.getByTestId("ascii-output")).toBeVisible();
  await expect(page.getByText("dropped-face.jpg", { exact: true })).toBeVisible();
});

test("sample image, customization controls, and crop update the art live", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the sample portrait" }).click();
  await expect(page.getByTestId("ascii-output")).toBeVisible();
  const initial = await asciiText(page);

  // Width
  const width = page.getByRole("slider", { name: "Output width" });
  await width.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => dims(await asciiText(page)).cols).toBe(90);

  // Brightness / contrast / density each change the output
  for (const label of ["Brightness", "Contrast", "Detail", "Character density"]) {
    const before = await asciiText(page);
    await page.getByRole("slider", { name: label, exact: true }).fill("80");
    await expect.poll(() => asciiText(page)).not.toBe(before);
  }
  // Back to defaults so later steps don't run on a blown-out image.
  for (const [label, value] of [["Brightness", "0"], ["Contrast", "20"], ["Detail", "45"], ["Character density", "50"]]) {
    await page.getByRole("slider", { name: label, exact: true }).fill(value);
  }

  // Palettes
  await page.getByText("Blocks", { exact: true }).click();
  await expect.poll(async () => /[░▒▓█]/.test(await asciiText(page))).toBe(true);
  await page.getByText("Custom", { exact: true }).click();
  const custom = page.getByLabel("Custom characters, lightest → densest");
  await custom.fill(" xX");
  await expect.poll(async () => /^[ xX\n]+$/.test(await asciiText(page))).toBe(true);
  await custom.fill("x");
  await expect(page.getByText("Enter at least 2 characters")).toBeVisible();
  await custom.fill(" .#");

  // Invert flips characters and the preview theme
  const beforeInvert = await asciiText(page);
  const toggle = page.getByRole("switch", { name: "Invert light & dark" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => asciiText(page)).not.toBe(beforeInvert);
  await expect(page.getByText("GitHub light preview")).toBeVisible();

  // Auto levels toggle changes output
  const beforeLevels = await asciiText(page);
  const levels = page.getByRole("switch", { name: "Auto levels" });
  await levels.click();
  await expect(levels).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => asciiText(page)).not.toBe(beforeLevels);
  await levels.click();

  // Crop: zoom + drag
  const beforeCrop = await asciiText(page);
  const frame = page.getByTestId("crop-frame");
  await frame.scrollIntoViewIfNeeded();
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => asciiText(page)).not.toBe(beforeCrop);
  await page.locator("label", { hasText: "Tall" }).click();
  await expect.poll(async () => dims(await asciiText(page)).rows).toBe(Math.round(90 * (4 / 3) * (0.6 / 1.45)));

  // Reset all restores defaults
  await page.getByRole("button", { name: "Reset all" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(initial.length).toBeGreaterThan(0);
});

test("copy as Markdown puts a fenced code block on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await uploadSample(page);
  const ascii = await asciiText(page);
  await page.getByRole("button", { name: "Copy as Markdown code block" }).click();
  await expect(page.getByTestId("toast")).toContainText("Copied as a Markdown code block");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe("```text\n" + ascii + "\n```\n");

  await page.getByRole("button", { name: "Copy plain text only" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(ascii + "\n");
});

test("animated README flow: preview, download, and snippet", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await uploadSample(page);
  const ascii = await asciiText(page);

  await page.getByRole("tab", { name: "Animated SVG" }).click();
  const preview = page.getByTestId("animated-preview");
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await page.locator("label", { hasText: "Fast" }).click();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("region", { name: "Add it to your README" }).getByRole("button", { name: "Download animated .svg" }).click(),
  ]);
  expect(file.suggestedFilename()).toBe("sample-portrait-ascii-animated.svg");
  const svg = readFileSync((await file.path())!, "utf8");
  expect(svg.match(/<text /g)).toHaveLength(ascii.split("\n").length);
  expect(svg).toContain('repeatCount="indefinite"');

  // The drawing really progresses top to bottom when rendered.
  const heights = await page.evaluate(async (src) => {
    const host = document.createElement("div");
    host.innerHTML = src;
    document.body.appendChild(host);
    (host.querySelector("svg") as SVGSVGElement).setCurrentTime(0);
    const clip = host.querySelector("clipPath rect") as SVGRectElement;
    const read = () => clip.height.animVal.value;
    const samples: number[] = [];
    for (let i = 0; i < 4; i++) {
      samples.push(read());
      await new Promise((r) => setTimeout(r, 250));
    }
    host.remove();
    return samples;
  }, svg);
  expect(heights[0]).toBeLessThan(heights[1]);
  expect(heights[1]).toBeLessThan(heights[2]);

  await page.getByRole("button", { name: "Copy README snippet" }).click();
  await expect(page.getByTestId("toast")).toContainText("README snippet");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('<img src="./sample-portrait-ascii-animated.svg"');
});

test("landing page shows a live README demo that draws itself", async ({ page }) => {
  await page.goto("/");
  const portrait = page.getByTestId("mockup-portrait");
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByTestId("mockup-name")).toHaveText("Hi, I’m Mona Lisa");
  const before = await portrait.getAttribute("src");
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(portrait).not.toHaveAttribute("src", before!);
});

test("profile preview personalises the README and copies it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await uploadSample(page);
  const profile = page.getByRole("region", { name: "Preview on your profile" });
  await profile.getByLabel("Your name").fill("Ada <Lovelace>");
  await profile.getByLabel(/One-line bio/).fill("Writes the first programs.");
  await profile.getByLabel(/GitHub username/).fill("ada");
  await expect(profile.getByTestId("mockup-name")).toHaveText("Hi, I’m Ada <Lovelace>");
  await expect(profile.getByText("ada / README")).toBeVisible();
  await expect.poll(() =>
    profile.getByTestId("mockup-portrait").evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);

  await profile.getByRole("button", { name: "Copy full README" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('<img src="./sample-portrait-ascii-animated.svg"');
  expect(clip).toContain("Hi, I’m Ada &lt;Lovelace&gt;");
  expect(clip).toContain("Writes the first programs.");

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    profile.getByRole("button", { name: "Download animated .svg" }).click(),
  ]);
  expect(file.suggestedFilename()).toBe("sample-portrait-ascii-animated.svg");
});

test("downloads .txt and .svg files with the art", async ({ page }) => {
  await uploadSample(page);
  const ascii = await asciiText(page);

  const [txt] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download .txt" }).click()]);
  expect(txt.suggestedFilename()).toBe("sample-portrait-ascii.txt");
  expect(readFileSync((await txt.path())!, "utf8")).toBe(ascii + "\n");

  const [svg] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download .svg" }).click()]);
  expect(svg.suggestedFilename()).toBe("sample-portrait-ascii.svg");
  const content = readFileSync((await svg.path())!, "utf8");
  expect(content).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  expect(content).toContain('fill="#0d1117"');
  expect(content.match(/<text /g)).toHaveLength(ascii.split("\n").length);

  // The SVG renders as an image (as it would in a README) without errors.
  const ok = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
    await img.decode();
    return img.naturalWidth > 0;
  }, content);
  expect(ok).toBe(true);
});

test("layout: previews side by side on desktop, stacked on mobile", async ({ page }, info) => {
  await uploadSample(page);
  const photo = (await page.getByTestId("crop-frame").boundingBox())!;
  const art = (await page.getByTestId("ascii-output").boundingBox())!;
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "View at actual size (scrolls)" }).click();
    await expect(page.getByRole("button", { name: "Fit to screen" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Fit to screen" }).click();
    expect(art.y).toBeGreaterThan(photo.y + photo.height);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(390);
  } else {
    expect(art.x).toBeGreaterThan(photo.x + photo.width);
  }
  await page.screenshot({ path: `test-results/screens/${info.project.name}-workspace.png`, fullPage: true });
  await page.goto("/");
  await page.screenshot({ path: `test-results/screens/${info.project.name}-landing.png`, fullPage: true });
});
